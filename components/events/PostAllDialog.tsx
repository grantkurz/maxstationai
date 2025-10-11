"use client";

import { useState } from "react";
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
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Database } from "@/types/supabase";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

interface PostAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement & { speaker_id: number };
  primaryImageUrl?: string | null;
  onSuccess?: () => void;
}

export function PostAllDialog({
  open,
  onOpenChange,
  announcement,
  primaryImageUrl,
  onSuccess,
}: PostAllDialogProps) {
  const { toast } = useToast();
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<{
    linkedin?: { success: boolean; error?: string };
    twitter?: { success: boolean; error?: string };
    instagram?: { success: boolean; error?: string };
  } | null>(null);

  const handlePostAll = async () => {
    if (!primaryImageUrl) {
      toast({
        title: "Image required",
        description:
          "Instagram requires an image. Please upload a speaker image first.",
        variant: "destructive",
      });
      return;
    }

    setPosting(true);
    setResults(null);

    try {
      const response = await fetch(
        `/api/announcements/${announcement.id}/post-all`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: primaryImageUrl,
          }),
        }
      );

      const data = await response.json();

      if (response.ok || response.status === 207) {
        // Success or partial success
        const platformResults: any = {};

        // Map results
        if (data.results) {
          Object.keys(data.results).forEach((platform) => {
            platformResults[platform] = {
              success: true,
            };
          });
        }

        // Map errors
        if (data.errors) {
          Object.keys(data.errors).forEach((platform) => {
            platformResults[platform] = {
              success: false,
              error: data.errors[platform].error,
            };
          });
        }

        setResults(platformResults);

        if (response.status === 200) {
          toast({
            title: "Success!",
            description: "Posted to all platforms successfully",
          });
        } else {
          toast({
            title: "Partial Success",
            description: data.message,
            variant: "destructive",
          });
        }

        // Wait a bit to show results, then close
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
          setResults(null);
        }, 3000);
      } else {
        throw new Error(data.error || "Failed to post to platforms");
      }
    } catch (error) {
      console.error("Post all error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to post to platforms",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  const handleClose = () => {
    if (!posting) {
      onOpenChange(false);
      setResults(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Post to All Platforms</DialogTitle>
          <DialogDescription>
            Post this announcement to LinkedIn, X, and Instagram simultaneously
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preview */}
          <div>
            <Label>Preview</Label>
            <div className="mt-2 p-3 border rounded-lg bg-muted/50">
              <p className="text-sm whitespace-pre-wrap">
                {announcement.announcement_text}
              </p>
            </div>
          </div>

          {/* Image info */}
          {primaryImageUrl ? (
            <div>
              <Label>Image</Label>
              <div className="mt-2">
                <img
                  src={primaryImageUrl}
                  alt="Post preview"
                  className="w-full max-h-48 object-cover rounded-lg border"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Instagram requires an image. Please upload a speaker image
                first.
              </p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Results</Label>
              {results.linkedin !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {results.linkedin.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">LinkedIn:</span>
                  <span
                    className={
                      results.linkedin.success
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {results.linkedin.success
                      ? "Posted successfully"
                      : results.linkedin.error}
                  </span>
                </div>
              )}
              {results.twitter !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {results.twitter.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">X/Twitter:</span>
                  <span
                    className={
                      results.twitter.success
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {results.twitter.success
                      ? "Posted successfully"
                      : results.twitter.error}
                  </span>
                </div>
              )}
              {results.instagram !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  {results.instagram.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium">Instagram:</span>
                  <span
                    className={
                      results.instagram.success
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {results.instagram.success
                      ? "Posted successfully"
                      : results.instagram.error}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={posting}>
            Cancel
          </Button>
          <Button
            onClick={handlePostAll}
            disabled={posting || !primaryImageUrl}
          >
            {posting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Post to All Platforms"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
