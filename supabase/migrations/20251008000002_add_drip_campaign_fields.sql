-- Add drip campaign configuration fields to events table
-- These control automatic scheduling of speaker announcements

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS drip_campaign_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS drip_campaign_days_before INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS drip_campaign_start_time TIME DEFAULT '10:00:00';

-- Add comments for documentation
COMMENT ON COLUMN public.events.drip_campaign_enabled IS 'Whether drip campaign is active for this event';
COMMENT ON COLUMN public.events.drip_campaign_days_before IS 'How many days before the event to start posting (default 7)';
COMMENT ON COLUMN public.events.drip_campaign_start_time IS 'Preferred posting time each day (default 10:00 AM)';
