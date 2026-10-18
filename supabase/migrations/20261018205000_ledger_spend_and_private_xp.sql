-- Spend checks read credit_ledger_balances, the same sums the wallet shows.
-- user_credits stays a cache the ledger trigger maintains.
--
-- XP is a separate private ledger. Triggers award it. Clients cannot insert
-- rows or call award_xp. Level is derived from the sum and is only returned
-- for auth.uid(). This file has not been applied to any live database.

-- ---------------------------------------------------------------------------
-- Tips lock the cache row, then spend the ledger totals.
-- ---------------------------------------------------------------------------

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
  v_host_balance numeric;
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

  PERFORM 1
  FROM public.user_credits
  WHERE user_id = p_tipper
  FOR UPDATE;

  v_genesis := (public.credit_ledger_balances(p_tipper)->>'genesis_balance')::numeric;
  v_earned := (public.credit_ledger_balances(p_tipper)->>'earned_balance')::numeric;
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

  v_host_balance := COALESCE((public.credit_ledger_balances(v_host)->>'balance')::numeric, 0);

  INSERT INTO public.credit_ledger (
    user_id, amount, balance_after, type, description,
    credit_type, genesis_amount, earned_amount, reference_type, reference_id
  ) VALUES (
    v_host, p_amount, v_host_balance + p_amount, 'earn',
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

-- Admin list uses the same ledger sums. Non-admins cannot call it.
CREATE OR REPLACE FUNCTION public.credit_balance_rows()
RETURNS TABLE (user_id uuid, balance numeric, genesis_balance numeric, earned_balance numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- current_user is the owner inside this definer function, so the admin
  -- check has to use the caller's auth.uid().
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    l.user_id,
    COALESCE(SUM(d.genesis_delta + d.earned_delta), 0),
    COALESCE(SUM(d.genesis_delta), 0),
    COALESCE(SUM(d.earned_delta), 0)
  FROM public.credit_ledger l
  CROSS JOIN LATERAL public.ledger_entry_deltas(
    l.credit_type, l.amount, l.genesis_amount, l.earned_amount
  ) d
  GROUP BY l.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_balance_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_balance_rows() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Private XP. Credits stay money. There is no public score and no leaderboard.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('post_work', 'collaborate', 'attend_event', 'complete_project')),
  source_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS xp_events_user_created ON public.xp_events (user_id, created_at);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own xp" ON public.xp_events;
CREATE POLICY "Users read own xp"
ON public.xp_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 40 XP per UTC day across every source. A repeated source event is a no-op.
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user uuid,
  p_source text,
  p_source_id uuid,
  p_amount integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today integer;
  v_room integer;
  v_grant integer;
  v_cap constant integer := 40;
BEGIN
  IF p_user IS NULL OR p_source_id IS NULL OR p_amount IS NULL OR p_amount < 1 THEN
    RETURN;
  END IF;
  IF p_source NOT IN ('post_work', 'collaborate', 'attend_event', 'complete_project') THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('xp:' || p_user::text, 0));

  SELECT COALESCE(SUM(amount), 0)::integer INTO v_today
  FROM public.xp_events
  WHERE user_id = p_user
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');

  v_room := v_cap - v_today;
  IF v_room < 1 THEN
    RETURN;
  END IF;
  v_grant := LEAST(p_amount, v_room);

  INSERT INTO public.xp_events (user_id, source, source_id, amount)
  VALUES (p_user, p_source, p_source_id, v_grant)
  ON CONFLICT (user_id, source, source_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.xp_level(p_total integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_total, 0) >= 400 THEN 5
    WHEN COALESCE(p_total, 0) >= 200 THEN 4
    WHEN COALESCE(p_total, 0) >= 100 THEN 3
    WHEN COALESCE(p_total, 0) >= 40 THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.my_xp()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', COALESCE(SUM(amount), 0),
    'level', public.xp_level(COALESCE(SUM(amount), 0)::integer)
  )
  FROM public.xp_events
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.xp_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(btrim(NEW.content), '') <> '' OR COALESCE(btrim(NEW.media_url), '') <> '' THEN
    PERFORM public.award_xp(NEW.user_id, 'post_work', NEW.id, 10);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xp_on_board_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.role IS DISTINCT FROM 'editor' THEN
    RETURN NEW;
  END IF;
  SELECT owner_user_id INTO v_owner FROM public.boards WHERE id = NEW.board_id;
  IF NEW.user_id IS DISTINCT FROM v_owner THEN
    PERFORM public.award_xp(NEW.user_id, 'collaborate', NEW.board_id, 15);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xp_on_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.award_xp(NEW.applicant_id, 'collaborate', NEW.project_id, 15);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xp_on_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'going' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'going' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = NEW.event_id AND e.creator_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public.award_xp(NEW.user_id, 'attend_event', NEW.event_id, 10);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.xp_on_project_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  PERFORM public.award_xp(NEW.creator_id, 'complete_project', NEW.id, 25);
  FOR v_user IN
    SELECT DISTINCT a.applicant_id
    FROM public.project_applications a
    WHERE a.project_id = NEW.id
      AND a.status = 'accepted'
      AND a.applicant_id IS DISTINCT FROM NEW.creator_id
  LOOP
    PERFORM public.award_xp(v_user, 'complete_project', NEW.id, 25);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xp_on_post ON public.posts;
CREATE TRIGGER xp_on_post
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.xp_on_post();

DROP TRIGGER IF EXISTS xp_on_board_member ON public.board_members;
CREATE TRIGGER xp_on_board_member
AFTER INSERT ON public.board_members
FOR EACH ROW
EXECUTE FUNCTION public.xp_on_board_member();

DROP TRIGGER IF EXISTS xp_on_application ON public.project_applications;
CREATE TRIGGER xp_on_application
AFTER INSERT OR UPDATE ON public.project_applications
FOR EACH ROW
EXECUTE FUNCTION public.xp_on_application();

DROP TRIGGER IF EXISTS xp_on_rsvp ON public.event_rsvps;
CREATE TRIGGER xp_on_rsvp
AFTER INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.xp_on_rsvp();

DROP TRIGGER IF EXISTS xp_on_project_completed ON public.projects;
CREATE TRIGGER xp_on_project_completed
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.xp_on_project_completed();

-- Default privileges grant EXECUTE to anon and authenticated. Take it back
-- so a client cannot call award_xp. Triggers run as the function owner.
REVOKE ALL ON FUNCTION public.award_xp(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xp_level(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_xp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_on_post() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_on_board_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_on_application() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_on_rsvp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_on_project_completed() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.xp_level(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_xp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xp_on_post() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_on_board_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_on_application() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_on_rsvp() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.xp_on_project_completed() TO authenticated, service_role;
