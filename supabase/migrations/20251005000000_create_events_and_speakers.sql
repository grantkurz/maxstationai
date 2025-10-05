-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    location TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    type TEXT NOT NULL DEFAULT 'Event'
);

-- Create speakers table
CREATE TABLE IF NOT EXISTS public.speakers (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    speaker_title TEXT NOT NULL,
    speaker_bio TEXT,
    session_title TEXT NOT NULL,
    session_description TEXT
);

-- Add RLS (Row Level Security) policies for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own events
CREATE POLICY "Users can view own events"
    ON public.events
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own events"
    ON public.events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own events
CREATE POLICY "Users can update own events"
    ON public.events
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own events
CREATE POLICY "Users can delete own events"
    ON public.events
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add RLS policies for speakers
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view speakers for their events
CREATE POLICY "Users can view speakers for own events"
    ON public.speakers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = speakers.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Users can insert speakers for their events
CREATE POLICY "Users can insert speakers for own events"
    ON public.speakers
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = speakers.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Users can update speakers for their events
CREATE POLICY "Users can update speakers for own events"
    ON public.speakers
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = speakers.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Policy: Users can delete speakers for their events
CREATE POLICY "Users can delete speakers for own events"
    ON public.speakers
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.events
            WHERE events.id = speakers.event_id
            AND events.user_id = auth.uid()
        )
    );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
CREATE INDEX IF NOT EXISTS idx_speakers_event_id ON public.speakers(event_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to update updated_at on events
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create triggers to update updated_at on speakers
CREATE TRIGGER update_speakers_updated_at
    BEFORE UPDATE ON public.speakers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
