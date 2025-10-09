import { Database } from "@/types/supabase";
import { AgendaRepository } from "@/lib/repositories/agenda-repository";
import { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { ANTHROPIC_MODELS } from "@/constants";
import { landingPageAgendaPrompt } from "@/app/prompts/announcements/landing-page-agenda";

type AgendaRow = Database["public"]["Tables"]["event_agendas"]["Row"];
type SpeakerRow = Database["public"]["Tables"]["speakers"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface GenerateAgendaParams {
  eventId: number;
  userId: string;
  format?: "markdown" | "html" | "plain";
  speakerIds?: number[]; // Optional: specific speakers to include
}

interface UpdateEventPageUrlParams {
  eventId: number;
  eventPageUrl: string;
  userId: string;
}

/**
 * Service layer for event agenda business logic
 * Handles validation, AI generation, and orchestrates repository operations
 */
export class AgendaService {
  private repository: AgendaRepository;

  constructor(private supabase: SupabaseClient<Database>) {
    this.repository = new AgendaRepository(supabase);
  }

  /**
   * Generates a new agenda for an event using AI
   * @param params - Parameters for generating agenda
   * @returns The created agenda
   * @throws Error if validation fails or user doesn't own the event
   */
  async generateAgenda(params: GenerateAgendaParams): Promise<AgendaRow> {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("AI service not configured. Missing ANTHROPIC_API_KEY.");
    }

    // Validate event ownership
    const event = await this.validateEventOwnership(
      params.eventId,
      params.userId
    );

    // Fetch speakers for the event
    const speakers = await this.fetchSpeakersForEvent(
      params.eventId,
      params.speakerIds
    );

    if (!speakers || speakers.length === 0) {
      throw new Error(
        "Cannot generate agenda for event with no speakers. Please add speakers first."
      );
    }

    // Build the AI prompt
    const prompt = landingPageAgendaPrompt(speakers, event);

    // Generate agenda using Claude
    const { text } = await generateText({
      model: anthropic(ANTHROPIC_MODELS["claude-sonnet-4.5"]),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    if (!text || text.trim().length === 0) {
      throw new Error("Failed to generate agenda");
    }

    const agendaText = text.trim();

    // Get next version number
    const nextVersion = await this.repository.getNextVersionNumber(
      params.eventId
    );

    // Create agenda data
    const agenda = await this.repository.createAgenda({
      event_id: params.eventId,
      user_id: params.userId,
      agenda_text: agendaText,
      agenda_format: params.format || "markdown",
      version: nextVersion,
      included_speaker_ids: speakers.map((s) => s.id),
    });

    if (!agenda) {
      throw new Error("Failed to save generated agenda");
    }

    return agenda;
  }

  /**
   * Retrieves the latest agenda for an event
   * @param eventId - ID of the event
   * @param userId - ID of the authenticated user
   * @returns The latest agenda or null if none exists
   */
  async getLatestAgenda(
    eventId: number,
    userId: string
  ): Promise<AgendaRow | null> {
    // Validate event ownership
    await this.validateEventOwnership(eventId, userId);

    return this.repository.getLatestAgendaByEvent(eventId);
  }

  /**
   * Retrieves all agenda versions for an event
   * @param eventId - ID of the event
   * @param userId - ID of the authenticated user
   * @returns Array of agendas ordered by version
   */
  async getAllAgendaVersions(
    eventId: number,
    userId: string
  ): Promise<AgendaRow[]> {
    // Validate event ownership
    await this.validateEventOwnership(eventId, userId);

    return this.repository.getAllAgendasByEvent(eventId);
  }

  /**
   * Marks an agenda as published
   * @param agendaId - ID of the agenda
   * @param userId - ID of the authenticated user
   * @returns The updated agenda
   */
  async publishAgenda(agendaId: number, userId: string): Promise<AgendaRow> {
    // Validate agenda ownership
    const belongsToUser = await this.repository.agendaBelongsToUser(
      agendaId,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Agenda not found or you don't have permission to publish it"
      );
    }

    const agenda = await this.repository.markAsPublished(agendaId);

    if (!agenda) {
      throw new Error("Failed to publish agenda");
    }

    return agenda;
  }

  /**
   * Updates the event page URL for an event
   * @param params - Parameters for updating event page URL
   * @returns True if successful
   */
  async updateEventPageUrl(
    params: UpdateEventPageUrlParams
  ): Promise<boolean> {
    // Validate event ownership
    await this.validateEventOwnership(params.eventId, params.userId);

    // Validate URL format
    this.validateEventPageUrl(params.eventPageUrl);

    return this.repository.updateEventPageUrl(
      params.eventId,
      params.eventPageUrl
    );
  }

  /**
   * Deletes an agenda
   * @param agendaId - ID of the agenda to delete
   * @param userId - ID of the authenticated user
   * @returns True if successful
   */
  async deleteAgenda(agendaId: number, userId: string): Promise<boolean> {
    // Validate agenda ownership
    const belongsToUser = await this.repository.agendaBelongsToUser(
      agendaId,
      userId
    );

    if (!belongsToUser) {
      throw new Error(
        "Agenda not found or you don't have permission to delete it"
      );
    }

    return this.repository.deleteAgenda(agendaId);
  }

  // Private helper methods

  /**
   * Validates that the user owns the specified event
   * @throws Error if event doesn't exist or user doesn't own it
   */
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

  /**
   * Fetches speakers for an event, optionally filtered by speaker IDs
   * @param eventId - ID of the event
   * @param speakerIds - Optional array of specific speaker IDs to include
   * @returns Array of speakers
   */
  private async fetchSpeakersForEvent(
    eventId: number,
    speakerIds?: number[]
  ): Promise<SpeakerRow[]> {
    let query = this.supabase
      .from("speakers")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    // If specific speaker IDs are provided, filter by them
    if (speakerIds && speakerIds.length > 0) {
      query = query.in("id", speakerIds);
    }

    const { data: speakers, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch speakers: ${error.message}`);
    }

    return speakers || [];
  }

  /**
   * Validates event page URL format
   * @param url - The URL to validate
   * @throws Error if URL is invalid
   */
  private validateEventPageUrl(url: string): void {
    if (!url || url.trim().length === 0) {
      throw new Error("Event page URL cannot be empty");
    }

    // Basic URL validation - can be enhanced
    const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/;

    if (!urlPattern.test(url.trim())) {
      throw new Error("Invalid event page URL format");
    }

    // Check for common event platforms (optional - can be removed if too restrictive)
    const validPlatforms = [
      "lu.ma",
      "luma.com",
      "eventbrite.com",
      "meetup.com",
      "partiful.com",
      "hopin.com",
    ];

    const urlLower = url.toLowerCase();
    const isKnownPlatform = validPlatforms.some((platform) =>
      urlLower.includes(platform)
    );

    // Allow any URL, just warn if not a known platform (could log this)
    if (!isKnownPlatform) {
      console.warn(
        `Event page URL doesn't match known platforms: ${url}. This is allowed but may not integrate with future push features.`
      );
    }
  }
}
