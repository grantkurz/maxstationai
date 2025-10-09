import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AgendaService } from "@/lib/services/agenda-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/agendas/[eventId]
 * Retrieves the latest agenda for an event
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
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
    const { eventId } = await params;
    const eventIdNum = parseInt(eventId, 10);

    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const agendaService = new AgendaService(supabase);

    // Check if query param requests all versions
    const { searchParams } = new URL(req.url);
    const allVersions = searchParams.get("all") === "true";

    if (allVersions) {
      const agendas = await agendaService.getAllAgendaVersions(
        eventIdNum,
        user.id
      );

      return NextResponse.json({
        success: true,
        agendas: agendas.map((agenda) => ({
          id: agenda.id,
          agendaText: agenda.agenda_text,
          version: agenda.version,
          format: agenda.agenda_format,
          createdAt: agenda.created_at,
          updatedAt: agenda.updated_at,
          isPublished: agenda.is_published,
          publishedAt: agenda.published_at,
          includedSpeakerIds: agenda.included_speaker_ids,
        })),
      });
    }

    // Get latest version
    const agenda = await agendaService.getLatestAgenda(eventIdNum, user.id);

    if (!agenda) {
      return NextResponse.json(
        { error: "No agenda found for this event" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agenda: {
        id: agenda.id,
        agendaText: agenda.agenda_text,
        version: agenda.version,
        format: agenda.agenda_format,
        createdAt: agenda.created_at,
        updatedAt: agenda.updated_at,
        isPublished: agenda.is_published,
        publishedAt: agenda.published_at,
        includedSpeakerIds: agenda.included_speaker_ids,
      },
    });
  } catch (error) {
    console.error("Error fetching agenda:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to fetch agenda: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch agenda" },
      { status: 500 }
    );
  }
}
