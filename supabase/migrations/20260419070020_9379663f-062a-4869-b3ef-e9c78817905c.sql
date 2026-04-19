
-- 1. Event moodboard items
CREATE TABLE IF NOT EXISTS public.event_moodboard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image','link','note','itinerary')),
  media_url text,
  link_url text,
  title text,
  body text,
  start_time timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_moodboard_items_event ON public.event_moodboard_items(event_id, sort_order);

ALTER TABLE public.event_moodboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moodboard viewable for public events or attendees"
ON public.event_moodboard_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_moodboard_items.event_id
      AND (
        e.is_public = true
        OR e.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.event_rsvps r
          WHERE r.event_id = e.id AND r.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Event creator manages moodboard"
ON public.event_moodboard_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_moodboard_items.event_id AND e.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_moodboard_items.event_id AND e.creator_id = auth.uid()
  )
);

-- 2. RSVP confirmation tracking
ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- 3. Per-recipient reminder log
ALTER TABLE public.event_reminder_log
  ADD COLUMN IF NOT EXISTS recipient_email text;

CREATE INDEX IF NOT EXISTS idx_event_reminder_log_lookup
  ON public.event_reminder_log(event_id, reminder_type, recipient_email);
