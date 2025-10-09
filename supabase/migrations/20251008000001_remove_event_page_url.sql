-- Remove event_page_url column as we're consolidating to use ticket_url instead
-- ticket_url will serve as the event page link for Luma, Eventbrite, etc.

ALTER TABLE public.events
DROP COLUMN IF EXISTS event_page_url;
