import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import { EventForm } from "@/components/events/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Create Event</h1>
        <p className="text-muted-foreground mt-2">
          Add a new event to your calendar
        </p>
      </div>

      <EventForm />
    </div>
  );
}
