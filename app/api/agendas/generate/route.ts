import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { AgendaService } from "@/lib/services/agenda-service";

export const dynamic = "force-dynamic";

interface GenerateAgendaRequest {
  eventId: number;
  format?: "markdown" | "html" | "plain";
  speakerIds?: number[]; // Optional: specific speakers to include
}

/**
 * POST /api/agendas/generate
 * Generates a new agenda for an event using AI
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
    const body: GenerateAgendaRequest = await req.json();
    const { eventId, format = "markdown", speakerIds } = body;

    // Validate required fields
    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Create service and generate agenda
    const agendaService = new AgendaService(supabase);

    const agenda = await agendaService.generateAgenda({
      eventId,
      userId: user.id,
      format,
      speakerIds,
    });

    return NextResponse.json({
      success: true,
      agenda: {
        id: agenda.id,
        agendaText: agenda.agenda_text,
        version: agenda.version,
        format: agenda.agenda_format,
        createdAt: agenda.created_at,
        includedSpeakerIds: agenda.included_speaker_ids,
      },
    });
  } catch (error) {
    console.error("Error generating agenda:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to generate agenda: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate agenda" },
      { status: 500 }
    );
  }
}
