import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AgendaService } from "@/lib/services/agenda-service";

export const dynamic = "force-dynamic";

interface UpdateEventPageUrlRequest {
  eventPageUrl: string;
}

/**
 * POST /api/events/[id]/page-url
 * Updates the event page URL for an event
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
    const eventId = parseInt(id, 10);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const body: UpdateEventPageUrlRequest = await req.json();
    const { eventPageUrl } = body;

    if (!eventPageUrl) {
      return NextResponse.json(
        { error: "Event page URL is required" },
        { status: 400 }
      );
    }

    const agendaService = new AgendaService(supabase);

    await agendaService.updateEventPageUrl({
      eventId,
      eventPageUrl,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Event page URL updated successfully",
    });
  } catch (error) {
    console.error("Error updating event page URL:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to update event page URL: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update event page URL" },
      { status: 500 }
    );
  }
}
