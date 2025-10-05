import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
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

  const { data: speakers } = await supabase
    .from("speakers")
    .select("*")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <Link href="/events">
          <Button variant="ghost" className="mb-4">
            ← Back to Events
          </Button>
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold">{event.title}</h1>
            <p className="text-muted-foreground mt-2">{event.type}</p>
          </div>
          <Link href={`/events/${event.id}/edit`}>
            <Button>Edit Event</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-medium">Date:</span>{" "}
              {new Date(event.date).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Time:</span> {event.start_time} -{" "}
              {event.end_time}
            </div>
            <div>
              <span className="font-medium">Timezone:</span> {event.timezone}
            </div>
            <div>
              <span className="font-medium">Location:</span> {event.location}
            </div>
            {event.description && (
              <div>
                <span className="font-medium">Description:</span>
                <p className="mt-2 text-muted-foreground">
                  {event.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/events/${event.id}/speakers/new`} className="block">
              <Button className="w-full" variant="outline">
                Add Speaker
              </Button>
            </Link>
            <Button className="w-full" variant="outline" disabled>
              Generate Announcement
            </Button>
            <Button className="w-full" variant="outline" disabled>
              Create Luma Agenda
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Speakers</h2>
            <p className="text-muted-foreground mt-1">
              {speakers?.length || 0} speaker(s) for this event
            </p>
          </div>
          <Link href={`/events/${event.id}/speakers/new`}>
            <Button>Add Speaker</Button>
          </Link>
        </div>

        {!speakers || speakers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No speakers yet</CardTitle>
              <CardDescription>
                Add speakers to this event to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/events/${event.id}/speakers/new`}>
                <Button>Add First Speaker</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {speakers.map((speaker) => (
              <Card key={speaker.id}>
                <CardHeader>
                  <CardTitle>{speaker.name}</CardTitle>
                  <CardDescription>{speaker.speaker_title}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="font-medium">Session:</span>{" "}
                    {speaker.session_title}
                  </div>
                  {speaker.speaker_bio && (
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {speaker.speaker_bio}
                    </div>
                  )}
                  {speaker.session_description && (
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {speaker.session_description}
                    </div>
                  )}
                  <div className="pt-2">
                    <Link href={`/events/${event.id}/speakers/${speaker.id}`}>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
