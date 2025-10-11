"use client";

import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Check,
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Database } from "@/types/supabase";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

interface PostToInstagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement & { speaker_id?: number };
  onSuccess?: () => void;
}

export function PostToInstagramDialog({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: PostToInstagramDialogProps) {
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);

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
        } else {
          setPrimaryImageUrl(null);
        }
      } else {
        setPrimaryImageUrl(null);
      }
    } catch (error) {
      console.error("Failed to fetch primary image:", error);
      setPrimaryImageUrl(null);
      toast({
        title: "Error",
        description: "Failed to load speaker image.",
        variant: "destructive",
      });
    } finally {
      setLoadingImage(false);
    }
  };

  const handlePost = async () => {
    if (!primaryImageUrl) {
      toast({
        title: "Image required",
        description: "Instagram posts require an image. Please upload a speaker image first.",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("/api/instagram/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_id: announcement.id,
          image_url: primaryImageUrl,
          caption: announcement.announcement_text,
        }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to post to Instagram");
      }

      setMediaId(data.media_id);

      toast({
        title: "Posted successfully!",
        description: "Your announcement is now live on Instagram.",
      });

      onSuccess?.();
    } catch (error) {
      setUploadProgress(0);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to post announcement",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (!posting) {
      setPrimaryImageUrl(null);
      setMediaId(null);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-pink-600" />
            Post to Instagram
          </DialogTitle>
          <DialogDescription>
            {mediaId
              ? "Your post has been published successfully!"
              : "Review your announcement before posting to Instagram."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success State */}
          {mediaId && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 dark:bg-green-900 p-1">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                    Posted successfully!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your announcement is now live on Instagram.
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-mono">
                    Media ID: {mediaId}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Announcement Preview */}
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              value={announcement.announcement_text}
              readOnly
              rows={12}
              className="resize-none bg-muted/50 font-sans"
              placeholder="Your announcement text..."
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Instagram</span>
              <span>{announcement.announcement_text.length} characters</span>
            </div>
          </div>

          {/* Image Display */}
          {!mediaId && (
            <div className="space-y-3">
              <Label>
                Image <span className="text-destructive">*</span>
              </Label>

              {loadingImage ? (
                <div className="flex items-center justify-center py-12 border rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : primaryImageUrl ? (
                <div className="rounded-lg border overflow-hidden">
                  <img
                    src={primaryImageUrl}
                    alt="Speaker"
                    className="w-full h-auto max-h-96 object-contain bg-muted"
                  />
                  <div className="bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>Speaker primary image</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                        No speaker image available
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        Instagram requires an image for all posts. Please upload a speaker image in the speaker profile before posting to Instagram.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                        className="border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/50"
                      >
                        Go to Speaker Profile
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {posting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Posting to Instagram...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {!mediaId ? (
              <>
                <Button
                  onClick={handlePost}
                  disabled={posting || !primaryImageUrl || loadingImage}
                  className="flex-1 bg-pink-600 hover:bg-pink-700"
                  size="lg"
                >
                  {posting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Post Now
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={posting}
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
