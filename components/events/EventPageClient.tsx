"use client";

import { useState } from "react";
import { Database } from "@/types/supabase";
import { GenerateAgendaDialog } from "@/components/events/agenda/GenerateAgendaDialog";
import { EventPageUrlInput } from "@/components/events/agenda/EventPageUrlInput";
import { AgendaViewer } from "@/components/events/agenda/AgendaViewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface EventPageClientProps {
  event: EventRow;
}

export function EventPageClient({ event }: EventPageClientProps) {
  const [agendaRefreshTrigger, setAgendaRefreshTrigger] = useState(0);

  const handleAgendaGenerated = () => {
    // Trigger refresh of AgendaViewer
    setAgendaRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Separator className="my-8" />

      {/* Event Page URL and Agenda Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Page Link</CardTitle>
            <CardDescription>
              Link to your Luma, Eventbrite, or other event platform page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventPageUrlInput event={event} />
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <AgendaViewer event={event} refreshTrigger={agendaRefreshTrigger} />
        </div>
      </div>

      <div className="hidden">
        {/* Hidden component for Quick Actions integration */}
        <GenerateAgendaDialog
          event={event}
          onAgendaGenerated={handleAgendaGenerated}
        />
      </div>
    </>
  );
}
