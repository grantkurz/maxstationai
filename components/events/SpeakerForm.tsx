"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface SpeakerFormProps {
  eventId: number;
  speaker?: {
    id: number;
    name: string;
    speaker_title: string;
    speaker_bio: string | null;
    session_title: string;
    session_description: string | null;
  };
  onSuccess?: () => void;
}

export function SpeakerForm({ eventId, speaker, onSuccess }: SpeakerFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    event_id: eventId,
    name: speaker?.name || "",
    speaker_title: speaker?.speaker_title || "",
    speaker_bio: speaker?.speaker_bio || "",
    session_title: speaker?.session_title || "",
    session_description: speaker?.session_description || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = speaker ? `/api/speakers/${speaker.id}` : "/api/speakers";
      const method = speaker ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save speaker");
      }

      toast({
        title: speaker ? "Speaker updated" : "Speaker added",
        description: speaker
          ? "Speaker information has been updated successfully."
          : "Speaker has been added to the event successfully.",
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.back();
        router.refresh();
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save speaker",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Speaker Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., John Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="speaker_title">Speaker Title *</Label>
        <Input
          id="speaker_title"
          value={formData.speaker_title}
          onChange={(e) =>
            setFormData({ ...formData, speaker_title: e.target.value })
          }
          required
          placeholder="e.g., CEO at TechCorp, AI Researcher"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="speaker_bio">Speaker Bio</Label>
        <Textarea
          id="speaker_bio"
          value={formData.speaker_bio}
          onChange={(e) =>
            setFormData({ ...formData, speaker_bio: e.target.value })
          }
          placeholder="Brief biography of the speaker..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="session_title">Session Title *</Label>
        <Input
          id="session_title"
          value={formData.session_title}
          onChange={(e) =>
            setFormData({ ...formData, session_title: e.target.value })
          }
          required
          placeholder="e.g., Building AI-Powered Applications"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="session_description">Session Description</Label>
        <Textarea
          id="session_description"
          value={formData.session_description}
          onChange={(e) =>
            setFormData({ ...formData, session_description: e.target.value })
          }
          placeholder="Description of the session..."
          rows={4}
        />
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : speaker ? "Update Speaker" : "Add Speaker"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
