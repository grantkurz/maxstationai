"use client";

import { useState, useCallback } from "react";
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
  Upload,
  X,
  Check,
  Image as ImageIcon,
  Loader2,
  Twitter,
} from "lucide-react";
import { Database } from "@/types/supabase";
import { useDropzone } from "react-dropzone";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

interface PostToXDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for X/Twitter
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

export function PostToXDialog({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: PostToXDialogProps) {
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tweetId, setTweetId] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (!file) return;

      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PNG, JPEG, GIF, or WebP image.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB for X/Twitter.",
          variant: "destructive",
        });
        return;
      }

      setUploadedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: "Image uploaded",
        description: `${file.name} ready to post.`,
      });
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: posting || !!tweetId,
  });

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const handlePost = async () => {
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

      const formData = new FormData();
      formData.append("announcement_id", announcement.id.toString());

      if (uploadedImage) {
        formData.append("image", uploadedImage);
      }

      const response = await fetch("/api/x/post", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to post to X/Twitter");
      }

      setTweetId(data.tweet_id);

      toast({
        title: "Posted successfully!",
        description: "Your announcement is now live on X/Twitter.",
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
      setUploadedImage(null);
      setImagePreview(null);
      setTweetId(null);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5 text-sky-500" />
            Post to X (Twitter)
          </DialogTitle>
          <DialogDescription>
            {tweetId
              ? "Your tweet has been published successfully!"
              : "Review your announcement and optionally add an image before posting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success State */}
          {tweetId && (
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
                    Your announcement is now live on X/Twitter.
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-mono">
                    Tweet ID: {tweetId}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Announcement Preview */}
          <div className="space-y-2">
            <Label>Announcement</Label>
            <Textarea
              value={announcement.announcement_text}
              readOnly
              rows={12}
              className="resize-none bg-muted/50 font-sans"
              placeholder="Your announcement text..."
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{announcement.platform.charAt(0).toUpperCase() + announcement.platform.slice(1)}</span>
              <span>{announcement.announcement_text.length} characters</span>
            </div>
          </div>

          {/* Image Upload Section */}
          {!tweetId && (
            <div className="space-y-3">
              <Label>Image (Optional)</Label>

              {!imagePreview ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-sky-500 bg-sky-500/5"
                      : "border-muted-foreground/25 hover:border-sky-500/50 hover:bg-muted/50"
                  } ${posting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isDragActive ? "Drop image here" : "Drag & drop image here"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPEG, GIF, or WebP • Max 5MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-lg border overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Upload preview"
                    className="w-full h-auto max-h-96 object-contain bg-muted"
                  />
                  {!posting && (
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
                  {uploadedImage && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        <span className="truncate">{uploadedImage.name}</span>
                        <span className="text-muted-foreground ml-auto">
                          {(uploadedImage.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {posting && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Posting...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {!tweetId ? (
              <>
                <Button
                  onClick={handlePost}
                  disabled={posting}
                  className="flex-1 bg-sky-500 hover:bg-sky-600"
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
