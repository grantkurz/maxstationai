import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { ANTHROPIC_MODELS } from "@/constants";
import { speakerAnnouncementPrompt } from "@/app/prompts/announcements/speaker-announcement";

export const dynamic = "force-dynamic";

type SpeakerType = Database["public"]["Tables"]["speakers"]["Row"];
type EventType = Database["public"]["Tables"]["events"]["Row"];

interface GenerateAnnouncementRequest {
  speaker: SpeakerType;
  event: EventType;
  platform?: "linkedin" | "twitter" | "instagram";
  template?: "pre-event" | "day-of" | "post-event" | "custom";
}

/**
 * POST /api/announcements/generate
 * Generates AI-powered speaker announcements for social media
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
    const body: GenerateAnnouncementRequest = await req.json();
    const { speaker, event, platform = "linkedin", template = "pre-event" } = body;

    // Validate required fields
    if (!speaker?.name || !speaker?.session_title || !event?.title) {
      return NextResponse.json(
        { error: "Missing required speaker or event information" },
        { status: 400 }
      );
    }

    // Build the prompt using the speaker announcement template
    const prompt = speakerAnnouncementPrompt(speaker, event);

    // Generate announcement using Claude
    const { text } = await generateText({
      model: anthropic(ANTHROPIC_MODELS["claude-sonnet-4.5"]),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      maxTokens: 2048,
    });

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Failed to generate announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      announcement: text.trim(),
      platform,
      template,
      characterCount: text.trim().length,
    });
  } catch (error) {
    console.error("Error generating announcement:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to generate announcement: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate announcement" },
      { status: 500 }
    );
  }
}

