"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Upload,
  X,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Database } from "@/types/supabase";
import { useDropzone } from "react-dropzone";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type Platform = "linkedin" | "instagram";

interface PostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const PLATFORM_INFO = {
  linkedin: {
    name: "LinkedIn",
    icon: "💼",
    supportsText: true,
    supportsImage: true,
    requiresImage: false,
    imageMethod: "upload", // Upload file directly
  },
  instagram: {
    name: "Instagram",
    icon: "📸",
    supportsText: true,
    supportsImage: true,
    requiresImage: true, // Instagram requires an image
    imageMethod: "url", // Must provide URL (not upload)
  },
} as const;

export function PostDialog({
  open,
  onOpenChange,
  announcement,
  onSuccess,
}: PostDialogProps) {
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [postUrn, setPostUrn] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(
    announcement.platform as Platform
  );

  const platformInfo = PLATFORM_INFO[selectedPlatform];
  const canPost = selectedPlatform === "linkedin"
    ? true // LinkedIn doesn't require image
    : !!primaryImageUrl; // Instagram requires primary image

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

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];

      if (!file) return;

      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PNG or JPEG image.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB.",
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
    },
    maxFiles: 1,
    disabled: posting || !!postUrn,
  });

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const handlePost = async () => {
    if (!canPost) {
      toast({
        title: "Cannot post",
        description: selectedPlatform === "instagram"
          ? "Instagram requires a speaker image. Please upload one in the speaker profile."
          : "Please check your post requirements.",
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

      if (selectedPlatform === "linkedin") {
        // LinkedIn: Use FormData with file upload
        const formData = new FormData();
        formData.append("announcement_id", announcement.id.toString());
        formData.append("post_text", announcement.announcement_text);
        formData.append("platform", "linkedin");

        // For LinkedIn, prefer uploaded image over primary image
        if (uploadedImage) {
          formData.append("image", uploadedImage);
        } else if (primaryImageUrl) {
          // Fetch the primary image and convert to blob
          const imageBlob = await fetch(primaryImageUrl).then(r => r.blob());
          formData.append("image", imageBlob, "speaker-image.jpg");
        }

        const response = await fetch("/api/linkedin/post", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to post to LinkedIn");
        }

        setPostUrn(data.post_urn);

        toast({
          title: "Posted successfully!",
          description: "Your announcement is now live on LinkedIn.",
        });
      } else if (selectedPlatform === "instagram") {
        // Instagram: Use primary image URL
        if (!primaryImageUrl) {
          throw new Error("No primary image available for Instagram post");
        }

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

        setPostUrn(data.media_id);

        toast({
          title: "Posted successfully!",
          description: "Your announcement is now live on Instagram.",
        });
      }

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
      setPrimaryImageUrl(null);
      setPostUrn(null);
      setUploadProgress(0);
      setSelectedPlatform(announcement.platform as Platform);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Post to Social Media
          </DialogTitle>
          <DialogDescription>
            {postUrn
              ? "Your post has been published successfully!"
              : "Choose a platform and review your announcement before posting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success State */}
          {postUrn && (
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
                    Your announcement is now live on {platformInfo.name}.
                  </p>
                  {selectedPlatform === "linkedin" && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-mono">
                      URN: {postUrn}
                    </p>
                  )}
                  {selectedPlatform === "instagram" && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-mono">
                      Media ID: {postUrn}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Platform Selection */}
          {!postUrn && (
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={selectedPlatform}
                onValueChange={(value) => setSelectedPlatform(value as Platform)}
                disabled={posting}
              >
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linkedin">
                    <div className="flex items-center gap-2">
                      <span>{PLATFORM_INFO.linkedin.icon}</span>
                      <span className="font-medium">{PLATFORM_INFO.linkedin.name}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="instagram">
                    <div className="flex items-center gap-2">
                      <span>{PLATFORM_INFO.instagram.icon}</span>
                      <span className="font-medium">{PLATFORM_INFO.instagram.name}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {platformInfo.requiresImage
                  ? `${platformInfo.name} requires an image`
                  : `${platformInfo.name} supports optional images`}
              </p>
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
              <span>
                {platformInfo.name}
              </span>
              <span>{announcement.announcement_text.length} characters</span>
            </div>
          </div>

          {/* Image Section */}
          {!postUrn && (
            <>
              {selectedPlatform === "linkedin" && (
                <div className="space-y-3">
                  <Label>
                    Image (Optional)
                  </Label>

                  {loadingImage ? (
                    <div className="flex items-center justify-center py-8 border rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !imagePreview ? (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                      } ${posting ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center gap-2">
                        <div className="rounded-full bg-muted p-3">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {isDragActive
                              ? "Drop image here"
                              : "Drag & drop image here"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            or click to browse
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          PNG or JPEG, max 5MB
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
                      {!posting && uploadedImage && (
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
                      {!uploadedImage && primaryImageUrl && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
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
                        className="w-full h-auto max-h-96 object-contain bg-muted"
                      />
                      <div className="bg-muted p-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          <span>Using speaker primary image</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                            No speaker image available
                          </p>
                          <p className="text-amber-700 dark:text-amber-300">
                            Instagram requires an image for all posts. Please upload a speaker image in the speaker profile before posting to Instagram.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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
            {!postUrn ? (
              <>
                <Button
                  onClick={handlePost}
                  disabled={posting || !canPost}
                  className="flex-1"
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
                      Post to {platformInfo.name}
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
