import { Database } from "@/types/supabase";
import { ScheduledPostRepository } from "@/lib/repositories/scheduled-post-repository";
import { SupabaseClient } from "@supabase/supabase-js";

type ScheduledPostRow = Database["public"]["Tables"]["scheduled_posts"]["Row"];
type ScheduledPostInsert = Database["public"]["Tables"]["scheduled_posts"]["Insert"];
type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];

interface CreateScheduledPostParams {
  announcementId: number;
  scheduledTime: string; // ISO 8601 timestamp
  timezone?: string;
  imageUrl?: string;
  userId: string;
}

interface UpdateScheduledPostParams {
  scheduledTime?: string;
  timezone?: string;
  imageUrl?: string;
  status?: "pending" | "posted" | "failed" | "cancelled";
}

/**
 * Service layer for scheduled post business logic
 * Handles validation, authorization, and orchestrates repository operations
 */
export class ScheduledPostService {
  private repository: ScheduledPostRepository;

  constructor(private supabase: SupabaseClient<Database>) {
    this.repository = new ScheduledPostRepository(supabase);
  }

  /**
   * Creates a new scheduled post with validation
   * @param params - Parameters for creating scheduled post
   * @returns The created scheduled post
   * @throws Error if validation fails or user doesn't own the announcement
   */
  async createScheduledPost(
    params: CreateScheduledPostParams
  ): Promise<ScheduledPostRow> {
    // Validate scheduled time is in the future
    const scheduledDate = new Date(params.scheduledTime);
    const now = new Date();

    if (scheduledDate <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    // Fetch the announcement to validate ownership and get details
    const announcement = await this.getAnnouncementAndValidateOwnership(
      params.announcementId,
      params.userId
    );

    // Check for duplicate scheduling
    const hasDuplicate = await this.repository.hasDuplicateSchedule(
      params.announcementId,
      announcement.platform as "linkedin" | "twitter" | "instagram",
      params.scheduledTime
    );

    if (hasDuplicate) {
      throw new Error(
        "A post is already scheduled for this announcement at the same time on this platform"
      );
    }

    // Create scheduled post data
    const scheduledPostData: ScheduledPostInsert = {
      user_id: params.userId,
      announcement_id: params.announcementId,
      speaker_id: announcement.speaker_id,
      event_id: announcement.event_id,
      scheduled_time: params.scheduledTime,
      timezone: params.timezone || "UTC",
      platform: announcement.platform,
      status: "pending",
      post_text: announcement.announcement_text,
      image_url: params.imageUrl || null,
    };

    const scheduledPost = await this.repository.createScheduledPost(
      scheduledPostData
    );

    if (!scheduledPost) {
      throw new Error("Failed to create scheduled post");
    }

    return scheduledPost;
  }

  /**
   * Retrieves a scheduled post by ID
   * @param id - ID of the scheduled post
   * @param userId - ID of the authenticated user
   * @returns The scheduled post or null if not found
   * @throws Error if user doesn't own the scheduled post
   */
  async getScheduledPostById(
    id: number,
    userId: string
  ): Promise<ScheduledPostRow | null> {
    const scheduledPost = await this.repository.getScheduledPostById(id);

    if (!scheduledPost) {
      return null;
    }

    // Verify ownership
    if (scheduledPost.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this scheduled post");
    }

    return scheduledPost;
  }

  /**
   * Retrieves all scheduled posts for a user
   * @param userId - ID of the user
   * @param status - Optional status filter
   * @returns Array of scheduled posts
   */
  async getUserScheduledPosts(
    userId: string,
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPostRow[]> {
    return this.repository.getScheduledPostsByUser(userId, status);
  }

  /**
   * Retrieves scheduled posts for an announcement
   * @param announcementId - ID of the announcement
   * @param userId - ID of the authenticated user
   * @returns Array of scheduled posts
   * @throws Error if user doesn't own the announcement
   */
  async getScheduledPostsByAnnouncement(
    announcementId: number,
    userId: string
  ): Promise<ScheduledPostRow[]> {
    // Validate announcement ownership
    await this.getAnnouncementAndValidateOwnership(announcementId, userId);

    return this.repository.getScheduledPostsByAnnouncement(announcementId);
  }

  /**
   * Retrieves scheduled posts for an event
   * @param eventId - ID of the event
   * @param userId - ID of the authenticated user
   * @param status - Optional status filter
   * @returns Array of scheduled posts
   * @throws Error if user doesn't own the event
   */
  async getScheduledPostsByEvent(
    eventId: number,
    userId: string,
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPostRow[]> {
    // Verify event ownership
    await this.validateEventOwnership(eventId, userId);

    return this.repository.getScheduledPostsByEvent(eventId, status);
  }

  /**
   * Updates a scheduled post
   * @param id - ID of the scheduled post
   * @param userId - ID of the authenticated user
   * @param updates - Fields to update
   * @returns The updated scheduled post
   * @throws Error if validation fails or unauthorized
   */
  async updateScheduledPost(
    id: number,
    userId: string,
    updates: UpdateScheduledPostParams
  ): Promise<ScheduledPostRow> {
    // Verify ownership
    const belongsToUser = await this.repository.scheduledPostBelongsToUser(
      id,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Unauthorized: Scheduled post not found or you don't own it"
      );
    }

    // Validate scheduled time if being updated
    if (updates.scheduledTime) {
      const scheduledDate = new Date(updates.scheduledTime);
      const now = new Date();

      if (scheduledDate <= now) {
        throw new Error("Scheduled time must be in the future");
      }
    }

    // Prevent updating certain fields for non-pending posts
    const currentPost = await this.repository.getScheduledPostById(id);
    if (currentPost && currentPost.status !== "pending") {
      if (
        updates.scheduledTime ||
        updates.imageUrl !== undefined ||
        updates.timezone
      ) {
        throw new Error(
          `Cannot update scheduled time or image for ${currentPost.status} posts`
        );
      }
    }

    const updatedPost = await this.repository.updateScheduledPost(id, updates);

    if (!updatedPost) {
      throw new Error("Failed to update scheduled post");
    }

    return updatedPost;
  }

  /**
   * Cancels a scheduled post
   * @param id - ID of the scheduled post
   * @param userId - ID of the authenticated user
   * @returns The cancelled scheduled post
   * @throws Error if unauthorized or post already posted
   */
  async cancelScheduledPost(
    id: number,
    userId: string
  ): Promise<ScheduledPostRow> {
    // Verify ownership
    const belongsToUser = await this.repository.scheduledPostBelongsToUser(
      id,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Unauthorized: Scheduled post not found or you don't own it"
      );
    }

    // Check current status
    const currentPost = await this.repository.getScheduledPostById(id);
    if (currentPost?.status === "posted") {
      throw new Error("Cannot cancel a post that has already been posted");
    }

    if (currentPost?.status === "cancelled") {
      throw new Error("Post is already cancelled");
    }

    const cancelledPost = await this.repository.markAsCancelled(id);

    if (!cancelledPost) {
      throw new Error("Failed to cancel scheduled post");
    }

    return cancelledPost;
  }

  /**
   * Deletes a scheduled post
   * @param id - ID of the scheduled post
   * @param userId - ID of the authenticated user
   * @returns True if deleted successfully
   * @throws Error if unauthorized
   */
  async deleteScheduledPost(id: number, userId: string): Promise<boolean> {
    // Verify ownership
    const belongsToUser = await this.repository.scheduledPostBelongsToUser(
      id,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Unauthorized: Scheduled post not found or you don't own it"
      );
    }

    return this.repository.deleteScheduledPost(id);
  }

