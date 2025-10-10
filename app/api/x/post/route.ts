import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { XService, XAPIError } from "@/lib/services/x-service";
import { AnnouncementRepository } from "@/lib/repositories/announcement-repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/x/post
 * Posts an announcement immediately to X/Twitter with optional image
 *
 * Request body (FormData):
 * - announcement_id: number (required)
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
    // Parse FormData (supports file upload)
    const formData = await req.formData();
    const announcementIdStr = formData.get("announcement_id") as string;
    const imageFile = formData.get("image") as File | null;

    // Validate required fields
    if (!announcementIdStr) {
      return NextResponse.json(
        { error: "Missing required field: announcement_id" },
        { status: 400 }
      );
    }

    const announcementId = parseInt(announcementIdStr);

    if (isNaN(announcementId)) {
      return NextResponse.json(
        { error: "Invalid announcement_id: must be a number" },
        { status: 400 }
      );
    }

    // Fetch and validate announcement ownership
    const announcementRepo = new AnnouncementRepository(supabase);
    const announcement = await announcementRepo.getAnnouncementById(
      announcementId
    );

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    if (announcement.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You don't own this announcement" },
        { status: 403 }
      );
    }

    // Note: Platform validation removed to allow cross-platform posting
    // Users can post any announcement to X regardless of original platform

    // Process image file if provided
    let imageBuffer: Buffer | undefined;
    let filename: string | undefined;

    if (imageFile) {
      // Validate file type
      const validImageTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      if (!validImageTypes.includes(imageFile.type)) {
        return NextResponse.json(
          {
            error: `Invalid image type: ${imageFile.type}. Supported types: JPEG, PNG, GIF, WebP`,
          },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB for Twitter)
      const maxSizeBytes = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSizeBytes) {
        return NextResponse.json(
          { error: "Image file size exceeds 5MB limit" },
          { status: 400 }
        );
      }

      // Convert File to Buffer
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      filename = imageFile.name;

      console.log(`Processing image upload: ${filename} (${imageFile.size} bytes)`);
    }

    // Initialize X service
    const xService = new XService();

    // Post to X/Twitter
    console.log(`Posting announcement ${announcementId} to X/Twitter...`);
    const tweetId = await xService.postToX(
      announcement.announcement_text,
      imageBuffer,
      filename
    );

    console.log(`Successfully posted to X/Twitter. Tweet ID: ${tweetId}`);

    return NextResponse.json({
      success: true,
      tweet_id: tweetId,
      message: "Successfully posted to X/Twitter",
      announcement_id: announcementId,
    });
  } catch (error) {
    console.error("Error in X post API:", error);

    // Handle X-specific errors
    if (error instanceof XAPIError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.response,
        },
        { status: error.statusCode }
      );
    }

    // Handle general errors
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message.includes("credentials not configured")) {
        return NextResponse.json(
          {
            error: "X/Twitter integration not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to post to X/Twitter: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to post to X/Twitter" },
      { status: 500 }
    );
  }
}
