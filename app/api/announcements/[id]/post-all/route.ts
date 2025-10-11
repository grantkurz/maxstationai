import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  InstagramService,
  InstagramAPIError,
} from "@/lib/services/instagram-service";
import {
  LinkedInService,
  LinkedInAPIError,
} from "@/lib/services/linkedin-service";
import { XService, XAPIError } from "@/lib/services/x-service";
import { AnnouncementRepository } from "@/lib/repositories/announcement-repository";

export const dynamic = "force-dynamic";

/**
 * Request body schema for post-all endpoint
 */
interface PostAllRequest {
  image_url?: string; // Optional - for Instagram (required by Instagram)
  linkedin_image?: File; // Optional - for LinkedIn
}

/**
 * Platform post result
 */
interface PlatformResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  data?: any;
}

/**
 * POST /api/announcements/[id]/post-all
 * Posts an announcement to all three platforms (Instagram, LinkedIn, X) simultaneously
 *
 * Request body (JSON):
 * - image_url: string (required for Instagram) - Publicly accessible HTTPS URL
 *
 * Response:
 * - success: boolean (true if at least one platform succeeded)
 * - results: Object with platform-specific results
 * - errors: Object with platform-specific errors (if any failed)
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

    // Parse request body
    const body = await req.json();
    const { image_url } = body;

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

    const caption = announcement.announcement_text;
    const results: Record<string, PlatformResult> = {};
    const errors: Record<string, PlatformResult> = {};

    // Post to all three platforms in parallel
    const platformPromises = [
      // LinkedIn
      (async () => {
        try {
          console.log(
            `Posting announcement ${announcement_id} to LinkedIn...`
          );
          const linkedInService = new LinkedInService();

          // LinkedIn can work with or without an image
          let imageBuffer: Buffer | undefined;
          let filename = "announcement.jpg";

          if (image_url) {
            const imageResponse = await fetch(image_url);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              imageBuffer = Buffer.from(arrayBuffer);
            }
          }

          const postUrn = await linkedInService.postToLinkedIn(
            caption,
            imageBuffer,
            filename
          );

          results.linkedin = {
            success: true,
            data: { postUrn },
          };

          console.log(
            `Successfully posted to LinkedIn. Post URN: ${postUrn}`
          );
        } catch (error) {
          console.error("LinkedIn posting error:", error);

          if (error instanceof LinkedInAPIError) {
            errors.linkedin = {
              success: false,
              error: error.message,
              statusCode: error.statusCode,
            };
          } else {
            errors.linkedin = {
              success: false,
              error:
                error instanceof Error ? error.message : "Unknown error",
            };
          }
        }
      })(),

      // X/Twitter
      (async () => {
        try {
          console.log(`Posting announcement ${announcement_id} to X...`);
          const xService = new XService();

          // X can work with or without an image
          let imageBuffer: Buffer | undefined;

          if (image_url) {
            const imageResponse = await fetch(image_url);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              imageBuffer = Buffer.from(arrayBuffer);
            }
          }

          const tweetId = await xService.postToX(caption, imageBuffer);

          results.twitter = {
            success: true,
            data: { tweetId },
          };

          console.log(`Successfully posted to X. Tweet ID: ${tweetId}`);
        } catch (error) {
          console.error("X posting error:", error);

          if (error instanceof XAPIError) {
            errors.twitter = {
              success: false,
              error: error.message,
              statusCode: error.statusCode,
            };
          } else {
            errors.twitter = {
              success: false,
              error:
                error instanceof Error ? error.message : "Unknown error",
            };
          }
        }
      })(),

      // Instagram
      (async () => {
        try {
          console.log(
            `Posting announcement ${announcement_id} to Instagram...`
          );

          // Instagram REQUIRES an image
          if (!image_url || !image_url.trim()) {
            throw new Error(
              "Instagram requires an image. Please provide image_url."
            );
          }

          if (!image_url.toLowerCase().startsWith("https://")) {
            throw new Error(
              "Instagram requires a publicly accessible HTTPS URL"
            );
          }

          const instagramService = new InstagramService();
          const result = await instagramService.postToInstagram(
            image_url,
            caption
          );

          results.instagram = {
            success: true,
            data: {
              creationId: result.creationId,
              mediaId: result.mediaId,
            },
          };

          console.log(
            `Successfully posted to Instagram. Media ID: ${result.mediaId}`
          );
        } catch (error) {
          console.error("Instagram posting error:", error);

          if (error instanceof InstagramAPIError) {
            errors.instagram = {
              success: false,
              error: error.message,
              statusCode: error.statusCode,
            };
          } else {
            errors.instagram = {
              success: false,
              error:
                error instanceof Error ? error.message : "Unknown error",
            };
          }
        }
      })(),
    ];

    // Wait for all platforms to complete
    await Promise.all(platformPromises);

    // Determine overall success
    const hasSuccesses = Object.keys(results).length > 0;
    const hasErrors = Object.keys(errors).length > 0;

    if (hasSuccesses && !hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: "Successfully posted to all platforms",
          results,
        },
        { status: 200 }
      );
    }

    if (hasSuccesses && hasErrors) {
      return NextResponse.json(
        {
          success: true,
          message: "Partially successful - some platforms failed",
          results,
          errors,
        },
        { status: 207 } // Multi-Status
      );
    }

    // All failed
    return NextResponse.json(
      {
        success: false,
        message: "Failed to post to all platforms",
        errors,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error in post-all API:", error);

    // Handle general errors
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }

      if (
        error.message.includes("not found") ||
        error.message.includes("Invalid")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: `Failed to post to platforms: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to post to platforms" },
      { status: 500 }
    );
  }
}
