import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { DripCampaignService } from "@/lib/services/drip-campaign-service";

export const dynamic = "force-dynamic";

interface PreviewRequest {
  eventId: number;
  daysBeforeEvent?: number;
  startTime?: string;
  platform?: "linkedin" | "twitter" | "instagram" | "all";
  avoidWeekends?: boolean;
}

/**
 * POST /api/drip-campaigns/preview
 * Generate a preview of the drip campaign schedule without creating posts
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
    const body: PreviewRequest = await req.json();
    const { eventId, daysBeforeEvent, startTime, platform, avoidWeekends } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const campaignService = new DripCampaignService(supabase);

    const preview = await campaignService.previewCampaign({
      eventId,
      userId: user.id,
      daysBeforeEvent,
      startTime,
      platform,
      avoidWeekends,
    });

    // Calculate warnings
    const warnings: string[] = [];
    const conflictCount = preview.filter((p) => p.hasConflict).length;

    if (conflictCount > 0) {
      warnings.push(
        `${conflictCount} speaker(s) could not be scheduled due to conflicts`
      );
    }

    if (preview.length === 0) {
      warnings.push("No speakers found for this event");
    }

    return NextResponse.json({
      success: true,
      preview,
      warnings,
      stats: {
        totalSpeakers: preview.length,
        schedulable: preview.filter((p) => !p.hasConflict).length,
        conflicts: conflictCount,
      },
    });
  } catch (error) {
    console.error("Error previewing drip campaign:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to preview campaign: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to preview campaign" },
      { status: 500 }
    );
  }
}
