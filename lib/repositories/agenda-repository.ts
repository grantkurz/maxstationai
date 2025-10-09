import { Database } from "@/types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";

type AgendaRow = Database["public"]["Tables"]["event_agendas"]["Row"];
type AgendaInsert = Database["public"]["Tables"]["event_agendas"]["Insert"];
type AgendaUpdate = Database["public"]["Tables"]["event_agendas"]["Update"];

/**
 * Repository layer for event agenda data access
 * Handles all database operations for the event_agendas table
 */
export class AgendaRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Creates a new agenda for an event
   * @param data - Agenda data to insert
   * @returns The created agenda or null if failed
   * @throws Error if database operation fails
   */
  async createAgenda(data: AgendaInsert): Promise<AgendaRow | null> {
    const { data: agenda, error } = await this.supabase
      .from("event_agendas")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error creating agenda:", error);
      throw new Error(`Failed to create agenda: ${error.message}`);
    }

    return agenda;
  }

  /**
   * Retrieves the latest agenda for a specific event
   * @param eventId - ID of the event
   * @returns The latest agenda or null if not found
   */
  async getLatestAgendaByEvent(eventId: number): Promise<AgendaRow | null> {
    const { data: agenda, error } = await this.supabase
      .from("event_agendas")
      .select("*")
      .eq("event_id", eventId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Not found errors are expected for events without agendas
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching latest agenda:", error);
      throw new Error(`Failed to fetch latest agenda: ${error.message}`);
    }

    return agenda;
  }

  /**
   * Retrieves all agendas for a specific event (all versions)
   * @param eventId - ID of the event
   * @returns Array of agendas ordered by version (newest first)
   */
  async getAllAgendasByEvent(eventId: number): Promise<AgendaRow[]> {
    const { data: agendas, error } = await this.supabase
      .from("event_agendas")
      .select("*")
      .eq("event_id", eventId)
      .order("version", { ascending: false });

    if (error) {
      console.error("Error fetching agendas by event:", error);
      throw new Error(`Failed to fetch agendas for event: ${error.message}`);
    }

    return agendas || [];
  }

  /**
   * Retrieves a specific agenda by ID
   * @param id - ID of the agenda
   * @returns The agenda or null if not found
   */
  async getAgendaById(id: number): Promise<AgendaRow | null> {
    const { data: agenda, error } = await this.supabase
      .from("event_agendas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      // Not found errors are expected
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching agenda by ID:", error);
      throw new Error(`Failed to fetch agenda: ${error.message}`);
    }

    return agenda;
  }

  /**
   * Updates an existing agenda
   * @param id - ID of the agenda to update
   * @param updates - Partial agenda data to update
   * @returns The updated agenda or null if failed
   */
  async updateAgenda(
    id: number,
    updates: AgendaUpdate
  ): Promise<AgendaRow | null> {
    const { data: agenda, error } = await this.supabase
      .from("event_agendas")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating agenda:", error);
      throw new Error(`Failed to update agenda: ${error.message}`);
    }

    return agenda;
  }

  /**
   * Deletes an agenda by ID
   * @param id - ID of the agenda to delete
   * @returns True if deleted successfully
   */
  async deleteAgenda(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from("event_agendas")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting agenda:", error);
      throw new Error(`Failed to delete agenda: ${error.message}`);
    }

    return true;
  }

  /**
   * Gets the next version number for an event's agenda
   * @param eventId - ID of the event
   * @returns The next version number (1 if no previous agendas exist)
   */
  async getNextVersionNumber(eventId: number): Promise<number> {
    const { data: agendas, error } = await this.supabase
      .from("event_agendas")
      .select("version")
      .eq("event_id", eventId)
      .order("version", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching version number:", error);
      throw new Error(`Failed to fetch version number: ${error.message}`);
    }

    if (!agendas || agendas.length === 0) {
      return 1;
    }

    return (agendas[0].version || 0) + 1;
  }

  /**
   * Marks an agenda as published
   * @param id - ID of the agenda
   * @returns The updated agenda or null if failed
   */
  async markAsPublished(id: number): Promise<AgendaRow | null> {
    return this.updateAgenda(id, {
      is_published: true,
      published_at: new Date().toISOString(),
    });
  }

  /**
   * Retrieves all published agendas for a user
   * @param userId - ID of the user
   * @returns Array of published agendas
   */
  async getPublishedAgendasByUser(userId: string): Promise<AgendaRow[]> {
    const { data: agendas, error } = await this.supabase
      .from("event_agendas")
      .select("*")
      .eq("user_id", userId)
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching published agendas:", error);
      throw new Error(`Failed to fetch published agendas: ${error.message}`);
    }

    return agendas || [];
  }

  /**
   * Checks if an agenda exists and belongs to the user
   * @param id - ID of the agenda
   * @param userId - ID of the user
   * @returns True if agenda exists and belongs to user
   */
  async agendaBelongsToUser(id: number, userId: string): Promise<boolean> {
    const { data: agenda, error } = await this.supabase
      .from("event_agendas")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !agenda) {
      return false;
    }

    return true;
  }

  /**
   * Updates the event page URL for an event
   * @param eventId - ID of the event
   * @param eventPageUrl - The event page URL (e.g., luma.com/x123)
   * @returns True if updated successfully
   */
  async updateEventPageUrl(
    eventId: number,
    eventPageUrl: string
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from("events")
      .update({ ticket_url: eventPageUrl })
      .eq("id", eventId);

    if (error) {
      console.error("Error updating event page URL:", error);
      throw new Error(`Failed to update event page URL: ${error.message}`);
    }

    return true;
  }
}
