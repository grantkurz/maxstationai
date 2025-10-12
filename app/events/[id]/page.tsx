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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpeakerCardWithActions } from "@/components/events/SpeakerCardWithActions";
import { ScheduledPostsList } from "@/components/events/ScheduledPostsList";
import { GenerateAgendaDialog } from "@/components/events/agenda/GenerateAgendaDialog";
import { EventPageUrlInput } from "@/components/events/agenda/EventPageUrlInput";
import { AgendaViewer } from "@/components/events/agenda/AgendaViewer";
import { DripCampaignDialog } from "@/components/events/DripCampaignDialog";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: speakers } = await supabase
    .from("speakers")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  // Fetch scheduled posts with speaker information
  const { data: scheduledPosts } = await supabase
    .from("scheduled_posts")
    .select("*, speaker:speakers(*)")
    .eq("event_id", id)
    .order("scheduled_time", { ascending: true });

  // Type guard for scheduled posts with speaker
  const scheduledPostsWithSpeaker = scheduledPosts?.filter(
    (post): post is typeof post & { speaker: NonNullable<typeof post.speaker> } =>
      post.speaker !== null
  ) || [];

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
              {(() => {
                // For date-only values, parse directly to avoid UTC conversion
                const [year, month, day] = event.date.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return localDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              })()}
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
            <GenerateAgendaDialog event={event} />
            <DripCampaignDialog
              event={event}
              speakerCount={speakers?.length || 0}
            />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Event Page URL and Agenda Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Page</CardTitle>
            <CardDescription>
              Add your Luma or event platform link to include in announcements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventPageUrlInput event={event} />
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <AgendaViewer event={event} />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Tabs for Speakers and Scheduled Posts */}
      <Tabs defaultValue="speakers" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="speakers">
            Speakers ({speakers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled Posts ({scheduledPostsWithSpeaker.length})
          </TabsTrigger>
        </TabsList>

        {/* Speakers Tab */}
        <TabsContent value="speakers" className="space-y-6">
          <div className="flex justify-between items-center">
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
                <SpeakerCardWithActions
                  key={speaker.id}
                  speaker={speaker}
                  event={event}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Scheduled Posts Tab */}
        <TabsContent value="scheduled" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Scheduled Posts</h2>
              <p className="text-muted-foreground mt-1">
                Manage all scheduled social media posts for this event
              </p>
            </div>
          </div>

          <ScheduledPostsList
            scheduledPosts={scheduledPostsWithSpeaker}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
