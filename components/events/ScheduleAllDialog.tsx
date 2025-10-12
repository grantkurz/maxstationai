"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Upload, X as XIcon } from "lucide-react";
import { Database } from "@/types/supabase";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];

interface ScheduleAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement;
  primaryImageUrl?: string | null;
  onSuccess?: () => void;
}

export function ScheduleAllDialog({
  open,
  onOpenChange,
  announcement,
  primaryImageUrl,
  onSuccess,
}: ScheduleAllDialogProps) {
  const { toast } = useToast();
  const [scheduling, setScheduling] = useState(false);
  const [postText, setPostText] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      setPostText(announcement.announcement_text || "");
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);

      // Set preview to primary image if available
      if (primaryImageUrl) {
        setPreviewUrl(primaryImageUrl);
      } else {
        setPreviewUrl(null);
      }
    }
  }, [open, announcement, primaryImageUrl]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setPreviewUrl(primaryImageUrl || null);
  };

  const handleSchedule = async () => {
    // Validation
    if (!postText.trim()) {
      toast({
        title: "Missing content",
        description: "Please enter post text",
        variant: "destructive",
      });
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: "Missing schedule time",
        description: "Please select a date and time",
        variant: "destructive",
      });
      return;
    }

    // Instagram requires an image
    if (!primaryImageUrl && !uploadedImage) {
      toast({
        title: "Image required",
        description: "Instagram requires an image. Please upload an image or ensure the speaker has a primary image.",
        variant: "destructive",
      });
      return;
    }

    setScheduling(true);

    try {
      // Combine date and time into ISO string
      const scheduledDateTime = new Date(
        `${scheduledDate}T${scheduledTime}`
      ).toISOString();

      // Build FormData
      const formData = new FormData();
      formData.append("post_text", postText);
      formData.append("scheduled_time", scheduledDateTime);
      formData.append("timezone", timezone);

      // Add image if uploaded (for LinkedIn/Twitter)
      if (uploadedImage) {
        formData.append("image", uploadedImage);
      }

      // Add image URL (required for Instagram)
      if (primaryImageUrl) {
        formData.append("image_url", primaryImageUrl);
      } else if (uploadedImage) {
        // If no primary image but user uploaded one, we need to upload it first
        // For now, require primary image for Instagram
        toast({
          title: "Instagram requires primary image",
          description: "Please set a primary speaker image for Instagram posting",
          variant: "destructive",
        });
        setScheduling(false);
        return;
      }

      const response = await fetch(
        `/api/announcements/${announcement.id}/schedule-all`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok || response.status === 207) {
        toast({
          title: "Success!",
          description: data.message,
        });
        onSuccess?.();
        onOpenChange(false);
        // Reset form
        setPostText("");
        setScheduledDate("");
        setScheduledTime("");
        setUploadedImage(null);
        setPreviewUrl(null);
      } else {
        throw new Error(data.error || "Failed to schedule posts");
      }
    } catch (error) {
      console.error("Schedule all error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to schedule posts",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleClose = () => {
    if (!scheduling) {
      onOpenChange(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule to All Platforms</DialogTitle>
          <DialogDescription>
            Schedule this announcement to LinkedIn, X, and Instagram at the same time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Post Text */}
          <div className="space-y-2">
            <Label htmlFor="post-text">Post Text</Label>
            <Textarea
              id="post-text"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="Enter your post text..."
              className="min-h-[120px]"
              disabled={scheduling}
            />
            <p className="text-xs text-muted-foreground">
              {postText.length} characters
            </p>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled-date">Date</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={today}
                disabled={scheduling}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-time">Time</Label>
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={scheduling}
              />
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g., America/Los_Angeles"
              disabled={scheduling}
            />
            <p className="text-xs text-muted-foreground">
              Detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Image (Optional for LinkedIn/X, Required for Instagram)</Label>

            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full max-h-64 object-cover rounded-lg border"
                />
                {uploadedImage && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                    disabled={scheduling}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <span className="text-sm text-primary hover:underline">
                    Click to upload image
                  </span>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={scheduling}
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 10MB (LinkedIn), 5MB (X)
                </p>
              </div>
            )}

            {!primaryImageUrl && !uploadedImage && (
              <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                ⚠️ Instagram requires an image. Please upload one or set a primary speaker image.
              </p>
            )}
          </div>

          {/* Platform Info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-xs">
            <p className="font-medium">This will schedule posts to:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>LinkedIn - Image optional</li>
              <li>X/Twitter - Image optional</li>
              <li>Instagram - Image required (using primary speaker image)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={scheduling}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={scheduling || !postText || !scheduledDate || !scheduledTime}
          >
            {scheduling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              "Schedule to All Platforms"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
