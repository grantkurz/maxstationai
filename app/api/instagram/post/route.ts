import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  InstagramService,
  InstagramAPIError,
} from "@/lib/services/instagram-service";
import { AnnouncementRepository } from "@/lib/repositories/announcement-repository";

export const dynamic = "force-dynamic";

/**
 * Request body schema for Instagram post endpoint
 */
interface InstagramPostRequest {
  announcement_id: number;
  image_url: string;
  caption?: string;
}

/**
 * POST /api/instagram/post
 * Posts an announcement to Instagram with an image
 *
 * Request body (JSON):
 * - announcement_id: number (required) - ID of the announcement to post
 * - image_url: string (required) - Publicly accessible HTTPS URL of the image
 * - caption: string (optional) - Caption text for the Instagram post
 *
 * Note: Unlike LinkedIn, Instagram requires images to be hosted on a public URL
 * rather than uploaded as binary. The image_url must be HTTPS and publicly accessible.
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
    const body = (await req.json()) as InstagramPostRequest;
    const { announcement_id, image_url, caption } = body;

    // Validate required fields
    if (!announcement_id) {
      return NextResponse.json(
        { error: "Missing required field: announcement_id" },
        { status: 400 }
      );
    }

    if (!image_url || !image_url.trim()) {
      return NextResponse.json(
        { error: "Missing required field: image_url" },
        { status: 400 }
      );
    }

    // Validate image_url is HTTPS
    if (!image_url.toLowerCase().startsWith("https://")) {
      return NextResponse.json(
        {
          error:
            "Invalid image_url: Must be a publicly accessible HTTPS URL",
        },
        { status: 400 }
      );
    }

    // Validate announcement_id is a number
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

    // Validate platform is Instagram
    if (announcement.platform !== "instagram") {
      return NextResponse.json(
        { error: "This announcement is not configured for Instagram" },
        { status: 400 }
      );
    }

    // Initialize Instagram service
    const instagramService = new InstagramService();

    // Determine caption: use provided caption or fall back to announcement text
    const postCaption = caption?.trim() || announcement.announcement_text;

    // Post to Instagram
    console.log(`Posting announcement ${announcement_id} to Instagram...`);
    console.log(`Image URL: ${image_url}`);
    console.log(`Caption length: ${postCaption.length} characters`);

    const result = await instagramService.postToInstagram(
      image_url,
      postCaption
    );

    console.log(
      `Successfully posted to Instagram. Media ID: ${result.mediaId}`
    );

    return NextResponse.json({
      success: true,
      creation_id: result.creationId,
      media_id: result.mediaId,
      message: "Successfully posted to Instagram",
      announcement_id: announcement_id,
    });
  } catch (error) {
    console.error("Error in Instagram post API:", error);

    // Handle Instagram-specific errors
    if (error instanceof InstagramAPIError) {
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

      if (
        error.message.includes("environment variable") ||
        error.message.includes("credentials")
      ) {
        return NextResponse.json(
          {
            error:
              "Instagram integration not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to post to Instagram: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to post to Instagram" },
      { status: 500 }
    );
  }
}
