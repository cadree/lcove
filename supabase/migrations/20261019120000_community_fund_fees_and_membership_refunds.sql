-- Community-fund share of network subscription and studio booking fees,
-- and an idempotency row for membership invoice refunds.
-- This file is not applied by the app. Apply it on a staging copy first.

-- ---------------------------------------------------------------------------
-- Fees earmarked for the community fund.
-- Dollar `amount` is included in membership_fund_snapshot.
-- `credits_amount` is the same percentage of a credit studio booking.
-- Credits are not dollars, so they are not added to the fund total.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_fund_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('network_subscription', 'studio_booking')),
  source_id text NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  credits_amount integer NOT NULL DEFAULT 0 CHECK (credits_amount >= 0),
  currency text NOT NULL DEFAULT 'usd',
  description text,
  stripe_session_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS community_fund_fees_invoice_key
  ON public.community_fund_fees (source_type, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_fund_fees_payment_intent_key
  ON public.community_fund_fees (source_type, stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_fund_fees_session_key
  ON public.community_fund_fees (source_type, stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_fund_fees_offline_source_key
  ON public.community_fund_fees (source_type, source_id)
  WHERE stripe_invoice_id IS NULL
    AND stripe_payment_intent_id IS NULL
    AND stripe_session_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_fund_fees_created
  ON public.community_fund_fees (created_at);

ALTER TABLE public.community_fund_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view community fund fees" ON public.community_fund_fees;
CREATE POLICY "Admins can view community fund fees"
ON public.community_fund_fees
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- One row per Stripe refund object so a retried charge.refunded cannot
-- subtract the same refund from lifetime_contribution twice.
CREATE TABLE IF NOT EXISTS public.membership_payment_refunds (
  stripe_refund_id text PRIMARY KEY,
  stripe_charge_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  membership_id uuid,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view membership payment refunds" ON public.membership_payment_refunds;
CREATE POLICY "Admins can view membership payment refunds"
ON public.membership_payment_refunds
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fund totals: membership contributions, paid donations, and dollar platform
-- fees earmarked from network subscriptions and studio bookings.
CREATE OR REPLACE FUNCTION public.membership_fund_snapshot(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'collected',
      COALESCE((
        SELECT SUM(amount)
        FROM public.membership_contributions
        WHERE (p_start IS NULL OR created_at >= p_start)
          AND (p_end IS NULL OR created_at <= p_end)
      ), 0)
      + COALESCE((
        SELECT SUM(amount)
        FROM public.donations
        WHERE status = 'paid'
          AND (p_start IS NULL OR created_at >= p_start)
          AND (p_end IS NULL OR created_at <= p_end)
      ), 0)
      + COALESCE((
        SELECT SUM(amount)
        FROM public.community_fund_fees
        WHERE (p_start IS NULL OR created_at >= p_start)
          AND (p_end IS NULL OR created_at <= p_end)
      ), 0),
    'member_count', (
      SELECT COUNT(*)
      FROM public.memberships
      WHERE CASE
        WHEN p_start IS NULL AND p_end IS NULL THEN status = 'active'
        ELSE (p_start IS NULL OR created_at >= p_start)
         AND (p_end IS NULL OR created_at <= p_end)
      END
    )
  );
$$;

REVOKE ALL ON FUNCTION public.membership_fund_snapshot(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_fund_snapshot(timestamptz, timestamptz) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'community_fund_fees'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.community_fund_fees;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped adding community_fund_fees to supabase_realtime: %', SQLERRM;
    END;
  END IF;
END $$;
