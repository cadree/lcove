-- Artist subscriptions: add Stripe tracking columns
ALTER TABLE public.artist_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS artist_subscriptions_stripe_subscription_id_key
  ON public.artist_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Exclusive track purchases: add Stripe session + payment_status
ALTER TABLE public.exclusive_track_purchases
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS exclusive_track_purchases_stripe_session_id_key
  ON public.exclusive_track_purchases(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;