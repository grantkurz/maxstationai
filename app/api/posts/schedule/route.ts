import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/schedule
 * Schedules an announcement to be posted at a specific time
 *
 * Request body (FormData):
 * - announcement_id: number (required)
 * - post_text: string (required)
 * - platform: string (required)
 * - scheduled_time: ISO date string (required)
 * - timezone: string (required)
 * - image: File (optional)
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
    // Parse FormData
    const formData = await req.formData();
    const announcementIdStr = formData.get("announcement_id") as string;
    const postText = formData.get("post_text") as string;
    const platform = formData.get("platform") as string;
    const scheduledTimeStr = formData.get("scheduled_time") as string;
    const timezone = formData.get("timezone") as string;
    const imageFile = formData.get("image") as File | null;
    const imageUrlParam = formData.get("image_url") as string | null;

    // Validate required fields
    if (!announcementIdStr || !postText || !platform || !scheduledTimeStr || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const announcementId = parseInt(announcementIdStr);

    if (isNaN(announcementId)) {
      return NextResponse.json(
        { error: "Invalid announcement_id" },
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
      .eq("id", announcementId)
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

    // Handle image: either upload file (LinkedIn) or use provided URL (Instagram)
    let imageUrl: string | null = null;

    // For Instagram: use provided image URL
    if (platform === "instagram" && imageUrlParam) {
      // Validate URL format
      if (!imageUrlParam.startsWith("https://")) {
        return NextResponse.json(
          { error: "Instagram image URL must use HTTPS protocol" },
          { status: 400 }
        );
      }
      imageUrl = imageUrlParam;
    }
    // For LinkedIn: upload image file to Supabase Storage
    else if (platform === "linkedin" && imageFile) {
      try {
        // Convert File to ArrayBuffer then to Buffer
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${announcementId}-${Date.now()}.${fileExtension}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('deepstation')
          .upload(fileName, buffer, {
            contentType: imageFile.type,
            upsert: false,
            cacheControl: '3600',
          });

        if (uploadError) {
          console.error("Error uploading image to Supabase Storage:", uploadError);
          return NextResponse.json(
            { error: `Failed to upload image: ${uploadError.message}` },
            { status: 500 }
          );
        }

        // Get public URL
        const { data: publicUrlData } = supabase
          .storage
          .from('deepstation')
          .getPublicUrl(uploadData.path);

        imageUrl = publicUrlData.publicUrl;
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // Validate Instagram requirements
    if (platform === "instagram" && !imageUrl) {
      return NextResponse.json(
        { error: "Instagram posts require an image URL" },
        { status: 400 }
      );
    }

    // Create scheduled post
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        announcement_id: announcementId,
        speaker_id: announcement.speaker_id,
        event_id: announcement.event_id,
        scheduled_time: scheduledTimeStr,
        timezone,
        platform: platform as "linkedin" | "twitter" | "instagram",
        post_text: postText,
        image_url: imageUrl,
        status: "pending",
      })
      .select()
      .single();

    if (scheduleError) {
      console.error("Error creating scheduled post:", scheduleError);
      return NextResponse.json(
        { error: "Failed to schedule post" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scheduled_post: scheduledPost,
      message: `Post scheduled for ${scheduledTime.toLocaleString()}`,
    });
  } catch (error) {
    console.error("Error in schedule post API:", error);

    if (error instanceof Error) {
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
 * GET /api/posts/schedule
 * Retrieves scheduled posts, optionally filtered by announcement_id
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
    const { searchParams } = new URL(req.url);
    const announcementIdStr = searchParams.get("announcement_id");

    let query = supabase
      .from("scheduled_posts")
      .select("*")
      .eq("user_id", user.id);

    if (announcementIdStr) {
      const announcementId = parseInt(announcementIdStr);
      if (!isNaN(announcementId)) {
        query = query.eq("announcement_id", announcementId);
      }
    }

    const { data: scheduledPosts, error } = await query.order(
      "scheduled_time",
      { ascending: true }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      scheduled_posts: scheduledPosts || [],
    });
  } catch (error) {
    console.error("Error fetching scheduled posts:", error);

    if (error instanceof Error) {
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
