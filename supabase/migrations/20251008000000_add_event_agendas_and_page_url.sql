-- Add event_page_url column to events table
-- This stores the external event page URL (e.g., Luma, Eventbrite)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_page_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.events.event_page_url IS 'External event page URL (e.g., luma.com/x123, eventbrite.com/e/123)';

-- Create event_agendas table
-- This stores the merged/generated agendas for events
CREATE TABLE IF NOT EXISTS public.event_agendas (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Agenda content
  agenda_text TEXT NOT NULL,
  agenda_format TEXT NOT NULL DEFAULT 'markdown' CHECK (agenda_format IN ('markdown', 'html', 'plain')),

  -- Metadata
  version INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,

  -- Track which speakers were included in this version
  included_speaker_ids BIGINT[] NOT NULL DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_agendas_event_id ON public.event_agendas(event_id);
CREATE INDEX IF NOT EXISTS idx_event_agendas_user_id ON public.event_agendas(user_id);
CREATE INDEX IF NOT EXISTS idx_event_agendas_event_version ON public.event_agendas(event_id, version DESC);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_event_agendas_updated_at
  BEFORE UPDATE ON public.event_agendas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.event_agendas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_agendas
-- Users can view agendas for their own events
CREATE POLICY "Users can view own event agendas"
  ON public.event_agendas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create agendas for their own events
CREATE POLICY "Users can create agendas for own events"
  ON public.event_agendas
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_id AND events.user_id = auth.uid()
    )
  );

-- Users can update their own event agendas
CREATE POLICY "Users can update own event agendas"
  ON public.event_agendas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own event agendas
CREATE POLICY "Users can delete own event agendas"
  ON public.event_agendas
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.event_agendas IS 'Stores merged/generated agendas for events, with versioning support';
COMMENT ON COLUMN public.event_agendas.agenda_text IS 'The generated agenda content';
COMMENT ON COLUMN public.event_agendas.agenda_format IS 'Format of the agenda (markdown, html, plain)';
COMMENT ON COLUMN public.event_agendas.version IS 'Version number for tracking agenda iterations';
COMMENT ON COLUMN public.event_agendas.is_published IS 'Whether this agenda has been published/pushed to external platforms';
COMMENT ON COLUMN public.event_agendas.included_speaker_ids IS 'Array of speaker IDs included in this agenda version';
