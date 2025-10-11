import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/announcements/[id]/schedule-all
 * Schedules an announcement to be posted to all platforms at the same time
 *
 * Request body (FormData):
 * - post_text: string (required) - The text content to post
 * - scheduled_time: ISO date string (required) - When to post
 * - timezone: string (required) - Timezone for scheduling
 * - image: File (optional) - Image file for LinkedIn/Twitter
 * - image_url: string (optional) - Public HTTPS URL for Instagram (required for Instagram)
 *
 * Response:
 * - success: boolean
 * - scheduled_posts: Array of created scheduled post records
 * - errors: Array of any errors that occurred (if partial success)
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
    const announcement_id = parseInt(id, 10);

    if (isNaN(announcement_id)) {
      return NextResponse.json(
        { error: "Invalid announcement ID" },
        { status: 400 }
      );
    }

    // Parse FormData
    const formData = await req.formData();
    const postText = formData.get("post_text") as string;
    const scheduledTimeStr = formData.get("scheduled_time") as string;
    const timezone = formData.get("timezone") as string;
    const imageFile = formData.get("image") as File | null;
    const imageUrlParam = formData.get("image_url") as string | null;

    // Validate required fields
    if (!postText || !scheduledTimeStr || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields: post_text, scheduled_time, timezone" },
        { status: 400 }
      );
    }

    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduledTimeStr);
    const now = new Date();

    if (scheduledTime <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Fetch announcement to get speaker_id and event_id
    const { data: announcement, error: announcementError } = await supabase
      .from("announcements")
      .select("speaker_id, event_id, user_id")
      .eq("id", announcement_id)
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (announcement.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You don't own this announcement" },
        { status: 403 }
      );
    }

    // Handle image uploads
    let linkedInImageUrl: string | null = null;
    let twitterImageUrl: string | null = null;
    let instagramImageUrl: string | null = null;

    // Upload image for LinkedIn/Twitter if provided
    if (imageFile) {
      try {
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const fileExtension = imageFile.name.split(".").pop();
        const baseFileName = `${user.id}/${announcement_id}-${Date.now()}`;

        // Upload for LinkedIn
        const linkedInFileName = `${baseFileName}-linkedin.${fileExtension}`;
        const { data: linkedInUpload, error: linkedInUploadError } =
          await supabase.storage.from("deepstation").upload(linkedInFileName, buffer, {
            contentType: imageFile.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (!linkedInUploadError && linkedInUpload) {
          const { data: publicUrlData } = supabase.storage
            .from("deepstation")
            .getPublicUrl(linkedInUpload.path);
          linkedInImageUrl = publicUrlData.publicUrl;
        }

        // Upload for Twitter (can reuse same upload or create separate)
        const twitterFileName = `${baseFileName}-twitter.${fileExtension}`;
        const { data: twitterUpload, error: twitterUploadError } =
          await supabase.storage.from("deepstation").upload(twitterFileName, buffer, {
            contentType: imageFile.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (!twitterUploadError && twitterUpload) {
          const { data: publicUrlData } = supabase.storage
            .from("deepstation")
            .getPublicUrl(twitterUpload.path);
          twitterImageUrl = publicUrlData.publicUrl;
        }
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // For Instagram: use provided image URL
    if (imageUrlParam) {
      if (!imageUrlParam.startsWith("https://")) {
        return NextResponse.json(
          { error: "Instagram image URL must use HTTPS protocol" },
          { status: 400 }
        );
      }
      instagramImageUrl = imageUrlParam;
    }

    // Instagram requires an image
    if (!instagramImageUrl) {
      return NextResponse.json(
        {
          error:
            "Instagram requires an image. Please provide image_url parameter.",
        },
        { status: 400 }
      );
    }

    // Create scheduled posts for all three platforms
    const scheduledPosts = [];
    const errors = [];

    const platforms: Array<{
      platform: "linkedin" | "twitter" | "instagram";
      imageUrl: string | null;
    }> = [
      { platform: "linkedin", imageUrl: linkedInImageUrl },
      { platform: "twitter", imageUrl: twitterImageUrl },
      { platform: "instagram", imageUrl: instagramImageUrl },
    ];

    for (const { platform, imageUrl } of platforms) {
      try {
        const { data: scheduledPost, error: scheduleError } = await supabase
          .from("scheduled_posts")
          .insert({
            user_id: user.id,
            announcement_id: announcement_id,
            speaker_id: announcement.speaker_id,
            event_id: announcement.event_id,
            scheduled_time: scheduledTimeStr,
            timezone,
            platform,
            post_text: postText,
            image_url: imageUrl,
            status: "pending",
          })
          .select()
          .single();

        if (scheduleError) {
          console.error(`Error scheduling ${platform} post:`, scheduleError);
          errors.push({
            platform,
            error: scheduleError.message,
          });
        } else {
          scheduledPosts.push(scheduledPost);
        }
      } catch (error) {
        console.error(`Error scheduling ${platform} post:`, error);
        errors.push({
          platform,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Determine overall success
    const hasSuccesses = scheduledPosts.length > 0;
    const hasErrors = errors.length > 0;

    if (hasSuccesses && !hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: `Successfully scheduled posts to all 3 platforms for ${scheduledTime.toLocaleString()}`,
          scheduled_posts: scheduledPosts,
        },
        { status: 200 }
      );
    }

    if (hasSuccesses && hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: `Partially successful - scheduled ${scheduledPosts.length} of 3 platforms`,
          scheduled_posts: scheduledPosts,
          errors,
        },
        { status: 207 } // Multi-Status
      );
    }

    // All failed
    return NextResponse.json(
      {
        success: false,
        message: "Failed to schedule posts to any platform",
        errors,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error in schedule-all API:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to schedule posts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to schedule posts" },
      { status: 500 }
    );
  }
}
