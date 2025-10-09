import { Database } from "@/types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";

type SpeakerRow = Database["public"]["Tables"]["speakers"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ScheduledPostRow = Database["public"]["Tables"]["scheduled_posts"]["Row"];

interface SchedulePreviewItem {
  speakerId: number;
  speakerName: string;
  scheduledTime: string; // ISO string
  daysUntilEvent: number;
  hasConflict: boolean;
  conflictReason?: string;
}

interface DripCampaignParams {
  eventId: number;
  userId: string;
  daysBeforeEvent?: number;
  startTime?: string; // HH:MM format
  platform?: "linkedin" | "twitter" | "instagram";
  avoidWeekends?: boolean;
}

interface CreateCampaignResult {
  success: boolean;
  scheduledCount: number;
  skippedCount: number;
  warnings: string[];
  preview: SchedulePreviewItem[];
}

/**
 * Service for managing drip campaigns - automated speaker announcement scheduling
 */
export class DripCampaignService {
  private readonly POSTING_WINDOW_START = 8; // 8am
  private readonly POSTING_WINDOW_END = 15; // 3pm
  private readonly MIN_SPACING_HOURS = 12;
  private readonly CONFLICT_BUFFER_HOURS = 1; // ±1 hour considered a conflict

  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Generate a preview of the drip campaign schedule
   * Does not create any posts, just calculates what would be scheduled
   */
  async previewCampaign(
    params: DripCampaignParams
  ): Promise<SchedulePreviewItem[]> {
    // Validate and fetch event
    const event = await this.validateEventOwnership(params.eventId, params.userId);

    // Get all speakers for this event
    const speakers = await this.fetchSpeakers(params.eventId);

    if (speakers.length === 0) {
      throw new Error("No speakers found for this event. Add speakers first.");
    }

    // Get existing scheduled posts to avoid conflicts
    const existingPosts = await this.fetchExistingPosts(params.eventId);

    // Calculate schedule
    const daysBeforeEvent = params.daysBeforeEvent || event.drip_campaign_days_before || 7;
    const startTime = params.startTime || event.drip_campaign_start_time || "10:00:00";
    const avoidWeekends = params.avoidWeekends ?? true; // Default to true

    const preview = await this.calculateSchedule({
      event,
      speakers,
      existingPosts,
      daysBeforeEvent,
      startTime,
      avoidWeekends,
    });

    return preview;
  }

  /**
   * Create the drip campaign - actually schedule all posts
   */
  async createCampaign(
    params: DripCampaignParams
  ): Promise<CreateCampaignResult> {
    // Get preview first
    const preview = await this.previewCampaign(params);

    const platform = params.platform || "linkedin";
    const warnings: string[] = [];
    let scheduledCount = 0;
    let skippedCount = 0;

    // For each speaker in the preview, create announcement and schedule
    for (const item of preview) {
      if (item.hasConflict) {
        warnings.push(
          `Skipped ${item.speakerName}: ${item.conflictReason || "No available time slot"}`
        );
        skippedCount++;
        continue;
      }

      try {
        // TODO: Generate announcement for this speaker
        // For now, we'll assume announcements already exist
        // In Phase 2, add auto-generation here

        // Create scheduled post
        const { error } = await this.supabase.from("scheduled_posts").insert({
          user_id: params.userId,
          event_id: params.eventId,
          speaker_id: item.speakerId,
          announcement_id: 0, // TODO: Link to actual announcement
          scheduled_time: item.scheduledTime,
          timezone: await this.getEventTimezone(params.eventId),
          platform,
          post_text: `Speaker announcement for ${item.speakerName}`, // Placeholder
          status: "pending",
        });

        if (error) {
          warnings.push(`Failed to schedule ${item.speakerName}: ${error.message}`);
          skippedCount++;
        } else {
          scheduledCount++;
        }
      } catch (error) {
        warnings.push(
          `Error scheduling ${item.speakerName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        skippedCount++;
      }
    }

    // Mark event as having drip campaign enabled
    await this.supabase
      .from("events")
      .update({ drip_campaign_enabled: true })
      .eq("id", params.eventId);

    return {
      success: scheduledCount > 0,
      scheduledCount,
      skippedCount,
      warnings,
      preview,
    };
  }

  /**
   * Core scheduling algorithm with conflict detection
   */
  private async calculateSchedule(params: {
    event: EventRow;
    speakers: SpeakerRow[];
    existingPosts: ScheduledPostRow[];
    daysBeforeEvent: number;
    startTime: string;
    avoidWeekends: boolean;
  }): Promise<SchedulePreviewItem[]> {
    const { event, speakers, existingPosts, daysBeforeEvent, startTime, avoidWeekends } = params;

    const eventDate = new Date(event.date);
    const preview: SchedulePreviewItem[] = [];

    // Sort speakers by creation order for consistent scheduling
    const sortedSpeakers = [...speakers].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Calculate posting interval in days
    const totalSpeakers = sortedSpeakers.length;
    const dayInterval = Math.max(1, Math.floor(daysBeforeEvent / totalSpeakers));

    for (let i = 0; i < sortedSpeakers.length; i++) {
      const speaker = sortedSpeakers[i];
      const daysBeforeForThisSpeaker = daysBeforeEvent - i * dayInterval;

      // Calculate ideal posting time
      let idealDateTime = this.calculateIdealDateTime(
        eventDate,
        daysBeforeForThisSpeaker,
        startTime,
        event.timezone
      );

      // Adjust for weekends if needed
      if (avoidWeekends) {
        idealDateTime = this.adjustForWeekend(idealDateTime);
      }

      // Find available time slot
      const { scheduledTime, hasConflict, conflictReason } =
        await this.findAvailableSlot(idealDateTime, existingPosts, preview);

      preview.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        scheduledTime: scheduledTime.toISOString(),
        daysUntilEvent: daysBeforeForThisSpeaker,
        hasConflict,
        conflictReason,
      });
    }

    return preview;
  }

  /**
   * Find an available time slot, checking for conflicts and adjusting as needed
   */
  private async findAvailableSlot(
    idealTime: Date,
    existingPosts: ScheduledPostRow[],
    alreadyScheduled: SchedulePreviewItem[]
  ): Promise<{
    scheduledTime: Date;
    hasConflict: boolean;
    conflictReason?: string;
  }> {
    // Try ideal time first
    if (
      !this.hasTimeConflict(idealTime, existingPosts, alreadyScheduled) &&
      this.meetsMinimumSpacing(idealTime, alreadyScheduled)
    ) {
      return { scheduledTime: idealTime, hasConflict: false };
    }

    // Try alternative times in posting window (±3 hours max)
    const alternatives = this.generateAlternativeTimes(idealTime);

    for (const altTime of alternatives) {
      if (
        !this.hasTimeConflict(altTime, existingPosts, alreadyScheduled) &&
        this.meetsMinimumSpacing(altTime, alreadyScheduled)
      ) {
        return { scheduledTime: altTime, hasConflict: false };
      }
    }

    // No available slot found
    return {
      scheduledTime: idealTime,
      hasConflict: true,
      conflictReason: "No available time slot within posting window (8am-3pm)",
    };
  }

  /**
   * Generate alternative posting times (±1 to ±3 hours)
   */
  private generateAlternativeTimes(baseTime: Date): Date[] {
    const alternatives: Date[] = [];
    const hourOffsets = [1, -1, 2, -2, 3, -3]; // Try closest first

    for (const offset of hourOffsets) {
      const altTime = new Date(baseTime);
      altTime.setHours(altTime.getHours() + offset);

      // Only include if within posting window
      const hour = altTime.getHours();
      if (hour >= this.POSTING_WINDOW_START && hour < this.POSTING_WINDOW_END) {
        alternatives.push(altTime);
      }
    }

    return alternatives;
  }

  /**
   * Check if a time conflicts with existing posts (±1 hour buffer)
   */
  private hasTimeConflict(
    checkTime: Date,
    existingPosts: ScheduledPostRow[],
    alreadyScheduled: SchedulePreviewItem[]
  ): boolean {
    const bufferMs = this.CONFLICT_BUFFER_HOURS * 60 * 60 * 1000;

    // Check against existing database posts
    for (const post of existingPosts) {
      const postTime = new Date(post.scheduled_time);
      const diff = Math.abs(checkTime.getTime() - postTime.getTime());
      if (diff < bufferMs) {
        return true;
      }
    }

    // Check against posts we're about to schedule
    for (const scheduled of alreadyScheduled) {
      const scheduledTime = new Date(scheduled.scheduledTime);
      const diff = Math.abs(checkTime.getTime() - scheduledTime.getTime());
      if (diff < bufferMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check minimum spacing (12 hours) from previous post in the schedule
   */
  private meetsMinimumSpacing(
    checkTime: Date,
    alreadyScheduled: SchedulePreviewItem[]
  ): boolean {
    if (alreadyScheduled.length === 0) return true;

    const minSpacingMs = this.MIN_SPACING_HOURS * 60 * 60 * 1000;
    const lastScheduled = alreadyScheduled[alreadyScheduled.length - 1];
    const lastTime = new Date(lastScheduled.scheduledTime);

    const diff = checkTime.getTime() - lastTime.getTime();
    return diff >= minSpacingMs;
  }

  /**
   * Calculate ideal posting datetime
   */
  private calculateIdealDateTime(
    eventDate: Date,
    daysBeforeEvent: number,
    startTime: string,
    timezone: string
  ): Date {
    const postingDate = new Date(eventDate);
    postingDate.setDate(postingDate.getDate() - daysBeforeEvent);

    // Parse time (format: "HH:MM:SS")
    const [hours, minutes] = startTime.split(":").map(Number);
    postingDate.setHours(hours, minutes, 0, 0);

    return postingDate;
  }

  /**
   * Adjust date to next weekday if it falls on a weekend
   */
  private adjustForWeekend(date: Date): Date {
    const dayOfWeek = date.getDay();

    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0) {
      // Sunday -> move to Monday (+1 day)
      const adjusted = new Date(date);
      adjusted.setDate(adjusted.getDate() + 1);
      return adjusted;
    } else if (dayOfWeek === 6) {
      // Saturday -> move to Monday (+2 days)
      const adjusted = new Date(date);
      adjusted.setDate(adjusted.getDate() + 2);
      return adjusted;
    }

    return date;
  }

  // Helper methods

  private async validateEventOwnership(
    eventId: number,
    userId: string
  ): Promise<EventRow> {
    const { data: event, error } = await this.supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", userId)
      .single();

    if (error || !event) {
      throw new Error(
        "Event not found or you don't have permission to access it"
      );
    }

    return event;
  }

  private async fetchSpeakers(eventId: number): Promise<SpeakerRow[]> {
    const { data: speakers, error } = await this.supabase
      .from("speakers")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch speakers: ${error.message}`);
    }

    return speakers || [];
  }

  private async fetchExistingPosts(
    eventId: number
  ): Promise<ScheduledPostRow[]> {
    const { data: posts, error } = await this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("event_id", eventId)
      .in("status", ["pending", "posted"]); // Only check active posts

    if (error) {
      throw new Error(`Failed to fetch existing posts: ${error.message}`);
    }

    return posts || [];
  }

  private async getEventTimezone(eventId: number): Promise<string> {
    const { data: event } = await this.supabase
      .from("events")
      .select("timezone")
      .eq("id", eventId)
      .single();

    return event?.timezone || "UTC";
  }
}
