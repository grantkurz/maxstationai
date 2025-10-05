"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Wand2 } from "lucide-react";
import { useDropzone } from "react-dropzone";

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

export function SpeakerFormEnhanced({ eventId, speaker, onSuccess }: SpeakerFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);
  const [textDump, setTextDump] = useState("");
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    event_id: eventId,
    name: speaker?.name || "",
    speaker_title: speaker?.speaker_title || "",
    speaker_bio: speaker?.speaker_bio || "",
    session_title: speaker?.session_title || "",
    session_description: speaker?.session_description || "",
  });

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setExtracting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract text");
      }

      // Parse the extracted text with AI
      await parseTextWithAI(data.text);
      setPdfDialogOpen(false);

      toast({
        title: "Success",
        description: "Speaker information extracted from file!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extract text",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
  });

  const parseTextWithAI = async (text: string) => {
    setAiParsing(true);
    try {
      const response = await fetch("/api/parse-speaker-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse text");
      }

      // Update form with parsed data
      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        speaker_title: data.speaker_title || prev.speaker_title,
        speaker_bio: data.speaker_bio || prev.speaker_bio,
        session_title: data.session_title || prev.session_title,
        session_description: data.session_description || prev.session_description,
      }));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse text",
        variant: "destructive",
      });
    } finally {
      setAiParsing(false);
    }
  };

  const handleTextDumpParse = async () => {
    if (!textDump.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text to parse",
        variant: "destructive",
      });
      return;
    }

    await parseTextWithAI(textDump);
    setTextDialogOpen(false);
    setTextDump("");
  };

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
    <div className="space-y-6">
      {/* Import Options */}
      <div className="flex gap-2 justify-end">
        <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import from PDF/Image
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Speaker Information</DialogTitle>
              <DialogDescription>
                Upload a PDF or image file and we'll automatically extract the speaker information.
              </DialogDescription>
            </DialogHeader>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {extracting ? (
                <p className="text-sm text-muted-foreground">Extracting text...</p>
              ) : isDragActive ? (
                <p className="text-sm text-muted-foreground">Drop the file here...</p>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Drop a PDF or image here, or click to select
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, PNG, JPG, JPEG, WEBP
                  </p>
                </div>
              )}
            </div>
            {aiParsing && (
              <p className="text-sm text-center text-muted-foreground">
                AI is parsing the extracted text...
              </p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Wand2 className="h-4 w-4 mr-2" />
              AI Text Parse
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paste Speaker Information</DialogTitle>
              <DialogDescription>
                Paste any text about the speaker and AI will automatically fill the form fields.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={textDump}
              onChange={(e) => setTextDump(e.target.value)}
              placeholder="Paste speaker bio, session details, or any relevant text here..."
              rows={8}
              className="resize-none"
            />
            <Button
              onClick={handleTextDumpParse}
              disabled={!textDump.trim() || aiParsing}
            >
              {aiParsing ? "Parsing..." : "Parse with AI"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Form */}
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
    </div>
  );
}
