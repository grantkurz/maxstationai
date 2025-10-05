import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export const dynamic = "force-dynamic";

/**
 * POST /api/extract-text
 * Extracts text from uploaded PDF or image files using Claude AI
 *
 * @param req - NextRequest with FormData containing a file
 * @returns JSON with extracted text or error
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

  // Validate API key configuration
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI service not configured. Missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp"
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF or image file (JPEG, PNG, GIF, WebP)." },
        { status: 400 }
      );
    }

    // Convert file to base64 for AI processing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");

    // Determine media type for AI SDK
    let mediaType: string;
    if (file.type === "application/pdf") {
      mediaType = "application/pdf";
    } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
      mediaType = "image/jpeg";
    } else if (file.type === "image/png") {
      mediaType = "image/png";
    } else if (file.type === "image/gif") {
      mediaType = "image/gif";
    } else if (file.type === "image/webp") {
      mediaType = "image/webp";
    } else {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    // Extract text using Claude AI
    let text: string;

    if (file.type === "application/pdf") {
      // For PDFs, use direct Anthropic API (AI SDK doesn't support PDFs yet)
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64,
                  },
                },
                {
                  type: "text",
                  text: "Extract all text from this PDF document. Return only the extracted text without any additional commentary or formatting.",
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to extract PDF text");
      }

      text = data.content[0].text;
    } else {
      // For images, use AI SDK
      const result = await generateText({
        model: anthropic("claude-3-5-sonnet-20241022"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: `data:${mediaType};base64,${base64}`,
              },
              {
                type: "text",
                text: "Extract all visible text from this image. Return only the extracted text without any additional commentary or formatting.",
              },
            ],
          },
        ],
      });

      text = result.text;
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text could be extracted from the file" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error extracting text:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to extract text: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
