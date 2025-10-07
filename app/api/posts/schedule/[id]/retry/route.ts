import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/schedule/[id]/retry
 * Retries a failed scheduled post
 */
export async function POST(
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

    // Only allow retry of failed posts
    if (scheduledPost.status !== "failed") {
      return NextResponse.json(
        { error: `Can only retry failed posts. Current status: ${scheduledPost.status}` },
        { status: 400 }
      );
    }

    // Update status to pending and increment retry count
    const { error: updateError } = await supabase
      .from("scheduled_posts")
      .update({
        status: "pending",
        retry_count: scheduledPost.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", scheduleId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Post is being retried",
    });
  } catch (error) {
    console.error("Error retrying scheduled post:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to retry scheduled post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retry scheduled post" },
      { status: 500 }
    );
  }
}
