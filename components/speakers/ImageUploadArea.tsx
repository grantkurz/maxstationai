"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  Loader2,
  ImageIcon,
  AlertCircle,
} from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};

interface ImageUploadAreaProps {
  speakerId: number;
  onUploadSuccess?: () => void;
}

export function ImageUploadArea({
  speakerId,
  onUploadSuccess,
}: ImageUploadAreaProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `Image must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          variant: "destructive",
        });
        return;
      }

      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/speakers/${speakerId}/images`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to upload image");
        }

        toast({
          title: "Image uploaded",
          description: data.is_primary
            ? "Image uploaded and set as primary."
            : "Image uploaded successfully.",
        });

        onUploadSuccess?.();
      } catch (error) {
        toast({
          title: "Upload failed",
          description:
            error instanceof Error ? error.message : "Failed to upload image",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [speakerId, toast, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }
          ${uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <div className="rounded-full bg-primary/10 p-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <div>
                <p className="font-medium text-sm">Uploading image...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please wait
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-full bg-muted p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">
                  {isDragActive
                    ? "Drop image here"
                    : "Drag and drop an image"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>JPG, PNG, GIF, or WebP • Max 10MB</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Image Requirements
            </p>
            <ul className="text-blue-700 dark:text-blue-300 space-y-0.5 list-disc list-inside">
              <li>Instagram requires images for all posts</li>
              <li>First uploaded image becomes the primary image</li>
              <li>Square or landscape images work best for social media</li>
              <li>Recommended minimum size: 1080x1080px</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
