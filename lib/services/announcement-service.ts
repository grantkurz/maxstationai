import { Database } from "@/types/supabase";
import { AnnouncementRepository } from "@/lib/repositories/announcement-repository";
import { SupabaseClient } from "@supabase/supabase-js";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
type AnnouncementInsert = Database["public"]["Tables"]["announcements"]["Insert"];
type SpeakerRow = Database["public"]["Tables"]["speakers"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface CreateAnnouncementParams {
  speakerId: number;
  eventId: number;
  announcementText: string;
  platform: "linkedin" | "twitter" | "instagram";
  template: "pre-event" | "day-of" | "post-event" | "custom";
  userId: string;
}

interface UpdateAnnouncementParams {
  announcementText?: string;
  platform?: "linkedin" | "twitter" | "instagram";
  template?: "pre-event" | "day-of" | "post-event" | "custom";
}

/**
 * Service layer for announcement business logic
 * Handles validation, authorization, and orchestrates repository operations
 */
export class AnnouncementService {
  private repository: AnnouncementRepository;

  constructor(private supabase: SupabaseClient<Database>) {
    this.repository = new AnnouncementRepository(supabase);
  }

  /**
   * Creates a new announcement with validation
   * @param params - Parameters for creating announcement
   * @returns The created announcement
   * @throws Error if validation fails or user doesn't own the event
   */
  async createAnnouncement(
    params: CreateAnnouncementParams
  ): Promise<AnnouncementRow> {
    // Validate announcement text
    if (!params.announcementText || params.announcementText.trim().length === 0) {
      throw new Error("Announcement text cannot be empty");
    }

    // Validate speaker and event ownership
    await this.validateSpeakerAndEventOwnership(
      params.speakerId,
      params.eventId,
      params.userId
    );

    // Calculate character count
    const characterCount = params.announcementText.trim().length;

    // Validate character count for platform
    this.validateCharacterCountForPlatform(params.platform, characterCount);

    // Create announcement data
    const announcementData: AnnouncementInsert = {
      speaker_id: params.speakerId,
      event_id: params.eventId,
      announcement_text: params.announcementText.trim(),
      platform: params.platform,
      template: params.template,
      character_count: characterCount,
      user_id: params.userId,
    };

    const announcement = await this.repository.createAnnouncement(
      announcementData
    );

    if (!announcement) {
      throw new Error("Failed to create announcement");
    }

    return announcement;
  }

  /**
   * Retrieves all announcements for a speaker
   * @param speakerId - ID of the speaker
   * @param userId - ID of the authenticated user
   * @returns Array of announcements
   */
  async getAnnouncementsBySpeaker(
    speakerId: number,
    userId: string
  ): Promise<AnnouncementRow[]> {
    // Verify user owns the speaker
    await this.validateSpeakerOwnership(speakerId, userId);

    return this.repository.getAnnouncementsBySpeaker(speakerId);
  }

  /**
   * Retrieves all announcements for an event
   * @param eventId - ID of the event
   * @param userId - ID of the authenticated user
   * @returns Array of announcements
   */
  async getAnnouncementsByEvent(
    eventId: number,
    userId: string
  ): Promise<AnnouncementRow[]> {
    // Verify user owns the event
    await this.validateEventOwnership(eventId, userId);

    return this.repository.getAnnouncementsByEvent(eventId);
  }

  /**
   * Retrieves all announcements for the authenticated user
   * @param userId - ID of the user
   * @returns Array of announcements
   */
  async getUserAnnouncements(userId: string): Promise<AnnouncementRow[]> {
    return this.repository.getAnnouncementsByUser(userId);
  }

  /**
   * Retrieves a single announcement by ID
   * @param id - ID of the announcement
   * @param userId - ID of the authenticated user
   * @returns The announcement or null if not found
   * @throws Error if user doesn't own the announcement
   */
  async getAnnouncementById(
    id: number,
    userId: string
  ): Promise<AnnouncementRow | null> {
    const announcement = await this.repository.getAnnouncementById(id);

    if (!announcement) {
      return null;
    }

    // Verify ownership
    if (announcement.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this announcement");
    }

    return announcement;
  }

  /**
   * Updates an announcement
   * @param id - ID of the announcement
   * @param userId - ID of the authenticated user
   * @param updates - Fields to update
   * @returns The updated announcement
   * @throws Error if validation fails or unauthorized
   */
  async updateAnnouncement(
    id: number,
    userId: string,
    updates: UpdateAnnouncementParams
  ): Promise<AnnouncementRow> {
    // Verify ownership
    const belongsToUser = await this.repository.announcementBelongsToUser(
      id,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Unauthorized: Announcement not found or you don't own it"
      );
    }

    // If updating announcement text, recalculate character count
    if (updates.announcementText !== undefined) {
      if (!updates.announcementText || updates.announcementText.trim().length === 0) {
        throw new Error("Announcement text cannot be empty");
      }

      const characterCount = updates.announcementText.trim().length;

      // If platform is being updated, validate against new platform
      // Otherwise get current announcement to check platform
      let platform = updates.platform;
      if (!platform) {
        const currentAnnouncement = await this.repository.getAnnouncementById(id);
        platform = currentAnnouncement!.platform;
      }

      this.validateCharacterCountForPlatform(platform, characterCount);

      const updatedAnnouncement = await this.repository.updateAnnouncement(id, {
        ...updates,
        announcement_text: updates.announcementText.trim(),
        character_count: characterCount,
      });

      if (!updatedAnnouncement) {
        throw new Error("Failed to update announcement");
      }

      return updatedAnnouncement;
    }

    const updatedAnnouncement = await this.repository.updateAnnouncement(
      id,
      updates
    );

    if (!updatedAnnouncement) {
      throw new Error("Failed to update announcement");
    }

    return updatedAnnouncement;
  }

  /**
   * Deletes an announcement
   * @param id - ID of the announcement
   * @param userId - ID of the authenticated user
   * @returns True if deleted successfully
   * @throws Error if unauthorized
   */
  async deleteAnnouncement(id: number, userId: string): Promise<boolean> {
    // Verify ownership
    const belongsToUser = await this.repository.announcementBelongsToUser(
      id,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Unauthorized: Announcement not found or you don't own it"
      );
    }

    return this.repository.deleteAnnouncement(id);
  }

  /**
   * Retrieves announcements by platform
   * @param userId - ID of the user
   * @param platform - Social media platform
   * @returns Array of announcements
   */
  async getAnnouncementsByPlatform(
    userId: string,
    platform: "linkedin" | "twitter" | "instagram"
  ): Promise<AnnouncementRow[]> {
    return this.repository.getAnnouncementsByPlatform(userId, platform);
  }

  // ========== PRIVATE VALIDATION METHODS ==========

  /**
   * Validates that a speaker belongs to an event and both belong to the user
   * @private
   */
  private async validateSpeakerAndEventOwnership(
    speakerId: number,
    eventId: number,
    userId: string
  ): Promise<void> {
    // Check if speaker exists and get its event_id
    const { data: speaker, error: speakerError } = await this.supabase
      .from("speakers")
      .select("event_id")
      .eq("id", speakerId)
      .single();

    if (speakerError || !speaker) {
      throw new Error("Speaker not found");
    }

    // Verify speaker belongs to the specified event
    if (speaker.event_id !== eventId) {
      throw new Error("Speaker does not belong to the specified event");
    }

    // Verify event belongs to user
    await this.validateEventOwnership(eventId, userId);
  }

  /**
   * Validates that an event belongs to the user
   * @private
   */
  private async validateEventOwnership(
    eventId: number,
    userId: string
  ): Promise<void> {
    const { data: event, error: eventError } = await this.supabase
      .from("events")
      .select("user_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    if (event.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this event");
    }
  }

  /**
   * Validates that a speaker belongs to the user
   * @private
   */
  private async validateSpeakerOwnership(
    speakerId: number,
    userId: string
  ): Promise<void> {
    const { data: speaker, error: speakerError } = await this.supabase
      .from("speakers")
      .select("event_id, events!inner(user_id)")
      .eq("id", speakerId)
      .single();

    if (speakerError || !speaker) {
      throw new Error("Speaker not found");
    }

    // TypeScript needs help with the nested relation
    const speakerWithEvent = speaker as unknown as {
      event_id: number;
      events: { user_id: string };
    };

    if (speakerWithEvent.events.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this speaker");
    }
  }

  /**
   * Validates character count against platform limits
   * @private
   * @throws Error if character count exceeds platform limit
   */
  private validateCharacterCountForPlatform(
    platform: "linkedin" | "twitter" | "instagram",
    characterCount: number
  ): void {
    const platformLimits = {
      twitter: 25000, // X Premium allows up to 25,000 characters
      instagram: 2200,
      linkedin: 3000,
    };

    const limit = platformLimits[platform];

    if (characterCount > limit) {
      throw new Error(
        `Announcement exceeds ${platform} character limit of ${limit} (current: ${characterCount})`
      );
    }
  }
}
