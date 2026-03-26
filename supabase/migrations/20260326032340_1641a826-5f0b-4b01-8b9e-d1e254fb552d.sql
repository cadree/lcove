
-- Guest push subscriptions table (no user_id FK needed)
CREATE TABLE public.guest_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_email TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guest_email, event_id, endpoint)
);

-- RLS
ALTER TABLE public.guest_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anon can insert (guests subscribing without account)
CREATE POLICY "Anon can insert guest push subscriptions"
  ON public.guest_push_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Service role handles SELECT for sending (no explicit policy needed, service_role bypasses RLS)
