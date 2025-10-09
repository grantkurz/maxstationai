"use client";

import { useState, useEffect } from "react";
import { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Copy, Clock, CheckCircle2 } from "lucide-react";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface AgendaViewerProps {
  event: EventRow;
  refreshTrigger?: number; // Optional prop to trigger refresh
}

interface Agenda {
  id: number;
  agendaText: string;
  version: number;
  format: string;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  publishedAt: string | null;
  includedSpeakerIds: number[];
}

export function AgendaViewer({ event, refreshTrigger }: AgendaViewerProps) {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAgenda = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agendas/${event.id}`);

      if (response.status === 404) {
        setAgenda(null);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch agenda");
      }

      const data = await response.json();
      setAgenda(data.agenda);
    } catch (error) {
      console.error("Error fetching agenda:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load agenda"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, [event.id, refreshTrigger]);

  const handleCopy = async () => {
    if (!agenda) return;

    try {
      await navigator.clipboard.writeText(agenda.agendaText);
      toast({
        title: "Copied!",
        description: "Agenda copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={fetchAgenda}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!agenda) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Event Agenda
          </CardTitle>
          <CardDescription>
            No agenda has been generated yet. Generate one to create a
            formatted description for your event page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Event Agenda
              <Badge variant="secondary">v{agenda.version}</Badge>
              {agenda.isPublished && (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Published
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(agenda.updatedAt).toLocaleString()}
              </span>
              <span>{agenda.includedSpeakerIds.length} speaker(s)</span>
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={agenda.agendaText}
          readOnly
          className="min-h-[300px] font-mono text-sm resize-none"
        />
      </CardContent>
    </Card>
  );
}
