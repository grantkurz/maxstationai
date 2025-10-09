"use client";

import { useState } from "react";
import { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, FileText, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface GenerateAgendaDialogProps {
  event: EventRow;
  onAgendaGenerated?: () => void;
}

interface GeneratedAgenda {
  id: number;
  agendaText: string;
  version: number;
  format: string;
  createdAt: string;
  includedSpeakerIds: number[];
}

export function GenerateAgendaDialog({
  event,
  onAgendaGenerated,
}: GenerateAgendaDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAgenda, setGeneratedAgenda] =
    useState<GeneratedAgenda | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/agendas/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          format: "markdown",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate agenda");
      }

      setGeneratedAgenda(data.agenda);

      toast({
        title: "Agenda Generated!",
        description: `Successfully created version ${data.agenda.version} of your event agenda.`,
      });

      onAgendaGenerated?.();
    } catch (error) {
      console.error("Error generating agenda:", error);
      toast({
        title: "Generation Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate agenda. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedAgenda) return;

    try {
      await navigator.clipboard.writeText(generatedAgenda.agendaText);
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

  const handleClose = () => {
    setOpen(false);
    // Reset state after animation completes
    setTimeout(() => {
      setGeneratedAgenda(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Luma Agenda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Event Agenda</DialogTitle>
          <DialogDescription>
            AI will merge all speaker announcements into a formatted agenda for{" "}
            {event.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {!generatedAgenda ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Click generate to create a formatted agenda from your event
                speakers. This will merge all speaker bios and session details
                into a cohesive event page description.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Generated Agenda (Version {generatedAgenda.version})</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  Copy to Clipboard
                </Button>
              </div>
              <Textarea
                value={generatedAgenda.agendaText}
                readOnly
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {generatedAgenda.includedSpeakerIds.length} speaker(s) included
                • Created {new Date(generatedAgenda.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {!generatedAgenda ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isGenerating ? "Generating..." : "Generate Agenda"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
