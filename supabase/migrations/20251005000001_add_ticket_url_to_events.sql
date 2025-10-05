-- Add ticket_url field to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_url TEXT;
