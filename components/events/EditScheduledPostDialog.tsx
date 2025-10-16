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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Clock } from "lucide-react";

type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];

interface EditScheduledPostDialogProps {
  post: ScheduledPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function EditScheduledPostDialog({
  post,
  open,
  onOpenChange,
  onUpdate,
}: EditScheduledPostDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Parse the current scheduled time
  const currentDate = new Date(post.scheduled_time);
  const [date, setDate] = useState(
    currentDate.toISOString().split("T")[0] // YYYY-MM-DD
  );
  const [time, setTime] = useState(
    currentDate.toTimeString().slice(0, 5) // HH:MM
  );

  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Combine date and time into ISO string
      const scheduledDateTime = new Date(`${date}T${time}:00`);

      // Validate the new time is in the future
      if (scheduledDateTime <= new Date()) {
        toast({
          title: "Invalid Time",
          description: "The scheduled time must be in the future.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/posts/schedule/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_time: scheduledDateTime.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update scheduled post");
      }

      toast({
        title: "Schedule Updated",
        description: "The scheduled post time has been updated.",
      });

      onOpenChange(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating scheduled post:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update scheduled post",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Scheduled Post</DialogTitle>
          <DialogDescription>
            Update the scheduled time for this post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="bg-muted p-3 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Current: {currentDate.toLocaleString()}</span>
            </div>
            {date && time && (
              <div className="mt-2 font-medium">
                New: {new Date(`${date}T${time}:00`).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
