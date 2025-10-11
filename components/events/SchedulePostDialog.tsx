"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Calendar as CalendarIcon,
  Upload,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Database } from "@/types/supabase";
import { useDropzone } from "react-dropzone";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];

interface SchedulePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement;
  existingSchedules?: ScheduledPost[];
  onSuccess?: () => void;
}

const MAX_FILE_SIZE_LINKEDIN = 10 * 1024 * 1024; // 10MB for LinkedIn
const MAX_FILE_SIZE_X = 5 * 1024 * 1024; // 5MB for X/Twitter
const ACCEPTED_IMAGE_TYPES_LINKEDIN = ["image/png", "image/jpeg", "image/jpg"];
const ACCEPTED_IMAGE_TYPES_X = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

// Get user's timezone
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Get tomorrow at 9am as default
const getDefaultDateTime = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const hours = String(tomorrow.getHours()).padStart(2, '0');
  const minutes = String(tomorrow.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
};

export function SchedulePostDialog({
  open,
  onOpenChange,
  announcement,
  existingSchedules = [],
  onSuccess,
}: SchedulePostDialogProps) {
  const { toast } = useToast();
  const defaultDateTime = getDefaultDateTime();

  const [scheduling, setScheduling] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<"linkedin" | "instagram">(
    announcement.platform as "linkedin" | "instagram"
  );

  // Form state
  const [selectedDate, setSelectedDate] = useState(defaultDateTime.date);
  const [selectedTime, setSelectedTime] = useState(defaultDateTime.time);
  const [selectedTimezone, setSelectedTimezone] = useState(getUserTimezone());

  // Calculate scheduled datetime
  const getScheduledDateTime = () => {
    const datetime = new Date(`${selectedDate}T${selectedTime}`);
    return datetime;
  };

  const scheduledDateTime = getScheduledDateTime();
  const now = new Date();
  const isPastDate = scheduledDateTime <= now;
  const daysDifference = Math.ceil((scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isMoreThan30Days = daysDifference > 30;

  // Validation: Instagram requires primary image
  const hasRequiredImage = selectedPlatform === "linkedin"
    ? true // LinkedIn doesn't require image
    : !!primaryImageUrl; // Instagram requires primary image

  const canSchedule = !isPastDate && selectedDate && selectedTime && !scheduling && !scheduled && hasRequiredImage;

  // Fetch primary image when dialog opens
  useEffect(() => {
    if (open && announcement.speaker_id) {
      fetchPrimaryImage();
    }
  }, [open, announcement.speaker_id]);

  const fetchPrimaryImage = async () => {
    setLoadingImage(true);
    try {
      const response = await fetch(`/api/speakers/${announcement.speaker_id}/images`);
      const data = await response.json();

      if (response.ok && data.images?.length > 0) {
        const primary = data.images.find((img: any) => img.is_primary);
        if (primary) {
          setPrimaryImageUrl(primary.public_url);
          setImagePreview(primary.public_url);
        } else {
          setPrimaryImageUrl(null);
        }
      } else {
        setPrimaryImageUrl(null);
      }
    } catch (error) {
      console.error("Failed to fetch primary image:", error);
      setPrimaryImageUrl(null);
    } finally {
      setLoadingImage(false);
    }
  };

  // Platform-specific constraints
  const isXPlatform = announcement.platform === "twitter" || announcement.platform === "x";
  const maxFileSize = isXPlatform ? MAX_FILE_SIZE_X : MAX_FILE_SIZE_LINKEDIN;
  const acceptedImageTypes = isXPlatform
    ? ACCEPTED_IMAGE_TYPES_X
    : ACCEPTED_IMAGE_TYPES_LINKEDIN;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (!file) return;

    if (!acceptedImageTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: isXPlatform
          ? "Please upload a PNG, JPEG, GIF, or WebP image."
          : "Please upload a PNG or JPEG image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxFileSize) {
      const maxSizeMB = maxFileSize / 1024 / 1024;
      toast({
        title: "File too large",
        description: `Image must be less than ${maxSizeMB}MB for ${
          isXPlatform ? "X/Twitter" : "LinkedIn"
        }.`,
        variant: "destructive",
      });
      return;
    }

    setUploadedImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast({
      title: "Image uploaded",
      description: `${file.name} ready to schedule.`,
    });
  }, [toast]);

  const dropzoneAccept = isXPlatform
    ? ({
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/gif": [".gif"],
        "image/webp": [".webp"],
      } as const)
    : ({
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
      } as const);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept as any,
    maxFiles: 1,
    disabled: scheduling || scheduled,
  });

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const handleSchedule = async () => {
    if (!canSchedule) return;

    setScheduling(true);

    try {
      const formData = new FormData();
      formData.append("announcement_id", announcement.id.toString());
      formData.append("post_text", announcement.announcement_text);
      formData.append("platform", selectedPlatform);
      formData.append("scheduled_time", scheduledDateTime.toISOString());
      formData.append("timezone", selectedTimezone);

      // For LinkedIn: upload image file or use primary image
      if (selectedPlatform === "linkedin") {
        if (uploadedImage) {
          formData.append("image", uploadedImage);
        } else if (primaryImageUrl) {
          // Fetch the primary image and convert to blob
          const imageBlob = await fetch(primaryImageUrl).then(r => r.blob());
          formData.append("image", imageBlob, "speaker-image.jpg");
        }
      }

      // For Instagram: use primary image URL
      if (selectedPlatform === "instagram" && primaryImageUrl) {
        formData.append("image_url", primaryImageUrl);
      }

      // Determine the correct API endpoint
      const apiEndpoint = isXPlatform ? "/api/x/schedule" : "/api/posts/schedule";

      let response;

      if (isXPlatform) {
        // X API uses JSON
        response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            announcement_id: announcement.id,
            scheduled_time: scheduledDateTime.toISOString(),
            timezone: selectedTimezone,
            image_url: imageUrl,
          }),
        });
      } else {
        // LinkedIn API uses FormData
        const formData = new FormData();
        formData.append("announcement_id", announcement.id.toString());
        formData.append("post_text", announcement.announcement_text);
        formData.append("platform", announcement.platform);
        formData.append("scheduled_time", scheduledDateTime.toISOString());
        formData.append("timezone", selectedTimezone);

        if (uploadedImage) {
          formData.append("image", uploadedImage);
        }

        response = await fetch(apiEndpoint, {
          method: "POST",
          body: formData,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule post");
      }

      setScheduled(true);

      toast({
        title: "Post scheduled!",
        description: `Your post will be published on ${scheduledDateTime.toLocaleDateString()} at ${scheduledDateTime.toLocaleTimeString()}.`,
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to schedule post",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelSchedule = async (scheduleId: number) => {
    try {
      // Use platform-specific endpoint for X, generic endpoint for others
      const endpoint = isXPlatform
        ? `/api/x/scheduled/${scheduleId}`
        : `/api/posts/schedule/${scheduleId}`;

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel scheduled post");
      }

      toast({
        title: "Schedule cancelled",
        description: "The scheduled post has been cancelled.",
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to cancel schedule",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!scheduling) {
      setUploadedImage(null);
      setImagePreview(null);
      setPrimaryImageUrl(null);
      setScheduled(false);
      setSelectedDate(defaultDateTime.date);
      setSelectedTime(defaultDateTime.time);
      setSelectedTimezone(getUserTimezone());
      setSelectedPlatform(announcement.platform as "linkedin" | "instagram");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Schedule Post
          </DialogTitle>
          <DialogDescription>
            {scheduled
              ? "Your post has been scheduled successfully!"
              : "Schedule your announcement to be posted automatically at a specific time."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success State */}
          {scheduled && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-1">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                    Scheduled successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your post will be published on {scheduledDateTime.toLocaleDateString()} at {scheduledDateTime.toLocaleTimeString()}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Existing Schedules */}
          {existingSchedules.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Scheduled Posts</Label>
              <div className="rounded-lg border divide-y">
                {existingSchedules.map((schedule) => (
                  <div key={schedule.id} className="p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {new Date(schedule.scheduled_time).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(schedule.scheduled_time).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {schedule.platform.charAt(0).toUpperCase() + schedule.platform.slice(1)} • {schedule.timezone}
                      </p>
                    </div>
                    {schedule.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelSchedule(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!scheduled && (
            <>
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(value) => setSelectedPlatform(value as "linkedin" | "instagram")}
                  disabled={scheduling}
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">
                      <div className="flex items-center gap-2">
                        <span>💼</span>
                        <span className="font-medium">LinkedIn</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="instagram">
                      <div className="flex items-center gap-2">
                        <span>📸</span>
                        <span className="font-medium">Instagram</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedPlatform === "instagram"
                    ? "Instagram requires an image"
                    : "LinkedIn supports optional images"}
                </p>
              </div>

              {/* Announcement Preview */}
              <div className="space-y-2">
                <Label>Announcement</Label>
                <Textarea
                  value={announcement.announcement_text}
                  readOnly
                  rows={8}
                  className="resize-none bg-muted/50 font-sans text-sm"
                  placeholder="Your announcement text..."
                />
              </div>

              {/* Date and Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={isPastDate ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className={isPastDate ? "border-destructive" : ""}
                  />
                </div>
              </div>

              {/* Timezone Selection */}
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selected time: {scheduledDateTime.toLocaleString()}
                </p>
              </div>

              {/* Validation Warnings */}
              {isPastDate && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">
                        Invalid date/time
                      </p>
                      <p className="text-destructive/80">
                        Please select a future date and time.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isMoreThan30Days && !isPastDate && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        Scheduling far in advance
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        This post is scheduled {daysDifference} days from now. Consider reviewing closer to the date.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Image Upload/URL */}
              {selectedPlatform === "linkedin" && (
                <div className="space-y-3">
                  <Label>Image (Optional)</Label>

                  {loadingImage ? (
                    <div className="flex items-center justify-center py-8 border rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !imagePreview ? (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded-full bg-muted p-2">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {isDragActive ? "Drop image here" : "Drag & drop image here"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG or JPEG, max 5MB
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-lg border overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Upload preview"
                        className="w-full h-auto max-h-64 object-contain bg-muted"
                      />
                      {!scheduling && uploadedImage && (
                        <Button
                          onClick={removeImage}
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                      {!uploadedImage && primaryImageUrl && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-3 w-3" />
                            <span>Speaker primary image</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedPlatform === "instagram" && (
                <div className="space-y-3">
                  <Label>
                    Image (Required) <span className="text-destructive">*</span>
                  </Label>

                  {loadingImage ? (
                    <div className="flex items-center justify-center py-8 border rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : primaryImageUrl ? (
                    <div className="rounded-lg border overflow-hidden">
                      <img
                        src={primaryImageUrl}
                        alt="Speaker primary image"
                        className="w-full h-auto max-h-64 object-contain bg-muted"
                      />
                      <div className="bg-muted p-2 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span>Using speaker primary image</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                            No speaker image available
                          </p>
                          <p className="text-amber-700 dark:text-amber-300">
                            Instagram requires an image for all posts. Please upload a speaker image in the speaker profile before scheduling to Instagram.
                          </p>
                        </div>
                      <div>
                        <p className="text-sm font-medium">
                          {isDragActive ? "Drop image here" : "Drag & drop image here"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isXPlatform
                            ? "PNG, JPEG, GIF, or WebP • Max 5MB"
                            : "PNG or JPEG • Max 10MB"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {!scheduled ? (
              <>
                <Button
                  onClick={handleSchedule}
                  disabled={!canSchedule}
                  className="flex-1"
                  size="lg"
                >
                  {scheduling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Schedule Post
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={scheduling}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={handleClose} className="w-full" size="lg">
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
