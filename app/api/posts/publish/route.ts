import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/publish
 * Publishes an announcement immediately to LinkedIn with optional image
 *
 * This is a wrapper around the existing /api/linkedin/post endpoint
 * to provide a cleaner API for the frontend
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

    if (!announcementIdStr) {
      return NextResponse.json(
        { error: "Missing required field: announcement_id" },
        { status: 400 }
      );
    }

    // Forward the request to the existing LinkedIn post endpoint
    const linkedInFormData = new FormData();
    linkedInFormData.append("announcement_id", announcementIdStr);

    const imageFile = formData.get("image") as File | null;
    if (imageFile) {
      linkedInFormData.append("image", imageFile);
    }

    // Create internal request to LinkedIn post endpoint
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const response = await fetch(`${baseUrl}/api/linkedin/post`, {
      method: "POST",
      body: linkedInFormData,
      headers: {
        // Pass through cookies for authentication
        cookie: req.headers.get("cookie") || "",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to post to LinkedIn");
    }

    return NextResponse.json({
      success: true,
      post_urn: data.post_urn,
      message: "Successfully posted to LinkedIn",
    });
  } catch (error) {
    console.error("Error in publish post API:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to publish post: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to publish post" },
      { status: 500 }
    );
  }
}
