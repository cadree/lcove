
-- Add guest_phone column for guest RSVPs
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS guest_phone TEXT;
