import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ScheduledPostService } from "@/lib/services/scheduled-post-service";

export const dynamic = "force-dynamic";

interface SchedulePostRequest {
  announcement_id: number;
  scheduled_time: string; // ISO 8601 timestamp
  timezone?: string;
  image_url?: string; // Optional Supabase Storage URL
}

/**
 * POST /api/x/schedule
 * Schedules an X/Twitter post for future publication
 *
 * Request body:
 * - announcement_id: number (required)
 * - scheduled_time: string (required, ISO 8601 timestamp)
 * - timezone: string (optional, defaults to UTC)
 * - image_url: string (optional, Supabase Storage URL)
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
    const body: SchedulePostRequest = await req.json();
    const { announcement_id, scheduled_time, timezone, image_url } = body;

    // Validate required fields
    if (!announcement_id || !scheduled_time) {
      return NextResponse.json(
        { error: "Missing required fields: announcement_id, scheduled_time" },
        { status: 400 }
      );
    }

    // Validate scheduled_time is a valid ISO 8601 timestamp
    const scheduledDate = new Date(scheduled_time);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled_time: must be a valid ISO 8601 timestamp" },
        { status: 400 }
      );
    }

    // Use service layer for business logic and validation
    const scheduledPostService = new ScheduledPostService(supabase);

    const scheduledPost = await scheduledPostService.createScheduledPost({
      announcementId: announcement_id,
      scheduledTime: scheduled_time,
      timezone: timezone || "UTC",
      imageUrl: image_url,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      scheduled_post: scheduledPost,
      message: "Post scheduled successfully",
    });
  } catch (error) {
    console.error("Error in schedule post API:", error);

    if (error instanceof Error) {
      // Check for specific error types
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("not found") ||
        error.message.includes("don't own")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (
        error.message.includes("must be in the future") ||
        error.message.includes("already scheduled") ||
        error.message.includes("Invalid")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: `Failed to schedule post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to schedule post" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/x/schedule
 * Retrieves scheduled X/Twitter posts for the authenticated user
 *
 * Query parameters:
 * - status: string (optional) - Filter by status: pending, posted, failed, cancelled
 * - announcement_id: number (optional) - Filter by announcement
 * - event_id: number (optional) - Filter by event
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
    const statusParam = searchParams.get("status") as
      | "pending"
      | "posted"
      | "failed"
      | "cancelled"
      | null;
    const announcementIdParam = searchParams.get("announcement_id");
    const eventIdParam = searchParams.get("event_id");

    // Validate status if provided
    if (statusParam) {
      const validStatuses = ["pending", "posted", "failed", "cancelled"];
      if (!validStatuses.includes(statusParam)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Must be one of: pending, posted, failed, cancelled",
          },
          { status: 400 }
        );
      }
    }

    const scheduledPostService = new ScheduledPostService(supabase);

    let scheduledPosts;

    // Filter by announcement
    if (announcementIdParam) {
      const announcementId = parseInt(announcementIdParam);
      if (isNaN(announcementId)) {
        return NextResponse.json(
          { error: "Invalid announcement_id: must be a number" },
          { status: 400 }
        );
      }

      scheduledPosts =
        await scheduledPostService.getScheduledPostsByAnnouncement(
          announcementId,
          user.id
        );
    }
    // Filter by event
    else if (eventIdParam) {
      const eventId = parseInt(eventIdParam);
      if (isNaN(eventId)) {
        return NextResponse.json(
          { error: "Invalid event_id: must be a number" },
          { status: 400 }
        );
      }

      scheduledPosts = await scheduledPostService.getScheduledPostsByEvent(
        eventId,
        user.id,
        statusParam || undefined
      );
    }
    // Get all scheduled X/Twitter posts for user (optionally filtered by status)
    else {
      // Get all scheduled posts and filter for twitter platform
      const allPosts = await scheduledPostService.getUserScheduledPosts(
        user.id,
        statusParam || undefined
      );
      scheduledPosts = allPosts.filter(
        (post) => post.platform === "twitter" || post.platform === "x"
      );
    }

    return NextResponse.json({
      success: true,
      scheduled_posts: scheduledPosts || [],
      count: scheduledPosts?.length || 0,
    });
  } catch (error) {
    console.error("Error in get scheduled posts API:", error);

    if (error instanceof Error) {
      // Check for authorization errors
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("don't own")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      return NextResponse.json(
        { error: `Failed to fetch scheduled posts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }
}
