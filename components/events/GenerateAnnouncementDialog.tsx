"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Sparkles, RefreshCw, Save, Check, AlertCircle } from "lucide-react";
import { Database } from "@/types/supabase";

type Speaker = Database["public"]["Tables"]["speakers"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];
type Platform = "linkedin" | "twitter" | "instagram";
type Template = "pre-event" | "day-of" | "post-event";

interface GenerateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speaker: Speaker;
  event: Event;
}

// Platform character limits
const PLATFORM_LIMITS = {
  linkedin: 3000,
  twitter: 280,
  instagram: 2200,
} as const;

// Platform display names
const PLATFORM_NAMES = {
  linkedin: "LinkedIn",
  twitter: "Twitter/X",
  instagram: "Instagram",
} as const;

// Template display names
const TEMPLATE_NAMES = {
  "pre-event": "Pre-Event Announcement",
  "day-of": "Day-Of Announcement",
  "post-event": "Post-Event Recap",
} as const;

export function GenerateAnnouncementDialog({
  open,
  onOpenChange,
  speaker,
  event,
}: GenerateAnnouncementDialogProps) {
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stage, setStage] = useState<"setup" | "preview">("setup");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [template, setTemplate] = useState<Template>("pre-event");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const characterCount = announcement.length;
  const characterLimit = PLATFORM_LIMITS[platform];
  const isOverLimit = characterCount > characterLimit;
  const canSave = announcement.length > 0 && !isOverLimit && !saved;

  // Track unsaved changes
  useEffect(() => {
    if (stage === "preview" && announcement.length > 0 && !saved) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [announcement, saved, stage]);

  // Reset saved state when announcement changes
  useEffect(() => {
    if (announcement.length > 0 && saved) {
      setSaved(false);
    }
  }, [announcement]);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const response = await fetch("/api/announcements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker,
          event,
          platform,
          template,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate announcement");
      }

      setAnnouncement(data.announcement);
      setStage("preview");
      setSaved(false);

      toast({
        title: "Announcement generated!",
        description: "Review, edit, and save your announcement.",
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

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker_id: speaker.id,
          event_id: event.id,
          announcement_text: announcement,
          platform,
          template,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save announcement");
      }

      setSaved(true);
      setHasUnsavedChanges(false);

      toast({
        title: "Announcement saved!",
        description: `Your ${PLATFORM_NAMES[platform]} announcement has been saved successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save announcement",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      performRegenerate();
    }
  };

  const performRegenerate = () => {
    setStage("setup");
    setAnnouncement("");
    setSaved(false);
    setHasUnsavedChanges(false);
    setShowUnsavedWarning(false);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
    } else {
      performClose();
    }
  };

  const performClose = () => {
    setStage("setup");
    setAnnouncement("");
    setSaved(false);
    setHasUnsavedChanges(false);
    setPlatform("linkedin");
    setTemplate("pre-event");
    setShowUnsavedWarning(false);
    onOpenChange(false);
  };

  const handleAnnouncementChange = (value: string) => {
    setAnnouncement(value);
    if (saved) {
      setSaved(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Speaker Announcement
            </DialogTitle>
            <DialogDescription>
              {stage === "setup"
                ? "Customize your announcement settings and generate AI-powered content."
                : "Review, edit, and save your generated announcement."}
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

              {/* Platform Selector */}
              <div className="space-y-2">
                <Label htmlFor="platform">Target Platform</Label>
                <Select value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{PLATFORM_NAMES.linkedin}</span>
                        <span className="text-xs text-muted-foreground">
                          {PLATFORM_LIMITS.linkedin.toLocaleString()} character limit
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="twitter">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{PLATFORM_NAMES.twitter}</span>
                        <span className="text-xs text-muted-foreground">
                          {PLATFORM_LIMITS.twitter.toLocaleString()} character limit
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="instagram">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{PLATFORM_NAMES.instagram}</span>
                        <span className="text-xs text-muted-foreground">
                          {PLATFORM_LIMITS.instagram.toLocaleString()} character limit
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selector */}
              <div className="space-y-2">
                <Label htmlFor="template">Announcement Type</Label>
                <Select value={template} onValueChange={(value) => setTemplate(value as Template)}>
                  <SelectTrigger id="template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre-event">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{TEMPLATE_NAMES["pre-event"]}</span>
                        <span className="text-xs text-muted-foreground">
                          Build excitement before the event
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="day-of">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{TEMPLATE_NAMES["day-of"]}</span>
                        <span className="text-xs text-muted-foreground">
                          Share during the event
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="post-event">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{TEMPLATE_NAMES["post-event"]}</span>
                        <span className="text-xs text-muted-foreground">
                          Recap and thank attendees
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
              {/* Platform and Template Info */}
              <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs">Platform:</span>
                    <p className="font-medium">{PLATFORM_NAMES[platform]}</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-muted-foreground text-xs">Type:</span>
                    <p className="font-medium">{TEMPLATE_NAMES[template]}</p>
                  </div>
                </div>
              </div>

              {/* Character Count with Limit Warning */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Generated Announcement
                </span>
                <div className="flex items-center gap-2">
                  {isOverLimit && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className={isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {characterCount.toLocaleString()} / {characterLimit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Character Limit Warning */}
              {isOverLimit && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive mb-1">
                        Character limit exceeded
                      </p>
                      <p className="text-destructive/80">
                        This announcement is {(characterCount - characterLimit).toLocaleString()} characters over the {PLATFORM_NAMES[platform]} limit.
                        Please edit to reduce the length before saving.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable Announcement */}
              <div className="space-y-2">
                <Label htmlFor="announcement">Announcement Text</Label>
                <Textarea
                  id="announcement"
                  value={announcement}
                  onChange={(e) => handleAnnouncementChange(e.target.value)}
                  rows={16}
                  className={`resize-none font-sans ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  placeholder="Your generated announcement will appear here..."
                />
                <p className="text-xs text-muted-foreground">
                  Edit the announcement to match your style and voice.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {/* Primary Actions Row */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    variant={saved ? "outline" : "default"}
                    className="flex-1"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : saved ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCopy}
                    disabled={!announcement}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>

                {/* Secondary Actions Row */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your announcement. Are you sure you want to continue?
              Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (stage === "preview") {
                  performRegenerate();
                } else {
                  performClose();
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
