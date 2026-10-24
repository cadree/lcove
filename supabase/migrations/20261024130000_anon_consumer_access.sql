-- Signed-out visitors can RSVP, buy, and watch. They cannot read community
-- rows, private profile fields, or emails. Guest writes go through rate-limited
-- functions. Cadre applies this file.

-- ---------------------------------------------------------------------------
-- Quotas. The table is not readable by the browser. Keys are emails or hashes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guest_action_buckets (
  action text NOT NULL,
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (action, bucket_key, window_start)
);

ALTER TABLE public.guest_action_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guest_action_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guest_action_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_guest_quota(
  p_action text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := left(btrim(COALESCE(p_key, '')), 200);
  v_start timestamptz;
  v_hits integer;
BEGIN
  IF p_action IS NULL OR btrim(p_action) = '' OR v_key = '' THEN
    RAISE EXCEPTION 'limit reached';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'limit reached';
  END IF;
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.guest_action_buckets AS bucket (action, bucket_key, window_start, hits)
  VALUES (btrim(p_action), v_key, v_start, 1)
  ON CONFLICT (action, bucket_key, window_start)
  DO UPDATE SET hits = bucket.hits + 1
  RETURNING hits INTO v_hits;
  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'limit reached';
  END IF;
  RETURN v_hits;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guest_quota(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_quota(text, text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Guest RSVP stays on the guest list. Direct inserts are closed so the quota
-- cannot be skipped. Only the service role (the guest-event-rsvp function)
-- may call this.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Guests can RSVP to public events" ON public.event_rsvps;
REVOKE ALL ON TABLE public.event_rsvps FROM anon;

CREATE OR REPLACE FUNCTION public.create_guest_event_rsvp(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_email text;
  v_phone text;
BEGIN
  IF p_guest_name IS NULL OR btrim(p_guest_name) = '' OR length(btrim(p_guest_name)) > 100 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  v_email := lower(btrim(COALESCE(p_guest_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 OR length(v_email) > 255 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.is_public = true
  ) THEN
    RAISE EXCEPTION 'event not found';
  END IF;
  PERFORM public.consume_guest_quota('guest_rsvp_email', v_email, 8, 86400);
  PERFORM public.consume_guest_quota('guest_rsvp_global', 'all', 400, 3600);
  v_phone := NULLIF(btrim(COALESCE(p_guest_phone, '')), '');
  IF p_campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.notification_campaigns WHERE id = p_campaign_id
  ) THEN
    p_campaign_id := NULL;
  END IF;
  INSERT INTO public.event_rsvps (
    event_id, user_id, status, guest_name, guest_email, guest_phone, campaign_id
  ) VALUES (
    p_event_id, NULL, 'going', btrim(p_guest_name), v_email, v_phone, p_campaign_id
  )
  RETURNING id, status INTO v_id, v_status;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already rsvped';
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.limit_guest_push_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.guest_email := lower(btrim(COALESCE(NEW.guest_email, '')));
  PERFORM public.consume_guest_quota('guest_push_email', NEW.guest_email, 10, 86400);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limit_guest_push_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS limit_guest_push_subscription ON public.guest_push_subscriptions;
CREATE TRIGGER limit_guest_push_subscription
  BEFORE INSERT ON public.guest_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.limit_guest_push_subscription();

-- ---------------------------------------------------------------------------
-- Guest store orders. buyer_id stays required for member orders.
-- ---------------------------------------------------------------------------

ALTER TABLE public.store_orders ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_cancel_token text;

ALTER TABLE public.store_orders DROP CONSTRAINT IF EXISTS store_orders_buyer_or_guest;
ALTER TABLE public.store_orders
  ADD CONSTRAINT store_orders_buyer_or_guest
  CHECK (
    buyer_id IS NOT NULL
    OR (
      guest_email IS NOT NULL
      AND length(btrim(guest_email)) > 3
      AND position('@' in guest_email) > 1
    )
  );

CREATE INDEX IF NOT EXISTS store_orders_guest_email_idx
  ON public.store_orders (lower(guest_email))
  WHERE guest_email IS NOT NULL;

REVOKE ALL ON TABLE public.store_orders FROM anon;

CREATE OR REPLACE FUNCTION public.begin_guest_store_order(
  p_item_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_quantity integer,
  p_ip_key text,
  p_platform_fee_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.store_items%ROWTYPE;
  v_store public.stores%ROWTYPE;
  v_name text := btrim(COALESCE(p_guest_name, ''));
  v_email text := lower(btrim(COALESCE(p_guest_email, '')));
  v_qty integer := COALESCE(p_quantity, 1);
  v_merch integer;
  v_ship integer;
  v_tax integer;
  v_fee integer;
  v_seller integer;
  v_order_id uuid;
  v_token text;
BEGIN
  IF v_name = '' OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  IF v_email = '' OR position('@' in v_email) < 2 OR length(v_email) > 255 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF v_qty < 1 OR v_qty > 10 THEN
    RAISE EXCEPTION 'quantity must be between 1 and 10';
  END IF;

  SELECT * INTO v_item
  FROM public.store_items
  WHERE id = p_item_id AND COALESCE(is_active, false) = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF v_item.external_url IS NOT NULL AND btrim(v_item.external_url) <> '' THEN
    RAISE EXCEPTION 'This item is sold outside Ether';
  END IF;

  SELECT * INTO v_store
  FROM public.stores
  WHERE id = v_item.store_id AND COALESCE(is_active, false) = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
  IF COALESCE(v_store.accepts_cash, false) = false THEN
    RAISE EXCEPTION 'This store does not accept cash payments';
  END IF;
  IF v_item.price IS NULL OR v_item.price <= 0 THEN
    RAISE EXCEPTION 'This item does not have a cash price';
  END IF;
  IF v_item.type = 'product' AND v_item.inventory_count IS NOT NULL AND v_item.inventory_count < v_qty THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  PERFORM public.consume_guest_quota('guest_checkout_email', v_email, 6, 3600);
  IF p_ip_key IS NOT NULL AND btrim(p_ip_key) <> '' THEN
    PERFORM public.consume_guest_quota('guest_checkout_ip', left(btrim(p_ip_key), 200), 20, 3600);
  END IF;
  PERFORM public.consume_guest_quota('guest_checkout_global', 'all', 200, 3600);

  -- Fee cents come from purchase-store-item via storeCashSplit, the same
  -- helper the member checkout uses. This function stores that amount.
  v_merch := round(v_item.price * 100)::integer * v_qty;
  v_ship := CASE WHEN v_item.type = 'product' THEN COALESCE(v_store.flat_shipping_cents, 0) ELSE 0 END;
  v_tax := COALESCE(v_store.tax_line_cents, 0);
  v_fee := p_platform_fee_cents;
  IF v_fee IS NULL OR v_fee < 0 OR v_fee > v_merch THEN
    RAISE EXCEPTION 'fee required';
  END IF;
  v_seller := v_merch - v_fee + v_ship + v_tax;
  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.store_orders (
    store_id, buyer_id, item_id, quantity, total_price, credits_spent,
    payment_type, status, seller_amount, platform_fee, seller_payout_status,
    guest_name, guest_email, guest_cancel_token
  ) VALUES (
    v_store.id, NULL, v_item.id, v_qty,
    (v_merch + v_ship + v_tax) / 100.0,
    0, 'cash', 'pending',
    v_seller / 100.0, v_fee / 100.0,
    'pending_setup',
    v_name, v_email, v_token
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'cancel_token', v_token,
    'store_id', v_store.id,
    'seller_user_id', v_store.user_id,
    'title', v_item.title,
    'description', v_item.description,
    'image', CASE
      WHEN v_item.images IS NOT NULL AND array_length(v_item.images, 1) > 0 THEN v_item.images[1]
      ELSE NULL
    END,
    'currency', lower(COALESCE(v_item.currency, 'usd')),
    'unit_amount_cents', round(v_item.price * 100)::integer,
    'quantity', v_qty,
    'shipping_cents', v_ship,
    'tax_cents', v_tax,
    'tax_label', v_store.tax_line_label,
    'platform_fee_cents', v_fee,
    'seller_amount', v_seller / 100.0,
    'platform_fee', v_fee / 100.0,
    'total_price', (v_merch + v_ship + v_tax) / 100.0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_guest_store_order(uuid, text, text, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_guest_store_order(uuid, text, text, integer, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_guest_store_order(
  p_order_id uuid,
  p_token text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.store_orders%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN false;
  END IF;
  SELECT * INTO v_order
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.buyer_id IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_order.guest_cancel_token IS DISTINCT FROM btrim(p_token) THEN
    RETURN false;
  END IF;
  IF v_order.status <> 'pending' THEN
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

REVOKE ALL ON FUNCTION public.cancel_guest_store_order(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_guest_store_order(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Community tables are members-only. Anon keeps column-limited reads of the
-- consumer catalog, plus two views that hide keys, emails, and profile fields.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Members can view posts"
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (NOT public.either_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Members can view comments"
  ON public.post_comments
  FOR SELECT
  TO authenticated
  USING (NOT public.either_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Anyone can view non-expired stories" ON public.stories;
CREATE POLICY "Members can view non-expired stories"
  ON public.stories
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    AND NOT public.either_blocked(auth.uid(), user_id)
    AND (
      credit_user_id IS NULL
      OR NOT public.either_blocked(auth.uid(), credit_user_id)
    )
  );

DROP POLICY IF EXISTS "Projects are visible to the community or their members" ON public.projects;
CREATE POLICY "Projects are visible to the community or their members"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid() OR public.can_view_project(id, auth.uid()));

DROP POLICY IF EXISTS "Roles follow project visibility" ON public.project_roles;
CREATE POLICY "Roles follow project visibility"
  ON public.project_roles
  FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view live streams" ON public.live_streams;
CREATE POLICY "Members can view live streams"
  ON public.live_streams
  FOR SELECT
  TO authenticated
  USING (NOT public.either_blocked(auth.uid(), host_id));

REVOKE ALL ON TABLE public.posts FROM anon;
REVOKE ALL ON TABLE public.post_comments FROM anon;
REVOKE ALL ON TABLE public.stories FROM anon;
REVOKE ALL ON TABLE public.reposts FROM anon;
REVOKE ALL ON TABLE public.projects FROM anon;
REVOKE ALL ON TABLE public.project_roles FROM anon;
REVOKE ALL ON TABLE public.project_updates FROM anon;
REVOKE ALL ON TABLE public.project_applications FROM anon;
REVOKE ALL ON TABLE public.project_attachments FROM anon;
REVOKE ALL ON TABLE public.live_streams FROM anon;
REVOKE ALL ON TABLE public.live_streams_public FROM anon;
REVOKE SELECT ON TABLE public.profiles_public FROM anon;

REVOKE ALL ON TABLE public.events FROM anon;
GRANT SELECT (
  id,
  creator_id,
  title,
  description,
  start_date,
  end_date,
  venue,
  address,
  city,
  state,
  country,
  image_url,
  ticket_price,
  ticket_type,
  capacity,
  timezone,
  external_url,
  event_type,
  credits_price,
  waitlist_enabled,
  is_public,
  status
) ON public.events TO anon;

REVOKE ALL ON TABLE public.ticket_tiers FROM anon;
GRANT SELECT (
  id,
  event_id,
  name,
  description,
  price_cents,
  currency,
  credits_price,
  is_active,
  sort_order
) ON public.ticket_tiers TO anon;

REVOKE ALL ON TABLE public.stores FROM anon;
GRANT SELECT (
  id,
  user_id,
  name,
  description,
  cover_image_url,
  logo_url,
  is_active,
  accepts_cash,
  accepts_credits,
  flat_shipping_cents,
  tax_line_label,
  tax_line_cents
) ON public.stores TO anon;

REVOKE ALL ON TABLE public.store_items FROM anon;
GRANT SELECT (
  id,
  store_id,
  category_id,
  type,
  title,
  description,
  price,
  credits_price,
  currency,
  images,
  is_active,
  inventory_count,
  duration_minutes,
  location,
  amenities,
  external_url
) ON public.store_items TO anon;

CREATE OR REPLACE VIEW public.consumer_creators
WITH (security_barrier = true, security_invoker = false) AS
SELECT p.user_id, p.display_name, p.avatar_url
FROM public.profiles p
WHERE COALESCE(p.is_suspended, false) = false
  AND COALESCE(p.show_only_to_passed_exam, false) = false
  AND (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.creator_id = p.user_id AND e.is_public = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.stores s
      JOIN public.store_items i ON i.store_id = s.id
      WHERE s.user_id = p.user_id
        AND COALESCE(s.is_active, false) = true
        AND COALESCE(i.is_active, false) = true
    )
    OR EXISTS (
      SELECT 1 FROM public.live_streams ls
      WHERE ls.host_id = p.user_id
        AND (
          COALESCE(ls.is_live, false)
          OR (COALESCE(ls.replay_available, false) AND ls.replay_url IS NOT NULL)
          OR ls.started_at IS NOT NULL
          OR (
            ls.stream_type IN ('youtube', 'twitch', 'soundcloud')
            AND ls.external_url IS NOT NULL
            AND btrim(ls.external_url) <> ''
          )
        )
    )
  );

REVOKE ALL ON TABLE public.consumer_creators FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.consumer_creators TO anon, authenticated;

CREATE OR REPLACE VIEW public.consumer_live_streams
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  id,
  host_id,
  title,
  description,
  stream_type,
  external_url,
  thumbnail_url,
  is_live,
  started_at,
  ended_at,
  viewer_count,
  replay_available,
  replay_url,
  playback_url,
  created_at
FROM public.live_streams
WHERE COALESCE(is_live, false)
  OR (COALESCE(replay_available, false) AND replay_url IS NOT NULL)
  OR started_at IS NOT NULL
  OR (
    stream_type IN ('youtube', 'twitch', 'soundcloud')
    AND external_url IS NOT NULL
    AND btrim(external_url) <> ''
  );

REVOKE ALL ON TABLE public.consumer_live_streams FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.consumer_live_streams TO anon, authenticated;

-- These helpers predate the search_path rule. Pin them so a caller cannot
-- shadow md5, btrim, or regexp_replace.
ALTER FUNCTION public.novi_quest_uuid(text) SET search_path = public;
ALTER FUNCTION public.objectionable_text(text) SET search_path = public;
