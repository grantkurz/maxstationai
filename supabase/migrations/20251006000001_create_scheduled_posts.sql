-- Create scheduled_posts table
-- This table stores scheduled social media posts with image support
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Track who created this (for RLS)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Foreign keys to related entities
  announcement_id BIGINT NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  speaker_id BIGINT NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Scheduling information
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',

  -- Post metadata
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'instagram')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),

  -- Content (denormalized from announcement for performance)
  post_text TEXT NOT NULL,

  -- Image support (Supabase Storage URL)
  image_url TEXT,

  -- Post tracking (after successful post)
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_urn TEXT, -- LinkedIn URN or Twitter/Instagram post ID

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  last_retry_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT scheduled_time_must_be_future CHECK (
    status = 'cancelled' OR
    status = 'posted' OR
    scheduled_time > created_at
  )
);

-- Create indexes for performance optimization
-- Index on user_id for RLS performance
CREATE INDEX idx_scheduled_posts_user_id ON public.scheduled_posts(user_id);

-- Index on announcement_id for quick lookup of scheduled posts for an announcement
CREATE INDEX idx_scheduled_posts_announcement_id ON public.scheduled_posts(announcement_id);

-- Index on speaker_id for quick lookup
CREATE INDEX idx_scheduled_posts_speaker_id ON public.scheduled_posts(speaker_id);

-- Index on event_id for quick lookup
CREATE INDEX idx_scheduled_posts_event_id ON public.scheduled_posts(event_id);

-- Index on status for filtering pending/posted/failed posts
CREATE INDEX idx_scheduled_posts_status ON public.scheduled_posts(status);

-- Composite index for cron job queries (pending posts sorted by scheduled time)
CREATE INDEX idx_scheduled_posts_pending_scheduled ON public.scheduled_posts(status, scheduled_time ASC)
  WHERE status = 'pending';

-- Composite index for user's posts sorted by scheduled time
CREATE INDEX idx_scheduled_posts_user_scheduled ON public.scheduled_posts(user_id, scheduled_time DESC);

-- Composite index for platform-specific queries
CREATE INDEX idx_scheduled_posts_platform_status ON public.scheduled_posts(platform, status);

-- Create updated_at trigger
CREATE TRIGGER set_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own scheduled posts
CREATE POLICY "Users can view own scheduled posts"
  ON public.scheduled_posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only create scheduled posts for their own announcements
CREATE POLICY "Users can create scheduled posts for own announcements"
  ON public.scheduled_posts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.user_id = auth.uid()
    )
  );

-- Users can only update their own scheduled posts
CREATE POLICY "Users can update own scheduled posts"
  ON public.scheduled_posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own scheduled posts
CREATE POLICY "Users can delete own scheduled posts"
  ON public.scheduled_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.scheduled_posts IS 'Stores scheduled social media posts with image support for LinkedIn, Twitter, and Instagram';
COMMENT ON COLUMN public.scheduled_posts.user_id IS 'User who owns this scheduled post';
COMMENT ON COLUMN public.scheduled_posts.announcement_id IS 'Foreign key to announcements table';
COMMENT ON COLUMN public.scheduled_posts.speaker_id IS 'Foreign key to speakers table (denormalized for query optimization)';
COMMENT ON COLUMN public.scheduled_posts.event_id IS 'Foreign key to events table (denormalized for query optimization)';
COMMENT ON COLUMN public.scheduled_posts.scheduled_time IS 'When the post should be published (with timezone)';
COMMENT ON COLUMN public.scheduled_posts.timezone IS 'Timezone for the scheduled time';
COMMENT ON COLUMN public.scheduled_posts.platform IS 'Social media platform (linkedin, twitter, instagram)';
COMMENT ON COLUMN public.scheduled_posts.status IS 'Post status: pending, posted, failed, cancelled';
COMMENT ON COLUMN public.scheduled_posts.post_text IS 'Post content (denormalized from announcement)';
COMMENT ON COLUMN public.scheduled_posts.image_url IS 'Optional Supabase Storage URL for post image';
COMMENT ON COLUMN public.scheduled_posts.posted_at IS 'Timestamp when post was successfully published';
COMMENT ON COLUMN public.scheduled_posts.posted_urn IS 'LinkedIn URN or platform-specific post ID after successful posting';
COMMENT ON COLUMN public.scheduled_posts.error_message IS 'Error message if post failed';
COMMENT ON COLUMN public.scheduled_posts.retry_count IS 'Number of retry attempts for failed posts';
COMMENT ON COLUMN public.scheduled_posts.last_retry_at IS 'Timestamp of last retry attempt';
