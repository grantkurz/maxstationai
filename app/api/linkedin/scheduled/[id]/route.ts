import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ScheduledPostService } from "@/lib/services/scheduled-post-service";

export const dynamic = "force-dynamic";

interface UpdateScheduledPostRequest {
  scheduled_time?: string;
  timezone?: string;
  image_url?: string;
  status?: "pending" | "posted" | "failed" | "cancelled";
}

/**
 * GET /api/linkedin/scheduled/[id]
 * Retrieves a specific scheduled post by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const scheduledPostId = parseInt(params.id);

    if (isNaN(scheduledPostId)) {
      return NextResponse.json(
        { error: "Invalid ID: must be a number" },
        { status: 400 }
      );
    }

    const scheduledPostService = new ScheduledPostService(supabase);

    const scheduledPost = await scheduledPostService.getScheduledPostById(
      scheduledPostId,
      user.id
    );

    if (!scheduledPost) {
      return NextResponse.json(
        { error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduled_post: scheduledPost,
    });
  } catch (error) {
    console.error("Error in get scheduled post API:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("don't own")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      return NextResponse.json(
        { error: `Failed to fetch scheduled post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch scheduled post" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/linkedin/scheduled/[id]
 * Updates a scheduled post (only pending posts can be updated)
 *
 * Request body:
 * - scheduled_time: string (optional)
 * - timezone: string (optional)
 * - image_url: string (optional)
 * - status: string (optional) - for cancelling: set to "cancelled"
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const scheduledPostId = parseInt(params.id);

    if (isNaN(scheduledPostId)) {
      return NextResponse.json(
        { error: "Invalid ID: must be a number" },
        { status: 400 }
      );
    }

    const body: UpdateScheduledPostRequest = await req.json();

    // Validate status if provided
    if (body.status) {
      const validStatuses = ["pending", "posted", "failed", "cancelled"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            error:
              "Invalid status. Must be one of: pending, posted, failed, cancelled",
          },
          { status: 400 }
        );
      }

      // Users can only manually set status to "cancelled"
      if (body.status !== "cancelled") {
        return NextResponse.json(
          {
            error: "Only 'cancelled' status can be set manually. Other statuses are system-managed.",
          },
          { status: 400 }
        );
      }
    }

    // Validate scheduled_time if provided
    if (body.scheduled_time) {
      const scheduledDate = new Date(body.scheduled_time);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduled_time: must be a valid ISO 8601 timestamp" },
          { status: 400 }
        );
      }
    }

    const scheduledPostService = new ScheduledPostService(supabase);

    // If status is being set to cancelled, use the cancel method
    if (body.status === "cancelled") {
      const cancelledPost = await scheduledPostService.cancelScheduledPost(
        scheduledPostId,
        user.id
      );

      return NextResponse.json({
        success: true,
        scheduled_post: cancelledPost,
        message: "Scheduled post cancelled successfully",
      });
    }

    // Otherwise, use the update method
    const updatedPost = await scheduledPostService.updateScheduledPost(
      scheduledPostId,
      user.id,
      body
    );

    return NextResponse.json({
      success: true,
      scheduled_post: updatedPost,
      message: "Scheduled post updated successfully",
    });
  } catch (error) {
    console.error("Error in update scheduled post API:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("not found") ||
        error.message.includes("don't own")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (
        error.message.includes("Cannot") ||
        error.message.includes("already") ||
        error.message.includes("must be in the future")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: `Failed to update scheduled post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/linkedin/scheduled/[id]
 * Permanently deletes a scheduled post
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const scheduledPostId = parseInt(params.id);

    if (isNaN(scheduledPostId)) {
      return NextResponse.json(
        { error: "Invalid ID: must be a number" },
        { status: 400 }
      );
    }

    const scheduledPostService = new ScheduledPostService(supabase);

    await scheduledPostService.deleteScheduledPost(scheduledPostId, user.id);

    return NextResponse.json({
      success: true,
      message: "Scheduled post deleted successfully",
    });
  } catch (error) {
    console.error("Error in delete scheduled post API:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("Unauthorized") ||
        error.message.includes("not found") ||
        error.message.includes("don't own")
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      return NextResponse.json(
        { error: `Failed to delete scheduled post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete scheduled post" },
      { status: 500 }
    );
  }
}
