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

    // Validate platform is LinkedIn
    if (announcement.platform !== "linkedin") {
      return NextResponse.json(
        { error: "This announcement is not configured for LinkedIn" },
        { status: 400 }
      );
    }

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

      // Validate file size (max 10MB)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (imageFile.size > maxSizeBytes) {
        return NextResponse.json(
          { error: "Image file size exceeds 10MB limit" },
          { status: 400 }
        );
      }

      // Convert File to Buffer
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      filename = imageFile.name;

      console.log(`Processing image upload: ${filename} (${imageFile.size} bytes)`);
    }

    // Initialize LinkedIn service
    const linkedInService = new LinkedInService();

    // Post to LinkedIn
    console.log(`Posting announcement ${announcementId} to LinkedIn...`);
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
      announcement_id: announcementId,
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
