-- Add creator payout fields to networks table
ALTER TABLE public.networks
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'stripe';

-- Comment on columns
COMMENT ON COLUMN public.networks.stripe_connect_account_id IS 'Stripe Connect account ID for receiving payments';
COMMENT ON COLUMN public.networks.payout_enabled IS 'Whether the creator has completed payout setup';
COMMENT ON COLUMN public.networks.payout_method IS 'Payment method: stripe or paypal';