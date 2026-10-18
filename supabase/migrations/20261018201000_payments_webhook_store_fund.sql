-- Payments: one webhook ledger, real fund totals, atomic credit sales.
-- This file is not applied by the app. Apply it on a staging copy first.

-- ---------------------------------------------------------------------------
-- Donations and webhook idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'usd',
  mode text NOT NULL CHECK (mode IN ('one_time', 'recurring')),
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded', 'failed')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS donations_stripe_session_id_key
  ON public.donations (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_created ON public.donations (created_at);
CREATE INDEX IF NOT EXISTS idx_donations_user ON public.donations (user_id);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own donations" ON public.donations;
CREATE POLICY "Users can view own donations"
ON public.donations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS membership_contributions_stripe_invoice_id_key
  ON public.membership_contributions (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- Fund totals are membership contributions plus paid donations.
-- Refunded donations are excluded. Clients still cannot read the rows.
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
      AND tablename = 'donations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Store shipping, tax, and linked Shopify products
-- ---------------------------------------------------------------------------

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS flat_shipping_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_line_label text,
  ADD COLUMN IF NOT EXISTS tax_line_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_flat_shipping_cents_check;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_flat_shipping_cents_check CHECK (flat_shipping_cents >= 0);

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_tax_line_cents_check;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_tax_line_cents_check CHECK (tax_line_cents >= 0);

ALTER TABLE public.store_items
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_handle text,
  ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE public.store_items
  DROP CONSTRAINT IF EXISTS store_items_external_source_check;
ALTER TABLE public.store_items
  ADD CONSTRAINT store_items_external_source_check
  CHECK (external_source IS NULL OR external_source IN ('shopify'));

CREATE UNIQUE INDEX IF NOT EXISTS store_items_external_handle_key
  ON public.store_items (store_id, external_handle)
  WHERE external_handle IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Credit sale: one transaction, allowed ledger types only.
-- credit_ledger.type allows spend/earn, not sale/purchase.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_store_credit_purchase(
  p_buyer_id uuid,
  p_item_id uuid,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.store_items%ROWTYPE;
  v_store public.stores%ROWTYPE;
  v_buyer public.user_credits%ROWTYPE;
  v_seller public.user_credits%ROWTYPE;
  v_total integer;
  v_seller_credits integer;
  v_platform_credits integer;
  v_earned_spend numeric;
  v_genesis_spend numeric;
  v_buyer_after numeric;
  v_seller_after numeric;
  v_order_id uuid;
  v_first uuid;
  v_second uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  SELECT * INTO v_item
  FROM public.store_items
  WHERE id = p_item_id
  FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_item.is_active, false) = false THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF v_item.external_url IS NOT NULL THEN
    RAISE EXCEPTION 'This item is sold outside Ether';
  END IF;

  SELECT * INTO v_store FROM public.stores WHERE id = v_item.store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
  IF COALESCE(v_store.accepts_credits, false) = false THEN
    RAISE EXCEPTION 'This store does not accept credits';
  END IF;
  IF COALESCE(v_item.credits_price, 0) <= 0 THEN
    RAISE EXCEPTION 'This item cannot be purchased with credits';
  END IF;
  IF v_item.type = 'product' AND v_item.inventory_count IS NOT NULL AND v_item.inventory_count < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  v_total := v_item.credits_price * p_quantity;
  -- 10% of the item price. Keep equal to STORE_PLATFORM_FEE_PERCENT. Linked Shopify items are rejected above.
  v_seller_credits := floor(v_total * 0.90);
  v_platform_credits := v_total - v_seller_credits;

  INSERT INTO public.user_credits (user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent)
  VALUES (p_buyer_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_credits (user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent)
  VALUES (v_store.user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_buyer_id <= v_store.user_id THEN
    v_first := p_buyer_id;
    v_second := v_store.user_id;
  ELSE
    v_first := v_store.user_id;
    v_second := p_buyer_id;
  END IF;

  PERFORM 1 FROM public.user_credits WHERE user_id = v_first FOR UPDATE;
  IF v_second IS DISTINCT FROM v_first THEN
    PERFORM 1 FROM public.user_credits WHERE user_id = v_second FOR UPDATE;
  END IF;

  SELECT * INTO v_buyer FROM public.user_credits WHERE user_id = p_buyer_id;
  SELECT * INTO v_seller FROM public.user_credits WHERE user_id = v_store.user_id;

  IF COALESCE(v_buyer.balance, 0) < v_total THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  v_earned_spend := LEAST(GREATEST(COALESCE(v_buyer.earned_balance, 0), 0), v_total);
  v_genesis_spend := v_total - v_earned_spend;
  IF COALESCE(v_buyer.genesis_balance, 0) < v_genesis_spend THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  INSERT INTO public.store_orders (
    store_id, buyer_id, item_id, quantity, total_price, credits_spent,
    payment_type, status, seller_amount, platform_fee, seller_payout_status
  ) VALUES (
    v_store.id, p_buyer_id, p_item_id, p_quantity, 0, v_total,
    'credits', 'confirmed', v_seller_credits, v_platform_credits, 'completed'
  )
  RETURNING id INTO v_order_id;

  v_buyer_after := COALESCE(v_buyer.balance, 0);

  IF v_earned_spend > 0 THEN
    v_buyer_after := v_buyer_after - v_earned_spend;
    INSERT INTO public.credit_ledger (
      user_id, amount, balance_after, type, description,
      credit_type, earned_amount, genesis_amount,
      reference_type, reference_id
    ) VALUES (
      p_buyer_id, -v_earned_spend, v_buyer_after, 'spend',
      'Purchased: ' || v_item.title,
      'earned', -v_earned_spend, 0,
      'store_order', v_order_id
    );
  END IF;

  IF v_genesis_spend > 0 THEN
    v_buyer_after := v_buyer_after - v_genesis_spend;
    INSERT INTO public.credit_ledger (
      user_id, amount, balance_after, type, description,
      credit_type, earned_amount, genesis_amount,
      reference_type, reference_id
    ) VALUES (
      p_buyer_id, -v_genesis_spend, v_buyer_after, 'spend',
      'Purchased: ' || v_item.title,
      'genesis', 0, -v_genesis_spend,
      'store_order', v_order_id
    );
  END IF;

  v_seller_after := COALESCE(v_seller.balance, 0) + v_seller_credits;
  INSERT INTO public.credit_ledger (
    user_id, amount, balance_after, type, description,
    credit_type, earned_amount, genesis_amount,
    reference_type, reference_id
  ) VALUES (
    v_store.user_id, v_seller_credits, v_seller_after, 'earn',
    'Sale (90%): ' || v_item.title,
    'earned', v_seller_credits, 0,
    'store_order', v_order_id
  );

  INSERT INTO public.platform_treasury (
    source_type, source_id, amount, credits_amount, description
  ) VALUES (
    'store_order', v_order_id, 0, v_platform_credits,
    'Platform fee (10%): ' || v_item.title
  );

  IF v_item.type = 'product' AND v_item.inventory_count IS NOT NULL THEN
    UPDATE public.store_items
    SET inventory_count = inventory_count - p_quantity
    WHERE id = p_item_id;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_store_credit_purchase(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_store_credit_purchase(uuid, uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_store_card_order(
  p_order_id uuid,
  p_payment_intent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.store_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF v_order.status = 'confirmed' OR v_order.status = 'completed' THEN
    RETURN false;
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'order is %', v_order.status;
  END IF;

  UPDATE public.store_orders
  SET status = 'confirmed',
      stripe_payment_intent_id = COALESCE(p_payment_intent, stripe_payment_intent_id)
  WHERE id = p_order_id;

  UPDATE public.store_items
  SET inventory_count = inventory_count - v_order.quantity
  WHERE id = v_order.item_id
    AND type = 'product'
    AND inventory_count IS NOT NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_store_card_order(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_store_card_order(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_pending_store_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_status <> 'pending' THEN
    RETURN false;
  END IF;

  UPDATE public.store_orders
  SET status = 'cancelled'
  WHERE id = p_order_id;

  DELETE FROM public.platform_treasury
  WHERE source_type = 'store_order'
    AND source_id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_store_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_store_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_store_order_refunded(p_payment_intent text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.store_orders%ROWTYPE;
BEGIN
  IF p_payment_intent IS NULL OR length(p_payment_intent) = 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_order
  FROM public.store_orders
  WHERE stripe_payment_intent_id = p_payment_intent
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_order.status = 'refunded' THEN
    RETURN false;
  END IF;

  UPDATE public.store_orders
  SET status = 'refunded'
  WHERE id = v_order.id;

  IF v_order.status IN ('confirmed', 'completed') THEN
    UPDATE public.store_items
    SET inventory_count = inventory_count + v_order.quantity
    WHERE id = v_order.item_id
      AND type = 'product'
      AND inventory_count IS NOT NULL;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_store_order_refunded(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_store_order_refunded(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Event tickets: confirm once, from the webhook or the return page.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_event_ticket_order(
  p_order_id uuid,
  p_payment_intent text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.ticket_orders%ROWTYPE;
  v_tier_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.ticket_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN false;
  END IF;
  IF v_order.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'order is %', v_order.payment_status;
  END IF;

  UPDATE public.ticket_orders
  SET payment_status = 'paid',
      stripe_payment_intent_id = COALESCE(p_payment_intent, stripe_payment_intent_id)
  WHERE id = p_order_id;

  SELECT tier_id INTO v_tier_id
  FROM public.event_attendees
  WHERE order_id = p_order_id
    AND tier_id IS NOT NULL
  LIMIT 1;

  IF v_tier_id IS NOT NULL THEN
    UPDATE public.ticket_tiers
    SET quantity_sold = COALESCE(quantity_sold, 0) + v_order.quantity
    WHERE id = v_tier_id;
  END IF;

  IF v_order.purchaser_user_id IS NOT NULL THEN
    INSERT INTO public.event_rsvps (
      event_id, user_id, status, ticket_purchased, stripe_payment_id
    ) VALUES (
      v_order.event_id, v_order.purchaser_user_id, 'going', true, p_payment_intent
    )
    ON CONFLICT (event_id, user_id) WHERE user_id IS NOT NULL DO UPDATE
      SET status = 'going',
          ticket_purchased = true,
          stripe_payment_id = COALESCE(EXCLUDED.stripe_payment_id, public.event_rsvps.stripe_payment_id);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_event_ticket_order(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_event_ticket_order(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_pending_ticket_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT payment_status INTO v_status
  FROM public.ticket_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR v_status <> 'pending' THEN
    RETURN false;
  END IF;
  UPDATE public.ticket_orders
  SET payment_status = 'cancelled'
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_ticket_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_ticket_order(uuid) TO service_role;
