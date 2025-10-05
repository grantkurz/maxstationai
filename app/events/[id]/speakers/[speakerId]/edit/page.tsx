import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import { SpeakerFormEnhanced } from "@/components/events/SpeakerFormEnhanced";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditSpeakerPage({
  params,
}: {
  params: Promise<{ id: string; speakerId: string }>;
}) {
  const { id, speakerId } = await params;
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!event) {
    redirect("/events");
  }

  const { data: speaker } = await supabase
    .from("speakers")
    .select("*")
    .eq("id", speakerId)
    .eq("event_id", id)
    .single();

  if (!speaker) {
    redirect(`/events/${id}`);
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <Link href={`/events/${event.id}/speakers/${speaker.id}`}>
          <Button variant="ghost" className="mb-4">
            ← Back to Speaker
          </Button>
        </Link>
        <h1 className="text-4xl font-bold">Edit Speaker</h1>
        <p className="text-muted-foreground mt-2">
          Update speaker information for {speaker.name}
        </p>
      </div>

      <SpeakerFormEnhanced eventId={event.id} speaker={speaker} />
    </div>
  );
}
