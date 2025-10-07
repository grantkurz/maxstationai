import { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ScheduledPostService } from "@/lib/services/scheduled-post-service";
import { LinkedInService } from "@/lib/services/linkedin-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/publish-scheduled-posts
 *
 * Cron job endpoint that publishes all pending scheduled posts
 * whose scheduled_time has passed.
 *
 * This endpoint should be called by Supabase pg_cron every 5 minutes.
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function POST(req: NextRequest) {
  // Verify cron secret for security
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("Invalid cron secret");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Create Supabase admin client (bypasses RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase configuration missing");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  try {
    const scheduledPostService = new ScheduledPostService(supabase);
    const linkedInService = new LinkedInService(supabase);

    // Get all pending posts that are ready to publish
    const pendingPosts = await scheduledPostService.getPendingScheduledPosts();

    console.log(`[Cron] Found ${pendingPosts.length} pending posts to publish`);

    const results = {
      total: pendingPosts.length,
      published: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each pending post
    for (const post of pendingPosts) {
      try {
        console.log(`[Cron] Publishing post ${post.id} (${post.platform})`);

        // Currently only LinkedIn is supported
        if (post.platform === "linkedin") {
          // Get user's LinkedIn access token
          const { data: profile } = await supabase
            .from("profiles")
            .select("linkedin_access_token")
            .eq("id", post.user_id)
            .single();

          if (!profile?.linkedin_access_token) {
            throw new Error("LinkedIn access token not found for user");
          }

          // Publish to LinkedIn
          const postUrn = await linkedInService.createPost(
            post.user_id,
            post.post_text,
            post.image_url || undefined
          );

          // Mark as posted
          await scheduledPostService.markAsPosted(post.id, postUrn);

          console.log(`[Cron] Successfully published post ${post.id}: ${postUrn}`);
          results.published++;
        } else {
          throw new Error(`Platform ${post.platform} is not yet supported`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Cron] Failed to publish post ${post.id}:`, errorMessage);

        // Mark as failed
        await scheduledPostService.markAsFailed(post.id, errorMessage);

        results.failed++;
        results.errors.push(`Post ${post.id}: ${errorMessage}`);
      }
    }

    console.log(`[Cron] Completed: ${results.published} published, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[Cron] Error in publish scheduled posts:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Cron job failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/publish-scheduled-posts
 *
 * Allows manual triggering of the cron job for testing
 * (same authentication required)
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
