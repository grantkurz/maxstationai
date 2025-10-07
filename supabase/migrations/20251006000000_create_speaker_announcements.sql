-- Create announcements table
-- This table stores AI-generated announcements for speakers at events
CREATE TABLE IF NOT EXISTS public.announcements (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Track who created this (for RLS)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Foreign keys
  speaker_id BIGINT NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Announcement content and metadata
  announcement_text TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'instagram')),
  template TEXT NOT NULL CHECK (template IN ('pre-event', 'day-of', 'post-event', 'custom')),

  -- Character count for quick reference (platform limits)
  character_count INTEGER NOT NULL
);

-- Create indexes for performance optimization
-- Index on speaker_id for quick lookup of all announcements for a speaker
CREATE INDEX idx_announcements_speaker_id ON public.announcements(speaker_id);

-- Index on event_id for quick lookup of all announcements for an event
CREATE INDEX idx_announcements_event_id ON public.announcements(event_id);

-- Index on user_id for RLS performance
CREATE INDEX idx_announcements_user_id ON public.announcements(user_id);

-- Composite index for common query patterns (user's announcements sorted by date)
CREATE INDEX idx_announcements_user_created ON public.announcements(user_id, created_at DESC);

-- Index on platform for filtering by social media platform
CREATE INDEX idx_announcements_platform ON public.announcements(platform);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own announcements
CREATE POLICY "Users can view own announcements"
  ON public.announcements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert announcements for their own speakers/events
CREATE POLICY "Users can create announcements for own speakers"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.user_id = auth.uid()
    )
  );

-- Users can only update their own announcements
CREATE POLICY "Users can update own announcements"
  ON public.announcements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own announcements
CREATE POLICY "Users can delete own announcements"
  ON public.announcements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.announcements IS 'Stores AI-generated social media announcements for event speakers';
COMMENT ON COLUMN public.announcements.user_id IS 'User who owns this announcement';
COMMENT ON COLUMN public.announcements.speaker_id IS 'Foreign key to speakers table';
COMMENT ON COLUMN public.announcements.event_id IS 'Foreign key to events table (denormalized for query optimization)';
COMMENT ON COLUMN public.announcements.announcement_text IS 'The generated announcement content';
COMMENT ON COLUMN public.announcements.platform IS 'Social media platform (linkedin, twitter, instagram)';
COMMENT ON COLUMN public.announcements.template IS 'Type of announcement template used';
COMMENT ON COLUMN public.announcements.character_count IS 'Character count for platform limit validation';
