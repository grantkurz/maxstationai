import { Database } from "@/types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";

type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
type AnnouncementInsert = Database["public"]["Tables"]["announcements"]["Insert"];
type AnnouncementUpdate = Database["public"]["Tables"]["announcements"]["Update"];

/**
 * Repository layer for announcement data access
 * Handles all database operations for the announcements table
 */
export class AnnouncementRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Creates a new announcement in the database
   * @param data - Announcement data to insert
   * @returns The created announcement or null if failed
   * @throws Error if database operation fails
   */
  async createAnnouncement(
    data: AnnouncementInsert
  ): Promise<AnnouncementRow | null> {
    const { data: announcement, error } = await this.supabase
      .from("announcements")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating announcement:", error);
      throw new Error(`Failed to create announcement: ${error.message}`);
    }

    return announcement;
  }

  /**
   * Retrieves all announcements for a specific speaker
   * @param speakerId - ID of the speaker
   * @returns Array of announcements or empty array
   */
  async getAnnouncementsBySpeaker(
    speakerId: number
  ): Promise<AnnouncementRow[]> {
    const { data: announcements, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("speaker_id", speakerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching announcements by speaker:", error);
      throw new Error(
        `Failed to fetch announcements for speaker: ${error.message}`
      );
    }

    return announcements || [];
  }

  /**
   * Retrieves all announcements for a specific event
   * @param eventId - ID of the event
   * @returns Array of announcements or empty array
   */
  async getAnnouncementsByEvent(eventId: number): Promise<AnnouncementRow[]> {
    const { data: announcements, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching announcements by event:", error);
      throw new Error(
        `Failed to fetch announcements for event: ${error.message}`
      );
    }

    return announcements || [];
  }

  /**
   * Retrieves all announcements for the authenticated user
   * @param userId - ID of the user
   * @returns Array of announcements or empty array
   */
  async getAnnouncementsByUser(userId: string): Promise<AnnouncementRow[]> {
    const { data: announcements, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching announcements by user:", error);
      throw new Error(
        `Failed to fetch announcements for user: ${error.message}`
      );
    }

    return announcements || [];
  }

  /**
   * Retrieves a single announcement by ID
   * @param id - ID of the announcement
   * @returns The announcement or null if not found
   */
  async getAnnouncementById(id: number): Promise<AnnouncementRow | null> {
    const { data: announcement, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Not found errors are expected, don't log
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching announcement by ID:", error);
      throw new Error(`Failed to fetch announcement: ${error.message}`);
    }

    return announcement;
  }

  /**
   * Updates an existing announcement
   * @param id - ID of the announcement to update
   * @param updates - Partial announcement data to update
   * @returns The updated announcement or null if failed
   */
  async updateAnnouncement(
    id: number,
    updates: AnnouncementUpdate
  ): Promise<AnnouncementRow | null> {
    const { data: announcement, error } = await this.supabase
      .from("announcements")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating announcement:", error);
      throw new Error(`Failed to update announcement: ${error.message}`);
    }

    return announcement;
  }

  /**
   * Deletes an announcement by ID
   * @param id - ID of the announcement to delete
   * @returns True if deleted successfully
   */
  async deleteAnnouncement(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting announcement:", error);
      throw new Error(`Failed to delete announcement: ${error.message}`);
    }

    return true;
  }

  /**
   * Retrieves announcements filtered by platform
   * @param userId - ID of the user
   * @param platform - Social media platform
   * @returns Array of announcements or empty array
   */
  async getAnnouncementsByPlatform(
    userId: string,
    platform: "linkedin" | "twitter" | "instagram"
  ): Promise<AnnouncementRow[]> {
    const { data: announcements, error } = await this.supabase
      .from("announcements")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", platform)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching announcements by platform:", error);
      throw new Error(
        `Failed to fetch announcements for platform: ${error.message}`
      );
    }

    return announcements || [];
  }

  /**
   * Checks if an announcement exists and belongs to the user
   * @param id - ID of the announcement
   * @param userId - ID of the user
   * @returns True if announcement exists and belongs to user
   */
  async announcementBelongsToUser(
    id: number,
    userId: string
  ): Promise<boolean> {
    const { data: announcement, error } = await this.supabase
      .from("announcements")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !announcement) {
      return false;
    }

    return true;
  }
}
