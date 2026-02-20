
-- Make user_id nullable to support guest RSVPs
ALTER TABLE public.event_rsvps ALTER COLUMN user_id DROP NOT NULL;

-- Add guest info columns
ALTER TABLE public.event_rsvps ADD COLUMN guest_name TEXT;
ALTER TABLE public.event_rsvps ADD COLUMN guest_email TEXT;

-- Drop the existing unique constraint on (event_id, user_id) since user_id can now be null
-- and we need to allow multiple guest RSVPs
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_user_id_key;

-- Re-add unique constraint only for authenticated users (partial index)
CREATE UNIQUE INDEX event_rsvps_event_user_unique ON public.event_rsvps (event_id, user_id) WHERE user_id IS NOT NULL;

-- Add unique constraint for guest email per event to prevent duplicate guest RSVPs
CREATE UNIQUE INDEX event_rsvps_event_guest_email_unique ON public.event_rsvps (event_id, guest_email) WHERE guest_email IS NOT NULL AND user_id IS NULL;

-- Allow anyone (including anon) to view RSVPs for public events
DROP POLICY IF EXISTS "Users can view RSVPs for public events" ON public.event_rsvps;
CREATE POLICY "Anyone can view RSVPs for public events"
ON public.event_rsvps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_rsvps.event_id AND e.is_public = true
  )
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = event_rsvps.event_id AND e.creator_id = auth.uid()
  ))
);

-- Allow anon users to insert guest RSVPs
CREATE POLICY "Guests can RSVP to public events"
ON public.event_rsvps FOR INSERT
WITH CHECK (
  user_id IS NULL
  AND guest_name IS NOT NULL
  AND guest_email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = event_rsvps.event_id AND e.is_public = true
  )
);

-- Allow anon users to view public events
DROP POLICY IF EXISTS "Anyone can view public events" ON public.events;
CREATE POLICY "Anyone can view public events"
ON public.events FOR SELECT
USING (is_public = true OR (auth.uid() IS NOT NULL AND creator_id = auth.uid()));
