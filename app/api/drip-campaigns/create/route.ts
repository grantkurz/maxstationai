import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { DripCampaignService } from "@/lib/services/drip-campaign-service";

export const dynamic = "force-dynamic";

interface CreateCampaignRequest {
  eventId: number;
  daysBeforeEvent?: number;
  startTime?: string;
  platform?: "linkedin" | "twitter" | "instagram" | "all";
  avoidWeekends?: boolean;
}

/**
 * POST /api/drip-campaigns/create
 * Create a drip campaign - actually schedule the posts
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
    const body: CreateCampaignRequest = await req.json();
    const { eventId, daysBeforeEvent, startTime, platform, avoidWeekends } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    const campaignService = new DripCampaignService(supabase);

    const result = await campaignService.createCampaign({
      eventId,
      userId: user.id,
      daysBeforeEvent,
      startTime,
      platform,
      avoidWeekends,
    });

    return NextResponse.json({
      success: result.success,
      scheduledCount: result.scheduledCount,
      skippedCount: result.skippedCount,
      warnings: result.warnings,
      message: result.success
        ? `Successfully scheduled ${result.scheduledCount} speaker announcement(s)`
        : "Failed to schedule any announcements",
    });
  } catch (error) {
    console.error("Error creating drip campaign:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to create campaign: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
