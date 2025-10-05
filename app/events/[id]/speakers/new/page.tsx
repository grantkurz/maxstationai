import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import { SpeakerFormEnhanced } from "@/components/events/SpeakerFormEnhanced";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewSpeakerPage({
  params,
}: {
  params: { id: string };
}) {
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
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!event) {
    redirect("/events");
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <Link href={`/events/${event.id}`}>
          <Button variant="ghost" className="mb-4">
            ← Back to Event
          </Button>
        </Link>
        <h1 className="text-4xl font-bold">Add Speaker</h1>
        <p className="text-muted-foreground mt-2">
          Add a speaker to {event.title}
        </p>
      </div>

      <SpeakerFormEnhanced eventId={event.id} />
    </div>
  );
}
