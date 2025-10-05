"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Sparkles, RefreshCw } from "lucide-react";
import { Database } from "@/types/supabase";

type Speaker = Database["public"]["Tables"]["speakers"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];

interface GenerateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speaker: Speaker;
  event: Event;
}

export function GenerateAnnouncementDialog({
  open,
  onOpenChange,
  speaker,
  event,
}: GenerateAnnouncementDialogProps) {
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState<"setup" | "preview">("setup");

  const characterCount = announcement.length;

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const response = await fetch("/api/announcements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker,
          event,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate announcement");
      }

      setAnnouncement(data.announcement);
      setStage("preview");

      toast({
        title: "Announcement generated!",
        description: "You can now edit and copy the announcement.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate announcement",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(announcement);
      toast({
        title: "Copied!",
        description: "Announcement copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleRegenerate = () => {
    setStage("setup");
    setAnnouncement("");
  };

  const handleClose = () => {
    setStage("setup");
    setAnnouncement("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate Speaker Announcement
          </DialogTitle>
          <DialogDescription>
            {stage === "setup"
              ? "Generate a DeepStation-style speaker announcement using AI."
              : "Review and edit your generated announcement before sharing."}
          </DialogDescription>
        </DialogHeader>

        {stage === "setup" ? (
          <div className="space-y-6 py-4">
            {/* Speaker Preview */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">{speaker.name}</h4>
              <p className="text-sm text-muted-foreground mb-1">
                {speaker.speaker_title}
              </p>
              <p className="text-sm font-medium">{speaker.session_title}</p>
            </div>

            {/* Event Preview */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="font-semibold mb-2">{event.title}</h4>
              <p className="text-sm text-muted-foreground">
                {new Date(event.date).toLocaleDateString()} • {event.start_time} - {event.end_time}
              </p>
              <p className="text-sm text-muted-foreground">{event.location}</p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Announcement
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Character Count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                DeepStation Speaker Announcement
              </span>
              <span className="text-muted-foreground">
                {characterCount} characters
              </span>
            </div>

            {/* Editable Announcement */}
            <div className="space-y-2">
              <Label htmlFor="announcement">Generated Announcement</Label>
              <Textarea
                id="announcement"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={16}
                className="resize-none font-sans"
                placeholder="Your generated announcement will appear here..."
              />
              <p className="text-xs text-muted-foreground">
                You can edit the announcement before copying.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleCopy}
                disabled={!announcement}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
              <Button
                onClick={handleRegenerate}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>

            <Button onClick={handleClose} variant="outline" className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
