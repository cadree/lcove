-- Pay links and card gifts. Not applied in this environment.

ALTER TABLE public.contact_invoices
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS contact_invoices_stripe_session_key
  ON public.contact_invoices (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stream_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  host_id uuid NOT NULL,
  gift text NOT NULL,
  amount_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stream_gifts_session_key
  ON public.stream_gifts (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.stream_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gift senders and hosts can read gifts" ON public.stream_gifts;
CREATE POLICY "Gift senders and hosts can read gifts"
  ON public.stream_gifts
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR host_id = auth.uid());
