import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { ANTHROPIC_MODELS } from "@/constants";

export const dynamic = "force-dynamic";

/**
 * Zod schema for speaker data extraction
 */
const SpeakerSchema = z.object({
  name: z.string().describe("The full name of the speaker"),
  speaker_title: z.string().describe("The speaker's job title, role, or professional designation"),
  speaker_bio: z.string().describe("A biography or description of the speaker's background and expertise"),
  session_title: z.string().describe("The title of the talk, session, or presentation"),
  session_description: z.string().describe("A description of what the session or talk will cover"),
});

export type SpeakerData = z.infer<typeof SpeakerSchema>;

/**
 * POST /api/parse-speaker-text
 * Parses raw text into structured speaker and session data using Claude AI
 *
 * @param req - NextRequest with JSON body containing text to parse
 * @returns JSON with structured speaker data or error
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

  // Validate API key configuration
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI service not configured. Missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing required field: text (string)" },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text cannot be empty" },
        { status: 400 }
      );
    }

    // Parse text into structured speaker data using Claude AI
    const { object } = await generateObject({
      model: anthropic(ANTHROPIC_MODELS["claude-sonnet-4.5"]),
      schema: SpeakerSchema,
      messages: [
        {
          role: "user",
          content: `Parse the following text and extract speaker and session information. If any field cannot be found in the text, provide an empty string for that field.

Text to parse:
${text}

Extract the following information:
- Speaker name
- Speaker title/role
- Speaker biography
- Session/talk title
- Session/talk description`,
        },
      ],
    });

    // Validate that we got some meaningful data
    const hasData = Object.values(object).some(
      (value) => value && value.trim().length > 0
    );

    if (!hasData) {
      return NextResponse.json(
        { error: "Could not extract any speaker information from the provided text" },
        { status: 400 }
      );
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error parsing speaker text:", error);

    if (error instanceof Error) {
      // Check for JSON parsing errors
      if (error.message.includes("JSON")) {
        return NextResponse.json(
          { error: "Invalid request body. Expected JSON with a 'text' field." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Failed to parse speaker text: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to parse speaker text" },
      { status: 500 }
    );
  }
}
