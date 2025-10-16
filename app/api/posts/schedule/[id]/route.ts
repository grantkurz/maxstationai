import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/posts/schedule/[id]
 * Updates a scheduled post's time
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;
    const scheduleId = parseInt(id);

    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule ID" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { scheduled_time } = body;

    if (!scheduled_time) {
      return NextResponse.json(
        { error: "scheduled_time is required" },
        { status: 400 }
      );
    }

    // Validate scheduled_time is a valid ISO date string
    const scheduledDate = new Date(scheduled_time);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format for scheduled_time" },
        { status: 400 }
      );
    }

    // Ensure the new time is in the future
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Fetch the scheduled post to verify ownership
    const { data: scheduledPost, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (fetchError || !scheduledPost) {
      return NextResponse.json(
        { error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (scheduledPost.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You don't own this scheduled post" },
        { status: 403 }
      );
    }

    // Only allow editing of pending posts
    if (scheduledPost.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot edit a post with status: ${scheduledPost.status}` },
        { status: 400 }
      );
    }

    // Update scheduled_time
    const { data: updatedPost, error: updateError } = await supabase
      .from("scheduled_posts")
      .update({ scheduled_time })
      .eq("id", scheduleId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Scheduled post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating scheduled post:", error);

    if (error instanceof Error) {
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
 * DELETE /api/posts/schedule/[id]
 * Cancels a scheduled post
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params;
    const scheduleId = parseInt(id);

    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule ID" },
        { status: 400 }
      );
    }

    // Fetch the scheduled post to verify ownership
    const { data: scheduledPost, error: fetchError } = await supabase
      .from("scheduled_posts")
      .select("*")
      .eq("id", scheduleId)
      .single();

    if (fetchError || !scheduledPost) {
      return NextResponse.json(
        { error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (scheduledPost.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You don't own this scheduled post" },
        { status: 403 }
      );
    }

    // Only allow cancellation of pending posts
    if (scheduledPost.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel a post with status: ${scheduledPost.status}` },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", scheduleId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Scheduled post cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling scheduled post:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to cancel scheduled post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to cancel scheduled post" },
      { status: 500 }
    );
  }
}