  /**
   * Marks a scheduled post as posted (internal use for cron job)
   * @param id - ID of the scheduled post
   * @param postUrn - Platform post URN/ID
   * @returns The updated scheduled post
   */
  async markAsPosted(id: number, postUrn: string): Promise<ScheduledPostRow> {
    const updatedPost = await this.repository.markAsPosted(id, postUrn);

    if (!updatedPost) {
      throw new Error("Failed to mark scheduled post as posted");
    }

    return updatedPost;
  }

  /**
   * Marks a scheduled post as failed (internal use for cron job)
   * @param id - ID of the scheduled post
   * @param errorMessage - Error message
   * @returns The updated scheduled post
   */
  async markAsFailed(
    id: number,
    errorMessage: string
  ): Promise<ScheduledPostRow> {
    const updatedPost = await this.repository.markAsFailed(id, errorMessage);

    if (!updatedPost) {
      throw new Error("Failed to mark scheduled post as failed");
    }

    return updatedPost;
  }

  /**
   * Retrieves pending posts ready to be published (for cron job)
   * @param beforeTime - Optional cutoff time (defaults to now)
   * @param limit - Optional limit
   * @returns Array of pending scheduled posts
   */
  async getPendingScheduledPosts(
    beforeTime?: string,
    limit?: number
  ): Promise<ScheduledPostRow[]> {
    return this.repository.getPendingScheduledPosts(beforeTime, limit);
  }

  /**
   * Retrieves scheduled posts by platform
   * @param userId - ID of the user
   * @param platform - Social media platform
   * @param status - Optional status filter
   * @returns Array of scheduled posts
   */
  async getScheduledPostsByPlatform(
    userId: string,
    platform: "linkedin" | "twitter" | "instagram",
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPostRow[]> {
    return this.repository.getScheduledPostsByPlatform(userId, platform, status);
  }

  // ========== PRIVATE VALIDATION METHODS ==========

  /**
   * Fetches announcement and validates user ownership
   * @private
   * @throws Error if announcement not found or user doesn't own it
   */
  private async getAnnouncementAndValidateOwnership(
    announcementId: number,
    userId: string
  ): Promise<AnnouncementRow> {
    const { data: announcement, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("id", announcementId)
      .single();

    if (error || !announcement) {
      throw new Error("Announcement not found");
    }

    if (announcement.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this announcement");
    }

    return announcement;
  }

  /**
   * Validates that an event belongs to the user
   * @private
   */
  private async validateEventOwnership(
    eventId: number,
    userId: string
  ): Promise<void> {
    const { data: event, error } = await this.supabase
      .from("events")
      .select("user_id")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      throw new Error("Event not found");
    }

    if (event.user_id !== userId) {
      throw new Error("Unauthorized: You don't own this event");
    }
  }
}
