import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { LinkedInService, LinkedInAPIError } from "@/lib/services/linkedin-service";
import { AnnouncementRepository } from "@/lib/repositories/announcement-repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/linkedin/post
 * Posts an announcement immediately to LinkedIn with optional image
 *
 * Request body (JSON):
 * - announcement_id: number (required)
 * - image_url: string (optional) - URL to speaker's primary image
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
    // Parse JSON request body
    const body = await req.json();
    const { announcement_id, image_url } = body;

    // Validate required fields
    if (!announcement_id) {
      return NextResponse.json(
        { error: "Missing required field: announcement_id" },
        { status: 400 }
      );
    }

    if (typeof announcement_id !== "number" || isNaN(announcement_id)) {
      return NextResponse.json(
        { error: "Invalid announcement_id: must be a number" },
        { status: 400 }
      );
    }

    // Fetch and validate announcement ownership
    const announcementRepo = new AnnouncementRepository(supabase);
    const announcement = await announcementRepo.getAnnouncementById(
      announcement_id
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
    // Users can post any announcement to LinkedIn regardless of original platform

    // Process image URL if provided
    let imageBuffer: Buffer | undefined;
    let filename: string | undefined;

    if (image_url) {
      console.log(`Downloading image from URL: ${image_url}`);

      try {
        // Download image from URL
        const response = await fetch(image_url);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);

        // Extract filename from URL or use default
        const urlPath = new URL(image_url).pathname;
        filename = urlPath.split('/').pop() || 'speaker-image.jpg';

        console.log(`Downloaded image: ${filename} (${imageBuffer.length} bytes)`);
      } catch (error) {
        console.error("Failed to download image:", error);
        return NextResponse.json(
          { error: "Failed to download speaker image" },
          { status: 400 }
        );
      }
    }

    // Initialize LinkedIn service
    const linkedInService = new LinkedInService();

    // Post to LinkedIn
    console.log(`Posting announcement ${announcement_id} to LinkedIn...`);
    const postUrn = await linkedInService.postToLinkedIn(
      announcement.announcement_text,
      imageBuffer,
      filename
    );

    console.log(`Successfully posted to LinkedIn. URN: ${postUrn}`);

    return NextResponse.json({
      success: true,
      post_urn: postUrn,
      message: "Successfully posted to LinkedIn",
      announcement_id: announcement_id,
    });
  } catch (error) {
    console.error("Error in LinkedIn post API:", error);

    // Handle LinkedIn-specific errors
    if (error instanceof LinkedInAPIError) {
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
            error: "LinkedIn integration not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to post to LinkedIn: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to post to LinkedIn" },
      { status: 500 }
    );
  }
}
