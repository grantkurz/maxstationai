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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

interface DripCampaignDialogProps {
  event: EventRow;
  speakerCount: number;
  onCampaignCreated?: () => void;
}

interface PreviewItem {
  speakerId: number;
  speakerName: string;
  scheduledTime: string;
  daysUntilEvent: number;
  hasConflict: boolean;
  conflictReason?: string;
}

export function DripCampaignDialog({
  event,
  speakerCount,
  onCampaignCreated,
}: DripCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"config" | "preview" | "creating">("config");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Configuration state
  const [daysBeforeEvent, setDaysBeforeEvent] = useState(7);
  const [startTime, setStartTime] = useState("10:00");
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram">(
    "linkedin"
  );
  const [avoidWeekends, setAvoidWeekends] = useState(true);

  // Preview state
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handlePreview = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/drip-campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          daysBeforeEvent,
          startTime: `${startTime}:00`,
          platform,
          avoidWeekends,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to preview campaign");
      }

      setPreview(data.preview || []);
      setWarnings(data.warnings || []);
      setStep("preview");
    } catch (error) {
      console.error("Error previewing campaign:", error);
      toast({
        title: "Preview Failed",
        description:
          error instanceof Error ? error.message : "Failed to preview campaign",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setStep("creating");
    setIsLoading(true);

    try {
      const response = await fetch("/api/drip-campaigns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          daysBeforeEvent,
          startTime: `${startTime}:00`,
          platform,
          avoidWeekends,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      toast({
        title: "Campaign Created!",
        description: data.message || `Scheduled ${data.scheduledCount} posts`,
      });

      setOpen(false);
      onCampaignCreated?.();

      // Reset state
      setTimeout(() => {
        setStep("config");
        setPreview([]);
        setWarnings([]);
      }, 200);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Campaign Failed",
        description:
          error instanceof Error ? error.message : "Failed to create campaign",
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("config");
    setPreview([]);
    setWarnings([]);
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const conflictCount = preview.filter((p) => p.hasConflict).length;
  const schedulableCount = preview.length - conflictCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" disabled={speakerCount === 0}>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "config" && "Schedule Drip Campaign"}
            {step === "preview" && "Preview Schedule"}
            {step === "creating" && "Creating Campaign..."}
          </DialogTitle>
          <DialogDescription>
            {step === "config" &&
              "Automatically schedule speaker announcements leading up to your event"}
            {step === "preview" &&
              `Review the proposed schedule for ${event.title}`}
            {step === "creating" && "Scheduling posts..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === "config" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="days-before">Days Before Event</Label>
                <Input
                  id="days-before"
                  type="number"
                  min="1"
                  max="60"
                  value={daysBeforeEvent}
                  onChange={(e) => setDaysBeforeEvent(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Start posting {daysBeforeEvent} days before {event.title}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-time">Preferred Posting Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Posts will be scheduled around this time daily (8am-3pm window)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={platform}
                  onValueChange={(value: "linkedin" | "twitter" | "instagram") =>
                    setPlatform(value)
                  }
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="avoid-weekends">Avoid Weekends</Label>
                  <p className="text-xs text-muted-foreground">
                    Skip Saturday and Sunday when scheduling posts
                  </p>
                </div>
                <Switch
                  id="avoid-weekends"
                  checked={avoidWeekends}
                  onCheckedChange={setAvoidWeekends}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will schedule {speakerCount} speaker announcement(s) with
                  smart conflict avoidance. Posts are spaced at least 12 hours
                  apart.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Campaign Summary</h4>
                <div className="text-sm space-y-1">
                  <p>
                    ✓ {schedulableCount} of {preview.length} speakers will be
                    scheduled
                  </p>
                  <p>📅 Starting {daysBeforeEvent} days before event</p>
                  <p>⏰ Around {startTime} daily</p>
                  <p>📱 Platform: {platform}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Schedule</h4>
                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {preview.map((item) => {
                    const { date, time } = formatDateTime(item.scheduledTime);
                    return (
                      <div
                        key={item.speakerId}
                        className={`p-3 ${
                          item.hasConflict ? "bg-destructive/10" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{item.speakerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {date} at {time}
                            </div>
                            {item.conflictReason && (
                              <div className="text-xs text-destructive mt-1">
                                ⚠️ {item.conflictReason}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.daysUntilEvent}d before
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === "creating" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Scheduling speaker announcements...
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "config" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                disabled={isLoading || speakerCount === 0}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview Schedule
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={isLoading || schedulableCount === 0}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule {schedulableCount} Post{schedulableCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
