import { Database } from "@/types/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET a single speaker by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: speaker, error } = await supabase
    .from("speakers")
    .select("*, events!inner(*)")
    .eq("id", params.id)
    .eq("events.user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ speaker });
}

// PUT update a speaker by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      speaker_title,
      speaker_bio,
      session_title,
      session_description,
    } = body;

    // First verify the speaker belongs to a user's event
    const { data: existingSpeaker } = await supabase
      .from("speakers")
      .select("event_id, events!inner(user_id)")
      .eq("id", params.id)
      .eq("events.user_id", user.id)
      .single();

    if (!existingSpeaker) {
      return NextResponse.json(
        { error: "Speaker not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data: speaker, error } = await supabase
      .from("speakers")
      .update({
        name,
        speaker_title,
        speaker_bio,
        session_title,
        session_description,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ speaker });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// DELETE a speaker by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient<Database>({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // First verify the speaker belongs to a user's event
  const { data: existingSpeaker } = await supabase
    .from("speakers")
    .select("event_id, events!inner(user_id)")
    .eq("id", params.id)
    .eq("events.user_id", user.id)
    .single();

  if (!existingSpeaker) {
    return NextResponse.json(
      { error: "Speaker not found or unauthorized" },
      { status: 404 }
    );
  }

  const { error } = await supabase.from("speakers").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Speaker deleted successfully" });
}
