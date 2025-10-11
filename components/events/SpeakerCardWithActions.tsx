"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { GenerateAnnouncementButton } from "./GenerateAnnouncementButton";
import { PostDialog } from "./PostDialog";
import { PostToLinkedInDialog } from "./PostToLinkedInDialog";
import { PostToXDialog } from "./PostToXDialog";
import { SchedulePostDialog } from "./SchedulePostDialog";
import { Send, Calendar, Loader2 } from "lucide-react";
import { Database } from "@/types/supabase";

type Speaker = Database["public"]["Tables"]["speakers"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];
type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];

interface SpeakerCardWithActionsProps {
  speaker: Speaker;
  event: Event;
}

export function SpeakerCardWithActions({
  speaker,
  event,
}: SpeakerCardWithActionsProps) {
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedInPostDialogOpen, setLinkedInPostDialogOpen] = useState(false);
  const [xPostDialogOpen, setXPostDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<"linkedin" | "twitter">("linkedin");

  // Fetch announcement for this speaker
  const fetchAnnouncement = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/announcements?speaker_id=${speaker.id}`
      );
      const data = await response.json();

      if (response.ok && data.announcements?.length > 0) {
        // Get the most recent announcement
        const latestAnnouncement = data.announcements[0];
        setAnnouncement(latestAnnouncement);

        // Fetch scheduled posts for this announcement
        await fetchScheduledPosts(latestAnnouncement.id);
      }
    } catch (error) {
      console.error("Failed to fetch announcement:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledPosts = async (announcementId: number) => {
    try {
      const response = await fetch(
        `/api/posts/schedule?announcement_id=${announcementId}`
      );
      const data = await response.json();

      if (response.ok && data.scheduled_posts) {
        setScheduledPosts(data.scheduled_posts);
      }
    } catch (error) {
      console.error("Failed to fetch scheduled posts:", error);
    }
  };

  // Fetch primary image for the speaker
  const fetchPrimaryImage = async () => {
    try {
      const response = await fetch(`/api/speakers/${speaker.id}/images`);
      const data = await response.json();

      if (response.ok && data.images?.length > 0) {
        const primary = data.images.find((img: any) => img.is_primary);
        if (primary) {
          setPrimaryImageUrl(primary.public_url);
        }
      }
    } catch (error) {
      console.error("Failed to fetch primary image:", error);
    }
  };

  useEffect(() => {
    fetchAnnouncement();
    fetchPrimaryImage();
  }, [speaker.id]);

  const handleOpenLinkedInPost = () => {
    if (!announcement) {
      toast({
        title: "No announcement",
        description: "Please generate an announcement first.",
        variant: "destructive",
      });
      return;
    }
    setLinkedInPostDialogOpen(true);
  };

  const handleOpenXPost = () => {
    if (!announcement) {
      toast({
        title: "No announcement",
        description: "Please generate an announcement first.",
        variant: "destructive",
      });
      return;
    }
    setXPostDialogOpen(true);
  };

  const handleOpenSchedule = (platform: "linkedin" | "twitter") => {
    if (!announcement) {
      toast({
        title: "No announcement",
        description: "Please generate an announcement first.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPlatform(platform);
    setScheduleDialogOpen(true);
  };

  const handleSuccess = () => {
    // Refetch data after successful post/schedule
    fetchAnnouncement();
  };

  return (
    <>
      <Card>
        <CardHeader>
          {/* Speaker Image */}
          {primaryImageUrl && (
            <div className="mb-4 rounded-lg overflow-hidden border bg-muted">
              <img
                src={primaryImageUrl}
                alt={speaker.name}
                className="w-full aspect-video object-cover"
              />
            </div>
          )}

          <CardTitle>{speaker.name}</CardTitle>
          <CardDescription>{speaker.speaker_title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="font-medium">Session:</span>{" "}
            {speaker.session_title}
          </div>
          {speaker.speaker_bio && (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {speaker.speaker_bio}
            </div>
          )}
          {speaker.session_description && (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {speaker.session_description}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-4 border-t mt-4">
            {/* Generate Announcement Button */}
            <GenerateAnnouncementButton
              speaker={speaker}
              event={event}
              variant="default"
              size="sm"
              className="w-full"
            />

            {/* Post and Schedule Buttons */}
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : announcement ? (
              <div className="space-y-2">
                {/* LinkedIn Buttons */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground w-16">LinkedIn</span>
                  <div className="grid grid-cols-2 gap-1 flex-1">
                    <Button
                      onClick={handleOpenLinkedInPost}
                      variant="default"
                      size="sm"
                      className="w-full"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Post
                    </Button>
                    <Button
                      onClick={() => handleOpenSchedule("linkedin")}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Schedule
                    </Button>
                  </div>
                </div>

                {/* X/Twitter Buttons */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground w-16">X</span>
                  <div className="grid grid-cols-2 gap-1 flex-1">
                    <Button
                      onClick={handleOpenXPost}
                      variant="default"
                      size="sm"
                      className="w-full bg-sky-500 hover:bg-sky-600"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Post
                    </Button>
                    <Button
                      onClick={() => handleOpenSchedule("twitter")}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Schedule
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Generate an announcement to enable posting
              </p>
            )}

            {/* Details Button */}
            <Link
              href={`/events/${event.id}/speakers/${speaker.id}`}
              className="block"
            >
              <Button size="sm" variant="ghost" className="w-full">
                View Details
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {announcement && (
        <>
          <PostDialog
            open={postDialogOpen}
            onOpenChange={setPostDialogOpen}
            announcement={announcement}
            onSuccess={handleSuccess}
          />

          {/* Schedule Dialog - platform aware */}
          <SchedulePostDialog
            open={scheduleDialogOpen}
            onOpenChange={setScheduleDialogOpen}
            announcement={{...announcement, platform: selectedPlatform}}
            existingSchedules={scheduledPosts}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </>
  );
}
