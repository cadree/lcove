-- Feature-audit fixes. Does not rewrite existing credit balances.
-- The one-time balance reconciliation is the next file and needs Cadre's approval
-- before it is applied to production.
-- Does not change Stripe webhooks, memberships, donations, store checkout, or tickets.

-- ---------------------------------------------------------------------------
-- Credits: the ledger is the only writer of user_credits.
-- A split column of 0 means "use amount" for that credit_type.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ledger_entry_deltas(
  p_credit_type text,
  p_amount numeric,
  p_genesis_amount numeric,
  p_earned_amount numeric
)
RETURNS TABLE (genesis_delta numeric, earned_delta numeric)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_credit_type = 'genesis' THEN
        CASE WHEN COALESCE(p_genesis_amount, 0) = 0 THEN COALESCE(p_amount, 0)
             ELSE p_genesis_amount END
      ELSE COALESCE(p_genesis_amount, 0)
    END,
    CASE
      WHEN p_credit_type = 'earned' THEN
        CASE WHEN COALESCE(p_earned_amount, 0) = 0 THEN COALESCE(p_amount, 0)
             ELSE p_earned_amount END
      ELSE COALESCE(p_earned_amount, 0)
    END;
$$;

CREATE OR REPLACE FUNCTION public.grant_genesis_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Do not write user_credits here. The ledger insert is the only writer;
  -- update_user_credits_dual applies this row once.
  INSERT INTO public.credit_ledger (
    user_id, amount, balance_after, type, description,
    credit_type, genesis_amount, earned_amount
  )
  VALUES (
    NEW.user_id, 100, 100, 'earn', 'Genesis Credit - Welcome to ETHER',
    'genesis', 100, 0
  );

  INSERT INTO public.credit_earning_limits (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_credits_dual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_genesis numeric;
  v_earned numeric;
BEGIN
  SELECT genesis_delta, earned_delta
    INTO v_genesis, v_earned
  FROM public.ledger_entry_deltas(
    NEW.credit_type, NEW.amount, NEW.genesis_amount, NEW.earned_amount
  );

  INSERT INTO public.user_credits (
    user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent
  )
  VALUES (NEW.user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_credits SET
    genesis_balance = genesis_balance + v_genesis,
    earned_balance = earned_balance + v_earned,
    balance = (genesis_balance + v_genesis) + (earned_balance + v_earned),
    genesis_lifetime_minted = genesis_lifetime_minted + CASE WHEN v_genesis > 0 THEN v_genesis ELSE 0 END,
    genesis_burned = genesis_burned + CASE
      WHEN NEW.credit_type = 'genesis' AND NEW.type IN ('spend', 'transfer_out') THEN ABS(v_genesis)
      ELSE 0
    END,
    lifetime_earned = lifetime_earned + CASE WHEN v_earned > 0 THEN v_earned ELSE 0 END,
    lifetime_spent = lifetime_spent + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Display source of truth. Sums the same deltas the trigger applies.
CREATE OR REPLACE FUNCTION public.credit_ledger_balances(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'genesis_balance', COALESCE(SUM(d.genesis_delta), 0),
    'earned_balance', COALESCE(SUM(d.earned_delta), 0),
    'balance', COALESCE(SUM(d.genesis_delta + d.earned_delta), 0)
  )
  FROM public.credit_ledger l
  CROSS JOIN LATERAL public.ledger_entry_deltas(
    l.credit_type, l.amount, l.genesis_amount, l.earned_amount
  ) d
  WHERE l.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.credit_ledger_balances(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_ledger_balances(uuid) TO anon, authenticated, service_role;

-- Stream tips: one idempotency key, genesis spent before earned, credit_type set.
ALTER TABLE public.stream_tips
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS stream_tips_idempotency_key
  ON public.stream_tips (tipper_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_stream_tip(
  p_tipper uuid,
  p_stream_id uuid,
  p_amount integer,
  p_message text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_title text;
  v_genesis numeric;
  v_earned numeric;
  v_genesis_spend integer;
  v_earned_spend integer;
  v_total numeric;
BEGIN
  IF p_tipper IS NULL OR p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'Invalid tip';
  END IF;
  IF auth.uid() IS DISTINCT FROM p_tipper
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency key required';
  END IF;

  SELECT host_id, title INTO v_host, v_title
  FROM public.live_streams
  WHERE id = p_stream_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Stream not found';
  END IF;
  IF v_host = p_tipper THEN
    RAISE EXCEPTION 'Cannot tip your own stream';
  END IF;

  BEGIN
    INSERT INTO public.stream_tips (stream_id, tipper_id, host_id, amount, message, idempotency_key)
    VALUES (p_stream_id, p_tipper, v_host, p_amount, NULLIF(btrim(COALESCE(p_message, '')), ''), p_idempotency_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END;

  INSERT INTO public.user_credits (user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent)
  VALUES (p_tipper, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT genesis_balance, earned_balance
    INTO v_genesis, v_earned
  FROM public.user_credits
  WHERE user_id = p_tipper
  FOR UPDATE;

  v_total := COALESCE(v_genesis, 0) + COALESCE(v_earned, 0);
  IF v_total < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  IF COALESCE(v_genesis, 0) >= p_amount THEN
    v_genesis_spend := p_amount;
    v_earned_spend := 0;
  ELSE
    v_genesis_spend := COALESCE(v_genesis, 0)::integer;
    v_earned_spend := p_amount - v_genesis_spend;
  END IF;

  IF v_genesis_spend > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, amount, balance_after, type, description,
      credit_type, genesis_amount, earned_amount, reference_type, reference_id
    ) VALUES (
      p_tipper, -v_genesis_spend, v_total - v_genesis_spend, 'spend',
      'Tip to stream: ' || COALESCE(v_title, 'live'),
      'genesis', -v_genesis_spend, 0, 'stream_tip', p_stream_id
    );
  END IF;

  IF v_earned_spend > 0 THEN
    INSERT INTO public.credit_ledger (
      user_id, amount, balance_after, type, description,
      credit_type, genesis_amount, earned_amount, reference_type, reference_id
    ) VALUES (
      p_tipper, -v_earned_spend, v_total - p_amount, 'spend',
      'Tip to stream: ' || COALESCE(v_title, 'live'),
      'earned', 0, -v_earned_spend, 'stream_tip', p_stream_id
    );
  END IF;

  INSERT INTO public.credit_ledger (
    user_id, amount, balance_after, type, description,
    credit_type, genesis_amount, earned_amount, reference_type, reference_id
  ) VALUES (
    v_host, p_amount, p_amount, 'earn',
    'Tip received on stream',
    'earned', 0, p_amount, 'stream_tip', p_stream_id
  );

  PERFORM public.increment_stream_tips(p_stream_id, p_amount);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_host, 'stream_tip', 'You received a tip!',
    'Someone tipped you ' || p_amount || ' LC on your stream',
    jsonb_build_object('stream_id', p_stream_id, 'amount', p_amount)
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'genesis_spent', v_genesis_spend,
    'earned_spent', v_earned_spend
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stream_tip(uuid, uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stream_tip(uuid, uuid, integer, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Livestream: keys leave the public row, obs_rtmp is allowed, chat, presence.
-- ---------------------------------------------------------------------------

ALTER TABLE public.live_streams DROP CONSTRAINT IF EXISTS live_streams_stream_type_check;
ALTER TABLE public.live_streams ADD CONSTRAINT live_streams_stream_type_check
  CHECK (stream_type IN ('webrtc', 'youtube', 'twitch', 'soundcloud', 'obs_rtmp'));

CREATE TABLE IF NOT EXISTS public.live_stream_secrets (
  stream_id uuid PRIMARY KEY REFERENCES public.live_streams(id) ON DELETE CASCADE,
  rtmp_stream_key text,
  rtmp_ingest_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_stream_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts read own stream secrets" ON public.live_stream_secrets;
CREATE POLICY "Hosts read own stream secrets"
ON public.live_stream_secrets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_streams s
    WHERE s.id = stream_id AND s.host_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.live_streams_seal_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rtmp_stream_key IS NULL AND NEW.rtmp_ingest_url IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.live_stream_secrets (stream_id, rtmp_stream_key, rtmp_ingest_url)
  VALUES (NEW.id, NEW.rtmp_stream_key, NEW.rtmp_ingest_url)
  ON CONFLICT (stream_id) DO UPDATE SET
    rtmp_stream_key = COALESCE(EXCLUDED.rtmp_stream_key, public.live_stream_secrets.rtmp_stream_key),
    rtmp_ingest_url = COALESCE(EXCLUDED.rtmp_ingest_url, public.live_stream_secrets.rtmp_ingest_url),
    updated_at = now();

  -- Clear the public copy. This second update sees null keys and does not loop.
  UPDATE public.live_streams
  SET rtmp_stream_key = NULL,
      rtmp_ingest_url = NULL
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_streams_seal_keys ON public.live_streams;
-- AFTER, not BEFORE: the secrets row references live_streams, which does not
-- exist yet during BEFORE INSERT.
CREATE TRIGGER live_streams_seal_keys
AFTER INSERT OR UPDATE ON public.live_streams
FOR EACH ROW
EXECUTE FUNCTION public.live_streams_seal_keys();

-- Move any keys already stored on the public row into the host-only table.
UPDATE public.live_streams
SET rtmp_stream_key = rtmp_stream_key
WHERE rtmp_stream_key IS NOT NULL OR rtmp_ingest_url IS NOT NULL;

DROP VIEW IF EXISTS public.live_streams_public;
CREATE VIEW public.live_streams_public
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.host_id,
  s.title,
  s.description,
  s.stream_type,
  s.external_url,
  s.thumbnail_url,
  s.thumbnail_focal_point,
  s.is_live,
  s.started_at,
  s.ended_at,
  s.viewer_count,
  s.total_tips,
  s.created_at,
  s.replay_available,
  s.replay_url,
  s.playback_url,
  CASE WHEN auth.uid() = s.host_id THEN sec.rtmp_stream_key ELSE NULL END AS rtmp_stream_key,
  CASE WHEN auth.uid() = s.host_id THEN sec.rtmp_ingest_url ELSE NULL END AS rtmp_ingest_url,
  s.mux_live_stream_id,
  s.mux_playback_id,
  s.event_type,
  s.is_virtual_event,
  s.max_attendees,
  s.parent_event_id,
  s.requires_ticket,
  s.ticket_price
FROM public.live_streams s
LEFT JOIN public.live_stream_secrets sec
  ON sec.stream_id = s.id AND auth.uid() = s.host_id;

GRANT SELECT ON public.live_streams_public TO anon, authenticated, service_role;

ALTER TABLE public.stream_viewers
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_stream_presence(p_stream_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_streams WHERE id = p_stream_id) THEN
    RAISE EXCEPTION 'Stream not found';
  END IF;

  INSERT INTO public.stream_viewers (stream_id, viewer_id, joined_at, last_seen, left_at)
  VALUES (p_stream_id, auth.uid(), now(), now(), NULL)
  ON CONFLICT (stream_id, viewer_id) DO UPDATE
    SET last_seen = now(), left_at = NULL;

  SELECT count(*)::integer INTO v_count
  FROM public.stream_viewers
  WHERE stream_id = p_stream_id
    AND left_at IS NULL
    AND last_seen > now() - interval '45 seconds';

  UPDATE public.live_streams SET viewer_count = v_count WHERE id = p_stream_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_stream_presence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_stream_presence(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_live_stream(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_streams
    WHERE id = p_stream_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not host';
  END IF;

  UPDATE public.live_streams
  SET is_live = false,
      ended_at = now(),
      viewer_count = 0
  WHERE id = p_stream_id;

  UPDATE public.stream_viewers
  SET left_at = now()
  WHERE stream_id = p_stream_id AND left_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.end_live_stream(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_live_stream(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.stream_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stream_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stream chat visible unless blocked" ON public.stream_chat;
CREATE POLICY "Stream chat visible unless blocked"
ON public.stream_chat
FOR SELECT
TO authenticated
USING (
  NOT public.has_blocked(auth.uid(), user_id)
  AND NOT public.has_blocked(user_id, auth.uid())
);

DROP POLICY IF EXISTS "Users send own stream chat" ON public.stream_chat;
CREATE POLICY "Users send own stream chat"
ON public.stream_chat
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.live_streams s
    WHERE s.id = stream_id
      AND (
        public.has_blocked(s.host_id, auth.uid())
        OR public.has_blocked(auth.uid(), s.host_id)
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_stream_chat_stream_created
  ON public.stream_chat (stream_id, created_at);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_chat;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.board_items;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('post', 'profile', 'message', 'comment', 'project', 'stream_message'));

-- ---------------------------------------------------------------------------
-- Cinema: owner publish is allowed by RLS; playback URLs are not column-readable.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Network owners can manage content" ON public.network_content;
CREATE POLICY "Network owners can manage content"
ON public.network_content
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.networks n
    WHERE n.id = network_content.network_id AND n.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.networks n
    WHERE n.id = network_content.network_id AND n.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can review content submissions" ON public.content_submissions;
CREATE POLICY "Admins can review content submissions"
ON public.content_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can review network content" ON public.network_content;
CREATE POLICY "Admins can review network content"
ON public.network_content
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.can_watch_network(p_network_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.networks n
    WHERE n.id = p_network_id
      AND (
        n.owner_id = p_user
        OR n.is_paid = false
        OR (
          p_user IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.network_subscriptions s
            WHERE s.network_id = n.id
              AND s.user_id = p_user
              AND s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now())
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.cinema_playback(
  p_content_id uuid,
  p_episode_id uuid DEFAULT NULL
)
RETURNS TABLE (video_url text, external_video_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network uuid;
  v_creator uuid;
  v_owner uuid;
  v_published boolean;
BEGIN
  IF p_episode_id IS NOT NULL THEN
    SELECT nc.network_id, nc.creator_id, n.owner_id, nc.is_published
      INTO v_network, v_creator, v_owner, v_published
    FROM public.tv_episodes e
    JOIN public.tv_seasons s ON s.id = e.season_id
    JOIN public.network_content nc ON nc.id = s.content_id
    JOIN public.networks n ON n.id = nc.network_id
    WHERE e.id = p_episode_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;
    IF NOT v_published AND auth.uid() IS DISTINCT FROM v_owner AND auth.uid() IS DISTINCT FROM v_creator THEN
      RETURN;
    END IF;
    IF NOT public.can_watch_network(v_network, auth.uid())
       AND auth.uid() IS DISTINCT FROM v_creator THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT e.video_url, e.external_video_url
    FROM public.tv_episodes e
    WHERE e.id = p_episode_id;
    RETURN;
  END IF;

  SELECT nc.network_id, nc.creator_id, n.owner_id, nc.is_published
    INTO v_network, v_creator, v_owner, v_published
  FROM public.network_content nc
  JOIN public.networks n ON n.id = nc.network_id
  WHERE nc.id = p_content_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF NOT v_published AND auth.uid() IS DISTINCT FROM v_owner AND auth.uid() IS DISTINCT FROM v_creator THEN
    RETURN;
  END IF;
  IF NOT public.can_watch_network(v_network, auth.uid())
     AND auth.uid() IS DISTINCT FROM v_creator THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT nc.video_url, nc.external_video_url
  FROM public.network_content nc
  WHERE nc.id = p_content_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_content_view(p_content_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network uuid;
  v_creator uuid;
  v_count integer;
BEGIN
  SELECT network_id, creator_id INTO v_network, v_creator
  FROM public.network_content
  WHERE id = p_content_id;
  IF v_network IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT public.can_watch_network(v_network, auth.uid())
     AND auth.uid() IS DISTINCT FROM v_creator THEN
    SELECT COALESCE(view_count, 0) INTO v_count FROM public.network_content WHERE id = p_content_id;
    RETURN v_count;
  END IF;

  UPDATE public.network_content
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_content_id
  RETURNING view_count INTO v_count;

  UPDATE public.networks
  SET total_views = COALESCE(total_views, 0) + 1
  WHERE id = v_network;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.can_watch_network(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cinema_playback(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_content_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_watch_network(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cinema_playback(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_content_view(uuid) TO authenticated;

-- A column-level REVOKE does not remove a table-level GRANT SELECT, so a
-- client can still read video_url. Drop table SELECT, then grant every column
-- except the playback URLs. cinema_playback (security definer) is the only reader.
REVOKE SELECT ON public.network_content FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.tv_episodes FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, network_id, creator_id, title, description, cover_art_url, trailer_url,
  content_type, runtime_minutes, director, cast_members, credits, genre_tags,
  is_featured, view_count, release_date, is_published, created_at, updated_at
) ON public.network_content TO anon, authenticated;

GRANT SELECT (
  id, season_id, episode_number, title, description, thumbnail_url,
  runtime_minutes, created_at
) ON public.tv_episodes TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.content_likes (
  content_id uuid NOT NULL REFERENCES public.network_content(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can count content likes" ON public.content_likes;
CREATE POLICY "Anyone can count content likes"
ON public.content_likes
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users like as themselves" ON public.content_likes;
CREATE POLICY "Users like as themselves"
ON public.content_likes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove own content likes" ON public.content_likes;
CREATE POLICY "Users remove own content likes"
ON public.content_likes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Notifications, calendar recurrence, native push platform.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS follows_enabled boolean DEFAULT true;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_recurrence_check;
ALTER TABLE public.events ADD CONSTRAINT events_recurrence_check
  CHECK (recurrence IS NULL OR recurrence IN ('FREQ=WEEKLY', 'FREQ=MONTHLY'));

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web';

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
