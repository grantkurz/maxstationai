import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_MODELS } from "@/constants";
import { speakerAnnouncementPrompt } from "@/app/prompts/announcements/speaker-announcement";
import { speakerAnnouncementReminderPrompt } from "@/app/prompts/announcements/speaker-announcement-reminder";

export const dynamic = "force-dynamic";

interface PreviewContentRequest {
  eventId: number;
  speakerIds: number[];
  daysUntilEvent: number[]; // Parallel array with speakerIds
  platform?: "linkedin" | "twitter" | "instagram" | "all";
}

interface SpeakerPreview {
  speakerId: number;
  speakerName: string;
  daysUntilEvent: number;
  generatedAnnouncement: string;
  characterCount: number;
  hasExistingAnnouncement: boolean;
  imageUrl: string | null;
}

/**
 * POST /api/drip-campaigns/preview-content
 * Generate AI preview of announcement content for drip campaign speakers
 * This is called optionally by users who want to see the actual AI-generated content before scheduling
 */
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI service not configured. Missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const body: PreviewContentRequest = await req.json();
    const { eventId, speakerIds, daysUntilEvent, platform: platformParam = "linkedin" } = body;

    // For "all", use LinkedIn as the sample platform (content is similar across platforms)
    const platform = platformParam === "all" ? "linkedin" : platformParam;

    if (!eventId || !speakerIds || !daysUntilEvent) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (speakerIds.length !== daysUntilEvent.length) {
      return NextResponse.json(
        { error: "speakerIds and daysUntilEvent arrays must have same length" },
        { status: 400 }
      );
    }

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found or access denied" },
        { status: 404 }
      );
    }

    const previews: SpeakerPreview[] = [];

    // Generate preview for each speaker
    for (let i = 0; i < speakerIds.length; i++) {
      const speakerId = speakerIds[i];
      const days = daysUntilEvent[i];

      try {
        // Fetch speaker
        const { data: speaker, error: speakerError } = await supabase
          .from("speakers")
          .select("*")
          .eq("id", speakerId)
          .single();

        if (speakerError || !speaker) {
          console.error(`Failed to fetch speaker ${speakerId}`);
          continue;
        }

        // Fetch speaker's primary image
        const { data: images } = await supabase
          .from("speaker_images")
          .select("*")
          .eq("speaker_id", speakerId)
          .eq("is_primary", true)
          .limit(1);

        const primaryImageUrl = images && images.length > 0 ? images[0].public_url : null;

        // Check for existing announcement
        let initialAnnouncement: string;
        let hasExisting = false;

        const { data: existingAnnouncements } = await supabase
          .from("announcements")
          .select("*")
          .eq("speaker_id", speakerId)
          .eq("platform", platform)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingAnnouncements && existingAnnouncements.length > 0) {
          // Use existing announcement as reference
          initialAnnouncement = existingAnnouncements[0].announcement_text;
          hasExisting = true;
        } else {
          // Generate initial announcement for reference
          const initialPrompt = speakerAnnouncementPrompt(speaker, event);
          const { text: generatedInitial } = await generateText({
            model: anthropic(ANTHROPIC_MODELS["claude-opus-4.1"]),
            messages: [{ role: "user", content: initialPrompt }],
          });
          initialAnnouncement = generatedInitial.trim();
        }

        // Generate reminder announcement
        const reminderPrompt = speakerAnnouncementReminderPrompt(
          speaker,
          event,
          days,
          initialAnnouncement
        );

        const { text: reminderText } = await generateText({
          model: anthropic(ANTHROPIC_MODELS["claude-opus-4.1"]),
          messages: [{ role: "user", content: reminderPrompt }],
        });

        const generatedAnnouncement = reminderText.trim();

        previews.push({
          speakerId,
          speakerName: speaker.name,
          daysUntilEvent: days,
          generatedAnnouncement,
          characterCount: generatedAnnouncement.length,
          hasExistingAnnouncement: hasExisting,
          imageUrl: primaryImageUrl,
        });
      } catch (error) {
        console.error(`Error generating preview for speaker ${speakerId}:`, error);
        // Continue with other speakers even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      previews,
      totalGenerated: previews.length,
    });
  } catch (error) {
    console.error("Error generating content preview:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to generate preview: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
