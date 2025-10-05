import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SpeakerDetailPage({
  params,
}: {
  params: { id: string; speakerId: string };
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

  const { data: speaker } = await supabase
    .from("speakers")
    .select("*")
    .eq("id", params.speakerId)
    .eq("event_id", params.id)
    .single();

  if (!speaker) {
    redirect(`/events/${params.id}`);
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="mb-8">
        <Link href={`/events/${event.id}`}>
          <Button variant="ghost" className="mb-4">
            ← Back to Event
          </Button>
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold">{speaker.name}</h1>
            <p className="text-muted-foreground mt-2">
              {speaker.speaker_title}
            </p>
          </div>
          <Link href={`/events/${event.id}/speakers/${speaker.id}/edit`}>
            <Button>Edit Speaker</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Speaker Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-medium">Name:</span> {speaker.name}
            </div>
            <div>
              <span className="font-medium">Title:</span>{" "}
              {speaker.speaker_title}
            </div>
            {speaker.speaker_bio && (
              <div>
                <span className="font-medium">Biography:</span>
                <p className="mt-2 text-muted-foreground">
                  {speaker.speaker_bio}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="font-medium">Session Title:</span>{" "}
              {speaker.session_title}
            </div>
            {speaker.session_description && (
              <div>
                <span className="font-medium">Session Description:</span>
                <p className="mt-2 text-muted-foreground">
                  {speaker.session_description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full md:w-auto" variant="outline" disabled>
            Generate Speaker Announcement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
