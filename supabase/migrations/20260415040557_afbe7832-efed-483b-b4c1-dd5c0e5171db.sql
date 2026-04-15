
-- Table to track automated reminder sends (prevents duplicates)
CREATE TABLE public.event_reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '24h', '1h', 'custom'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  sent_by UUID -- null for automated, user_id for host-initiated
);

ALTER TABLE public.event_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event creators can view reminder logs"
  ON public.event_reminder_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_reminder_log.event_id
      AND e.creator_id = auth.uid()
    )
  );

CREATE POLICY "Event creators can insert reminder logs"
  ON public.event_reminder_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_reminder_log.event_id
      AND e.creator_id = auth.uid()
    )
  );

-- Index for fast lookup by event + type
CREATE INDEX idx_event_reminder_log_event_type ON public.event_reminder_log (event_id, reminder_type);

-- Table to cache generated event flyers
CREATE TABLE public.event_flyers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  flyer_url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'story', -- 'story' (1080x1920) or 'feed' (1200x630)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_flyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event flyers"
  ON public.event_flyers FOR SELECT
  USING (true);

CREATE POLICY "Event creators can manage flyers"
  ON public.event_flyers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_flyers.event_id
      AND e.creator_id = auth.uid()
    )
  );

CREATE POLICY "Event creators can update flyers"
  ON public.event_flyers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_flyers.event_id
      AND e.creator_id = auth.uid()
    )
  );
