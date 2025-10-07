import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AnnouncementService } from "@/lib/services/announcement-service";

export const dynamic = "force-dynamic";

interface SaveAnnouncementRequest {
  speaker_id: number;
  event_id: number;
  announcement_text: string;
  platform: "linkedin" | "twitter" | "instagram";
  template: "pre-event" | "day-of" | "post-event" | "custom";
}

/**
 * POST /api/announcements
 * Saves a speaker announcement to the database
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

  try {
    const body: SaveAnnouncementRequest = await req.json();
    const { speaker_id, event_id, announcement_text, platform, template } = body;

    // Validate required fields
    if (!speaker_id || !event_id || !announcement_text || !platform || !template) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ["linkedin", "twitter", "instagram"];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be one of: linkedin, twitter, instagram" },
        { status: 400 }
      );
    }

    // Validate template
    const validTemplates = ["pre-event", "day-of", "post-event", "custom"];
    if (!validTemplates.includes(template)) {
      return NextResponse.json(
        { error: "Invalid template. Must be one of: pre-event, day-of, post-event, custom" },
        { status: 400 }
      );
    }

    // Use service layer for business logic and validation
    const announcementService = new AnnouncementService(supabase);

    const announcement = await announcementService.createAnnouncement({
      speakerId: speaker_id,
      eventId: event_id,
      announcementText: announcement_text,
      platform,
      template,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      announcement,
    });
  } catch (error) {
    console.error("Error in save announcement API:", error);

    if (error instanceof Error) {
      // Check for specific error types for appropriate status codes
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("not found") ||
        error.message.includes("does not belong")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (
        error.message.includes("cannot be empty") ||
        error.message.includes("exceeds") ||
        error.message.includes("character limit")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: `Failed to save announcement: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save announcement" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/announcements
 * Retrieves all announcements for the authenticated user
 */
export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  // Authenticate user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const speaker_id = searchParams.get("speaker_id");
    const event_id = searchParams.get("event_id");
    const platform = searchParams.get("platform") as
      | "linkedin"
      | "twitter"
      | "instagram"
      | null;

    const announcementService = new AnnouncementService(supabase);

    let announcements;

    // Filter by speaker
    if (speaker_id) {
      announcements = await announcementService.getAnnouncementsBySpeaker(
        parseInt(speaker_id),
        user.id
      );
    }
    // Filter by event
    else if (event_id) {
      announcements = await announcementService.getAnnouncementsByEvent(
        parseInt(event_id),
        user.id
      );
    }
    // Filter by platform
    else if (platform) {
      if (!["linkedin", "twitter", "instagram"].includes(platform)) {
        return NextResponse.json(
          { error: "Invalid platform. Must be linkedin, twitter, or instagram" },
          { status: 400 }
        );
      }
      announcements = await announcementService.getAnnouncementsByPlatform(
        user.id,
        platform
      );
    }
    // Get all announcements for user
    else {
      announcements = await announcementService.getUserAnnouncements(user.id);
    }

    return NextResponse.json({
      success: true,
      announcements: announcements || [],
    });
  } catch (error) {
    console.error("Error in get announcements API:", error);

    if (error instanceof Error) {
      // Check for authorization errors
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      return NextResponse.json(
        { error: `Failed to fetch announcements: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500 }
    );
  }
}
