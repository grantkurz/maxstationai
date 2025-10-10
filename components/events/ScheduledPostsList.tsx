"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Trash2,
  RefreshCw,
  Calendar,
  Filter,
  ExternalLink,
} from "lucide-react";
import { Database } from "@/types/supabase";

type ScheduledPost = Database["public"]["Tables"]["scheduled_posts"]["Row"];
type Speaker = Database["public"]["Tables"]["speakers"]["Row"];

interface ScheduledPostsListProps {
  scheduledPosts: Array<ScheduledPost & { speaker: Speaker }>;
  onUpdate?: () => void;
}

type StatusFilter = "all" | "pending" | "posted" | "failed" | "cancelled";
type PlatformFilter = "all" | "linkedin" | "twitter" | "instagram";

const statusColors = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  posted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

const platformColors = {
  linkedin: "bg-blue-600 text-white",
  twitter: "bg-sky-500 text-white",
  instagram: "bg-pink-600 text-white",
};

export function ScheduledPostsList({
  scheduledPosts,
  onUpdate,
}: ScheduledPostsListProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Filter posts
  const filteredPosts = scheduledPosts.filter((post) => {
    if (statusFilter !== "all" && post.status !== statusFilter) return false;
    if (platformFilter !== "all" && post.platform !== platformFilter) return false;
    return true;
  });

  // Sort posts
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const dateA = new Date(a.scheduled_time).getTime();
    const dateB = new Date(b.scheduled_time).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  const handleCancel = async (postId: number) => {
    setCancellingId(postId);

    try {
      const response = await fetch(`/api/posts/schedule/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel scheduled post");
      }

      toast({
        title: "Schedule cancelled",
        description: "The scheduled post has been cancelled.",
      });

      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to cancel schedule",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleRetry = async (postId: number) => {
    setRetryingId(postId);

    try {
      const response = await fetch(`/api/posts/schedule/${postId}/retry`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to retry post");
      }

      toast({
        title: "Post retried",
        description: "The post is being retried now.",
      });

      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to retry post",
        variant: "destructive",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      return "Past due";
    } else if (diffMins < 60) {
      return `in ${diffMins}m`;
    } else if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      return `in ${diffDays}d`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="twitter">Twitter/X</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        >
          <Calendar className="h-4 w-4 mr-2" />
          {sortOrder === "asc" ? "Earliest First" : "Latest First"}
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          {sortedPosts.length} {sortedPosts.length === 1 ? "post" : "posts"}
        </div>
      </div>

      {/* Table */}
      {sortedPosts.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No scheduled posts</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all" || platformFilter !== "all"
              ? "No posts match the selected filters."
              : "Schedule your first post to get started."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Speaker</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.map((post) => {
                const { date, time } = formatDateTime(post.scheduled_time);
                const relativeTime = getRelativeTime(post.scheduled_time);

                return (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{post.speaker.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {post.speaker.session_title}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={platformColors[post.platform]}>
                        {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{date}</div>
                        <div className="text-sm text-muted-foreground">
                          {time} {post.status === "pending" && `• ${relativeTime}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[post.status]}
                      >
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </Badge>
                      {post.retry_count > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Retries: {post.retry_count}
                        </div>
                      )}
                      {post.error_message && (
                        <div className="text-xs text-destructive mt-1 max-w-xs truncate">
                          {post.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {post.status === "posted" && post.posted_urn && post.platform === "linkedin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://www.linkedin.com/feed/update/${post.posted_urn}`, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {post.status === "posted" && post.posted_urn && post.platform === "instagram" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://www.instagram.com/p/${post.posted_urn}`, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}

                        {post.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(post.id)}
                            disabled={retryingId === post.id}
                          >
                            {retryingId === post.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Retry
                              </>
                            )}
                          </Button>
                        )}

                        {post.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(post.id)}
                            disabled={cancellingId === post.id}
                          >
                            {cancellingId === post.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
