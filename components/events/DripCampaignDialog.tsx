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
import { Loader2, Calendar, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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

interface ContentPreview {
  speakerId: number;
  speakerName: string;
  daysUntilEvent: number;
  generatedAnnouncement: string;
  characterCount: number;
  hasExistingAnnouncement: boolean;
  imageUrl: string | null;
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
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram" | "all">(
    "all"
  );
  const [avoidWeekends, setAvoidWeekends] = useState(true);

  // Preview state
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [contentPreviews, setContentPreviews] = useState<ContentPreview[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [expandedSpeakers, setExpandedSpeakers] = useState<Set<number>>(new Set());

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
    setContentPreviews([]);
    setExpandedSpeakers(new Set());
  };

  const handlePreviewContent = async () => {
    setLoadingContent(true);

    try {
      // Filter out speakers with conflicts
      const schedulableSpeakers = preview.filter((p) => !p.hasConflict);

      const response = await fetch("/api/drip-campaigns/preview-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          speakerIds: schedulableSpeakers.map((p) => p.speakerId),
          daysUntilEvent: schedulableSpeakers.map((p) => p.daysUntilEvent),
          platform,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate content preview");
      }

      setContentPreviews(data.previews || []);

      toast({
        title: "Content Previews Generated!",
        description: `Generated ${data.previews.length} announcement previews`,
      });
    } catch (error) {
      console.error("Error generating content preview:", error);
      toast({
        title: "Preview Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate content preview",
        variant: "destructive",
      });
    } finally {
      setLoadingContent(false);
    }
  };

  const toggleSpeakerExpanded = (speakerId: number) => {
    const newExpanded = new Set(expandedSpeakers);
    if (newExpanded.has(speakerId)) {
      newExpanded.delete(speakerId);
    } else {
      newExpanded.add(speakerId);
    }
    setExpandedSpeakers(newExpanded);
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);

    // The date is stored in UTC. We need to display it in the event's timezone.
    // Since we don't have the event timezone in this component, we display the UTC time
    // which represents the actual scheduled time regardless of viewer's timezone.
    return {
      date: date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: event.timezone || 'UTC'
      }),
      time: date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: event.timezone || 'UTC'
      }),
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
                  onValueChange={(value: "linkedin" | "twitter" | "instagram" | "all") =>
                    setPlatform(value)
                  }
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        All Platforms (LinkedIn, X, Instagram)
                      </span>
                    </SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
                {platform === "all" && (
                  <p className="text-xs text-muted-foreground">
                    Will schedule to LinkedIn, X, and Instagram simultaneously
                  </p>
                )}
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
                  <p>
                    📱 Platform:{" "}
                    {platform === "all" ? (
                      <span className="font-medium">All (LinkedIn, X, Instagram)</span>
                    ) : (
                      platform
                    )}
                  </p>
                  {platform === "all" && (
                    <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      ⚠️ Instagram requires speaker images. Ensure speakers have primary images set.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    🤖 AI will generate unique reminder announcements for each
                    speaker based on days until event
                  </p>
                  {platform === "all" && (
                    <p className="text-xs text-muted-foreground">
                      💎 Each platform will receive {schedulableCount * 3} total posts
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Schedule</h4>
                  {schedulableCount > 0 && contentPreviews.length === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewContent}
                      disabled={loadingContent}
                    >
                      {loadingContent ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-3 w-3" />
                          Preview Content
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                  {preview.map((item) => {
                    const { date, time } = formatDateTime(item.scheduledTime);
                    const contentPreview = contentPreviews.find(
                      (cp) => cp.speakerId === item.speakerId
                    );
                    const isExpanded = expandedSpeakers.has(item.speakerId);

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

                        {/* Show content preview if available */}
                        {contentPreview && (
                          <div className="mt-3 space-y-2">
                            {/* Speaker Image */}
                            {contentPreview.imageUrl && (
                              <div className="flex items-center gap-2">
                                <img
                                  src={contentPreview.imageUrl}
                                  alt={`${item.speakerName} profile`}
                                  className="w-12 h-12 rounded-lg object-cover border"
                                />
                                <span className="text-xs text-muted-foreground">
                                  Image will be included in post
                                </span>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSpeakerExpanded(item.speakerId)}
                              className="h-8 px-2 text-xs w-full justify-between"
                            >
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                AI-Generated Announcement ({contentPreview.characterCount} chars)
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>

                            {isExpanded && (
                              <div className="bg-muted/50 p-3 rounded-lg text-xs whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {contentPreview.generatedAnnouncement}
                              </div>
                            )}

                            {contentPreview.hasExistingAnnouncement && (
                              <p className="text-xs text-muted-foreground">
                                ℹ️ Based on existing announcement
                              </p>
                            )}
                          </div>
                        )}
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
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  Creating your drip campaign...
                </p>
                <p className="text-xs text-muted-foreground">
                  Generating AI-powered reminder announcements for each speaker
                </p>
                <p className="text-xs text-muted-foreground italic">
                  This may take a minute for multiple speakers
                </p>
              </div>
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
