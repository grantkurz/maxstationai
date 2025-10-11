"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Loader2, Trash2, Star, ImageIcon } from "lucide-react";

interface SpeakerImage {
  id: number;
  speaker_id: number;
  storage_path: string;
  public_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  is_primary: boolean;
  created_at: string;
}

interface SpeakerImageGalleryProps {
  speakerId: number;
  refreshTrigger?: number;
}

export function SpeakerImageGallery({
  speakerId,
  refreshTrigger = 0,
}: SpeakerImageGalleryProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<SpeakerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<SpeakerImage | null>(null);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/speakers/${speakerId}/images`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch images");
      }

      setImages(data.images || []);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch images",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [speakerId, refreshTrigger]);

  const handleSetPrimary = async (imageId: number) => {
    setSettingPrimaryId(imageId);

    try {
      const response = await fetch(
        `/api/speakers/${speakerId}/images/${imageId}/primary`,
        {
          method: "PUT",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set primary image");
      }

      toast({
        title: "Primary image updated",
        description: "This image is now the default for social media posts.",
      });

      await fetchImages();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to set primary image",
        variant: "destructive",
      });
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDeleteClick = (image: SpeakerImage) => {
    setImageToDelete(image);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!imageToDelete) return;

    setDeletingId(imageToDelete.id);
    setDeleteDialogOpen(false);

    try {
      const response = await fetch(
        `/api/speakers/${speakerId}/images/${imageToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete image");
      }

      toast({
        title: "Image deleted",
        description: "The image has been removed successfully.",
      });

      await fetchImages();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
      setImageToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Speaker Images</CardTitle>
          <CardDescription>
            Manage images for social media posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Speaker Images</CardTitle>
          <CardDescription>
            Manage images for social media posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No images uploaded yet
            </p>
            <p className="text-xs text-muted-foreground">
              Upload an image above to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Speaker Images ({images.length})</CardTitle>
          <CardDescription>
            Click the star to set an image as primary for social media posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image) => {
              const isDeleting = deletingId === image.id;
              const isSettingPrimary = settingPrimaryId === image.id;

              return (
                <div
                  key={image.id}
                  className={`
                    relative group rounded-lg border overflow-hidden transition-all
                    ${image.is_primary ? "ring-2 ring-primary" : ""}
                    ${isDeleting ? "opacity-50" : ""}
                  `}
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={image.public_url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary Badge */}
                    {image.is_primary && (
                      <Badge
                        className="absolute top-2 left-2 gap-1"
                        variant="default"
                      >
                        <Star className="h-3 w-3 fill-current" />
                        Primary
                      </Badge>
                    )}

                    {/* Overlay with Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {!image.is_primary && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetPrimary(image.id)}
                          disabled={isSettingPrimary}
                        >
                          {isSettingPrimary ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Star className="h-4 w-4 mr-1" />
                          )}
                          Set Primary
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteClick(image)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Image Info */}
                  <div className="p-2 bg-background">
                    <p className="text-xs font-medium truncate">
                      {image.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(image.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone.
              {imageToDelete?.is_primary && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                  This is the primary image. If you delete it, another image
                  will be set as primary automatically.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
