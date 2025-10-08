import { Database } from "@/types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";

type ScheduledPostRow = Database["public"]["Tables"]["scheduled_posts"]["Row"];
type ScheduledPostInsert = Database["public"]["Tables"]["scheduled_posts"]["Insert"];
type ScheduledPostUpdate = Database["public"]["Tables"]["scheduled_posts"]["Update"];

/**
 * Repository layer for scheduled post data access
 * Handles all database operations for the scheduled_posts table
 */
export class ScheduledPostRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Creates a new scheduled post in the database
   * @param data - Scheduled post data to insert
   * @returns The created scheduled post or null if failed
   * @throws Error if database operation fails
   */
  async createScheduledPost(
    data: ScheduledPostInsert
  ): Promise<ScheduledPostRow | null> {
    const { data: scheduledPost, error } = await this.supabase
      .from("scheduled_posts")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating scheduled post:", error);
      throw new Error(`Failed to create scheduled post: ${error.message}`);
    }

    return scheduledPost;
  }

  /**
   * Retrieves a single scheduled post by ID
   * @param id - ID of the scheduled post
   * @returns The scheduled post or null if not found
   */
  async getScheduledPostById(id: number): Promise<ScheduledPostRow | null> {
    const { data: scheduledPost, error } = await this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Not found errors are expected, don't log
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching scheduled post by ID:", error);
      throw new Error(`Failed to fetch scheduled post: ${error.message}`);
    }

    return scheduledPost;
  }

  /**
   * Retrieves all scheduled posts for a user
   * @param userId - ID of the user
   * @param status - Optional status filter
   * @returns Array of scheduled posts
   */
  async getScheduledPostsByUser(
    userId: string,
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPostRow[]> {
    let query = this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", userId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: scheduledPosts, error } = await query.order("scheduled_time", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching scheduled posts by user:", error);
      throw new Error(
        `Failed to fetch scheduled posts for user: ${error.message}`
      );
    }

    return scheduledPosts || [];
  }

  /**
   * Retrieves all scheduled posts for an announcement
   * @param announcementId - ID of the announcement
   * @returns Array of scheduled posts
   */
  async getScheduledPostsByAnnouncement(
    announcementId: number
  ): Promise<ScheduledPostRow[]> {
    const { data: scheduledPosts, error } = await this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("announcement_id", announcementId)
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error("Error fetching scheduled posts by announcement:", error);
      throw new Error(
        `Failed to fetch scheduled posts for announcement: ${error.message}`
      );
    }

    return scheduledPosts || [];
  }

  /**
   * Retrieves all scheduled posts for an event
   * @param eventId - ID of the event
   * @param status - Optional status filter
   * @returns Array of scheduled posts
   */
  async getScheduledPostsByEvent(
    eventId: number,
    status?: "pending" | "posted" | "failed" | "cancelled"
  ): Promise<ScheduledPostRow[]> {
    let query = this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("event_id", eventId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: scheduledPosts, error } = await query.order("scheduled_time", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching scheduled posts by event:", error);
      throw new Error(
        `Failed to fetch scheduled posts for event: ${error.message}`
      );
    }

    return scheduledPosts || [];
  }

  /**
   * Retrieves pending scheduled posts that are ready to be posted
   * Used by cron job to find posts that need to be published
   *
   * @param beforeTime - Optional ISO timestamp - get posts scheduled before this time (defaults to now)
   * @param limit - Optional limit on number of posts to retrieve
   * @returns Array of pending scheduled posts ready to be posted
   */
  async getPendingScheduledPosts(
    beforeTime?: string,
    limit?: number
  ): Promise<ScheduledPostRow[]> {
    const cutoffTime = beforeTime || new Date().toISOString();

    let query = this.supabase
      .from("scheduled_posts")
      .select("*")
      .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.3)`)
      .lte("scheduled_time", cutoffTime)
      .order("scheduled_time", { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: scheduledPosts, error } = await query;

    if (error) {
      console.error("Error fetching pending scheduled posts:", error);
      throw new Error(`Failed to fetch pending scheduled posts: ${error.message}`);
    }

    return scheduledPosts || [];
  }

  /**
   * Updates an existing scheduled post
   * @param id - ID of the scheduled post to update
   * @param updates - Partial scheduled post data to update
   * @returns The updated scheduled post or null if failed
   */
  async updateScheduledPost(
    id: number,
    updates: ScheduledPostUpdate
  ): Promise<ScheduledPostRow | null> {
    const { data: scheduledPost, error } = await this.supabase
      .from("scheduled_posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating scheduled post:", error);
      throw new Error(`Failed to update scheduled post: ${error.message}`);
    }

    return scheduledPost;
  }

  /**
   * Marks a scheduled post as posted with the LinkedIn URN
   * @param id - ID of the scheduled post
   * @param postUrn - LinkedIn URN or platform post ID
   * @returns The updated scheduled post
   */
  async markAsPosted(
    id: number,
    postUrn: string
  ): Promise<ScheduledPostRow | null> {
    return this.updateScheduledPost(id, {
      status: "posted",
      posted_at: new Date().toISOString(),
      posted_urn: postUrn,
      error_message: null, // Clear any previous errors
    });
  }

  /**
   * Marks a scheduled post as failed with error message
   * @param id - ID of the scheduled post
   * @param errorMessage - Error message describing the failure
   * @returns The updated scheduled post
   */
  async markAsFailed(
    id: number,
    errorMessage: string
  ): Promise<ScheduledPostRow | null> {
    // Get current retry count
    const currentPost = await this.getScheduledPostById(id);
    const retryCount = (currentPost?.retry_count || 0) + 1;

    return this.updateScheduledPost(id, {
      status: "failed",
      error_message: errorMessage,
      retry_count: retryCount,
      last_retry_at: new Date().toISOString(),
    });
  }

  /**
   * Marks a scheduled post as cancelled
   * @param id - ID of the scheduled post
   * @returns The updated scheduled post
   */
  async markAsCancelled(id: number): Promise<ScheduledPostRow | null> {
    return this.updateScheduledPost(id, {
      status: "cancelled",
    });
  }

  /**
   * Deletes a scheduled post by ID
   * @param id - ID of the scheduled post to delete
   * @returns True if deleted successfully
   */
  async deleteScheduledPost(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting scheduled post:", error);
      throw new Error(`Failed to delete scheduled post: ${error.message}`);
    }

    return true;
  }

  /**
   * Checks if a scheduled post exists and belongs to the user
   * @param id - ID of the scheduled post
   * @param userId - ID of the user
   * @returns True if scheduled post exists and belongs to user
   */
  async scheduledPostBelongsToUser(
    id: number,
    userId: string
  ): Promise<boolean> {
    const { data: scheduledPost, error } = await this.supabase
      .from("scheduled_posts")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !scheduledPost) {
      return false;
    }

    return true;
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
    let query = this.supabase
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: scheduledPosts, error } = await query.order("scheduled_time", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching scheduled posts by platform:", error);
      throw new Error(
        `Failed to fetch scheduled posts for platform: ${error.message}`
      );
    }

    return scheduledPosts || [];
  }

  /**
   * Checks if an announcement already has a scheduled post for the same platform and time
   * Useful for preventing duplicate scheduling
   *
   * @param announcementId - ID of the announcement
   * @param platform - Social media platform
   * @param scheduledTime - Scheduled time
   * @returns True if a duplicate exists
   */
  async hasDuplicateSchedule(
    announcementId: number,
    platform: "linkedin" | "twitter" | "instagram",
    scheduledTime: string
  ): Promise<boolean> {
    const { data: scheduledPosts, error } = await this.supabase
      .from("scheduled_posts")
      .select("id")
      .eq("announcement_id", announcementId)
      .eq("platform", platform)
      .eq("scheduled_time", scheduledTime)
      .eq("status", "pending");

    if (error) {
      console.error("Error checking for duplicate schedule:", error);
      return false;
    }

    return (scheduledPosts?.length || 0) > 0;
  }
}
