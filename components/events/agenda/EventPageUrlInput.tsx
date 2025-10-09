"use client";

import { useState } from "react";
import { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ExternalLink, Save } from "lucide-react";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface EventPageUrlInputProps {
  event: EventRow;
  onUrlSaved?: (url: string) => void;
}

export function EventPageUrlInput({
  event,
  onUrlSaved,
}: EventPageUrlInputProps) {
  const [url, setUrl] = useState(event.ticket_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setHasChanges(value !== (event.ticket_url || ""));
  };

  const handleSave = async () => {
    if (!url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid event page URL",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${event.id}/page-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventPageUrl: url.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save event page URL");
      }

      toast({
        title: "Saved!",
        description: "Event page URL updated successfully",
      });

      setHasChanges(false);
      onUrlSaved?.(url.trim());
    } catch (error) {
      console.error("Error saving event page URL:", error);
      toast({
        title: "Save Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save event page URL. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVisit = () => {
    if (url && url.trim()) {
      let visitUrl = url.trim();
      if (!visitUrl.startsWith("http://") && !visitUrl.startsWith("https://")) {
        visitUrl = `https://${visitUrl}`;
      }
      window.open(visitUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="event-page-url">Event Page URL</Label>
      <div className="flex gap-2">
        <Input
          id="event-page-url"
          type="url"
          placeholder="e.g., lu.ma/your-event"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          disabled={isSaving}
          className="flex-1"
        />
        {url && url.trim() && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleVisit}
            disabled={isSaving}
            title="Visit event page"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges || !url.trim()}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving..." : <Save className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Link to your Luma or other event platform page. This will be included
        in generated announcements and agendas.
      </p>
    </div>
  );
}
