-- Admin member directory that scales past a few hundred people, bulk member
-- actions, and removed or suspended accounts kept out of every member surface.
--
-- Every admin function below starts with public.assert_admin(), so a member
-- calling it directly gets "Admins only". Each per-person change goes through
-- the existing single-person functions, so each one is still written to
-- admin_actions. The bulk call adds one summary row.

-- ---------------------------------------------------------------------------
-- Audit types used by this file. Keep every type already in the table.
-- ---------------------------------------------------------------------------

DO $audit$
DECLARE
  allowed text[];
BEGIN
  SELECT array_agg(DISTINCT t ORDER BY t) INTO allowed
  FROM (
    SELECT unnest(ARRAY[
      'suspend', 'unsuspend', 'warn', 'remove', 'approve_onboarding', 'deny_onboarding',
      'reset_onboarding', 'override', 'mass_notification', 'change_status_active',
      'change_status_denied', 'change_status_banned', 'remove_user', 'adjust_credits',
      'toggle_admin', 'bulk_award_credits', 'award_credits', 'deduct_credits', 'grant_admin',
      'revoke_admin', 'individual_message', 'ban', 'unban', 'soft_delete_user',
      'hard_delete_user', 'restore_user', 'message_user', 'report_dismiss', 'report_resolve',
      'report_hide', 'report_remove', 'report_hard_delete', 'content_hide', 'content_unhide',
      'content_remove', 'content_restore', 'content_hard_delete',
      'change_level', 'bulk_action'
    ]) AS t
    UNION
    SELECT DISTINCT action_type FROM public.admin_actions WHERE action_type IS NOT NULL
  ) types;

  ALTER TABLE public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_type_check;
  EXECUTE format(
    'ALTER TABLE public.admin_actions ADD CONSTRAINT admin_actions_action_type_check CHECK (action_type = ANY (%L::text[]))',
    allowed
  );
END
$audit$;

-- ---------------------------------------------------------------------------
-- Removed, banned and suspended accounts are hidden from everyone but
-- themselves, admins included. Admin tools read people through the admin
-- functions below, not this view, so Explore looks the same for an admin as
-- it does for a member.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  p.id,
  p.user_id,
  p.display_name,
  p.city,
  p.city_display,
  p.city_key,
  p.bio,
  p.avatar_url,
  p.passion_seriousness,
  p.access_level,
  p.onboarding_completed,
  p.created_at,
  p.updated_at,
  p.mindset_level,
  p.access_status,
  p.social_links,
  p.is_suspended,
  p.suspended_at,
  p.suspension_reason,
  p.onboarding_level,
  p.founding
FROM public.profiles p
WHERE p.user_id = auth.uid()
  OR (
    p.deleted_at IS NULL
    AND p.access_status IS DISTINCT FROM 'banned'
    AND NOT COALESCE(p.is_suspended, false)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        (auth.uid() IS NULL OR public.ether_member_approved())
        AND p.access_status = 'active'
        AND p.onboarding_completed
        AND (
          COALESCE(p.show_only_to_passed_exam, false) = false
          OR EXISTS (
            SELECT 1
            FROM public.profiles viewer
            WHERE viewer.user_id = auth.uid()
              AND viewer.passed_exam = true
          )
        )
      )
    )
  );

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Posts and shops by a removed or suspended account leave the feed too.
-- Projects stay reachable for their collaborators.
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
CREATE POLICY "Members can view posts" ON public.posts
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      public.creative_account_ok(user_id)
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          removed_at IS NULL
          AND hidden_at IS NULL
          AND NOT public.either_blocked(auth.uid(), user_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Anyone can view active stores" ON public.stores;
CREATE POLICY "Anyone can view active stores" ON public.stores
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_active = true AND public.creative_account_ok(user_id))
  );

-- A creator card for content attribution. Nothing for a hidden account.
CREATE OR REPLACE FUNCTION public.get_public_creator_profile(creator_user_id uuid)
RETURNS TABLE(display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = creator_user_id
    AND (
      p.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR (p.deleted_at IS NULL AND p.access_status IS DISTINCT FROM 'banned' AND NOT COALESCE(p.is_suspended, false))
    )
  LIMIT 1;
$fn$;

-- The public Ether ID card stops resolving once an account is removed or banned.
DO $card$
DECLARE
  body text;
BEGIN
  IF to_regprocedure('public.ether_id_public_card(uuid)') IS NULL THEN
    RETURN;
  END IF;
  body := pg_get_functiondef('public.ether_id_public_card(uuid)'::regprocedure);
  IF position('p.deleted_at IS NULL' in body) = 0 THEN
    body := replace(
      body,
      'WHERE p.user_id = p_user_id;',
      'WHERE p.user_id = p_user_id AND p.deleted_at IS NULL AND p.access_status IS DISTINCT FROM ''banned'';'
    );
    EXECUTE body;
  END IF;
END
$card$;

-- Host audience tools only reach people in good standing.
DO $audience$
DECLARE
  fn text;
  body text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.get_audience_preview(jsonb,integer)', 'public.get_audience_estimate(jsonb)'] LOOP
    IF to_regprocedure(fn) IS NULL THEN
      CONTINUE;
    END IF;
    body := pg_get_functiondef(fn::regprocedure);
    IF position('p.deleted_at IS NULL' in body) = 0 THEN
      body := replace(
        body,
        'WHERE p.access_status = ''active''',
        'WHERE p.access_status = ''active'' AND p.deleted_at IS NULL AND NOT COALESCE(p.is_suspended, false)'
      );
      EXECUTE body;
    END IF;
  END LOOP;
END
$audience$;

-- ---------------------------------------------------------------------------
-- Admin member directory: filtered, sorted, one page at a time.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles (last_active_at DESC NULLS LAST);

-- Internal: the people that match a filter. Not callable by members.
CREATE OR REPLACE FUNCTION public.admin_member_matches(p_filters jsonb)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  avatar_url text,
  phone text,
  city text,
  mindset_level integer,
  access_status text,
  onboarding_completed boolean,
  created_at timestamptz,
  last_active_at timestamptz,
  is_suspended boolean,
  suspension_reason text,
  deleted_at timestamptz,
  is_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  f jsonb := COALESCE(p_filters, '{}'::jsonb);
  q text := NULLIF(btrim(left(COALESCE(f->>'q', ''), 120)), '');
  v_status text := NULLIF(f->>'status', '');
  v_level integer := NULLIF(f->>'level', '')::integer;
  v_role text := NULLIF(f->>'role', '');
  v_city text := NULLIF(btrim(COALESCE(f->>'city', '')), '');
  v_from timestamptz := NULLIF(f->>'joined_from', '')::timestamptz;
  v_to timestamptz := NULLIF(f->>'joined_to', '')::timestamptz;
  v_active text := NULLIF(f->>'active', '');
  v_suspended text := NULLIF(f->>'suspended', '');
  v_removed text := COALESCE(NULLIF(f->>'removed', ''), 'hide');
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT
    p.user_id,
    au.email::text,
    p.display_name,
    p.username,
    p.avatar_url,
    p.phone,
    COALESCE(NULLIF(p.city_display, ''), p.city),
    COALESCE(p.mindset_level, NULLIF(regexp_replace(COALESCE(p.access_level::text, ''), '\D', '', 'g'), '')::integer),
    p.access_status,
    COALESCE(p.onboarding_completed, false),
    p.created_at,
    p.last_active_at,
    COALESCE(p.is_suspended, false),
    p.suspension_reason,
    p.deleted_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE
    (v_removed = 'all'
      OR (v_removed = 'only' AND p.deleted_at IS NOT NULL)
      OR (v_removed = 'hide' AND p.deleted_at IS NULL))
    AND (q IS NULL OR (
      COALESCE(p.display_name, '') || ' ' || COALESCE(p.username, '') || ' ' || COALESCE(au.email::text, '')
        || ' ' || COALESCE(p.city, '') || ' ' || COALESCE(p.city_display, '') || ' ' || COALESCE(p.phone, '')
    ) ILIKE '%' || q || '%')
    AND (v_status IS NULL OR COALESCE(p.access_status, 'pending') = v_status)
    AND (v_level IS NULL OR COALESCE(p.mindset_level, NULLIF(regexp_replace(COALESCE(p.access_level::text, ''), '\D', '', 'g'), '')::integer) = v_level)
    AND (v_city IS NULL
      OR p.city ILIKE '%' || v_city || '%'
      OR p.city_display ILIKE '%' || v_city || '%'
      OR p.city_key = lower(v_city))
    AND (v_from IS NULL OR p.created_at >= v_from)
    AND (v_to IS NULL OR p.created_at < v_to + interval '1 day')
    AND (v_active IS NULL
      OR (v_active = '7d' AND p.last_active_at >= now() - interval '7 days')
      OR (v_active = '30d' AND p.last_active_at >= now() - interval '30 days')
      OR (v_active = 'inactive_30d' AND (p.last_active_at IS NULL OR p.last_active_at < now() - interval '30 days'))
      OR (v_active = 'never' AND p.last_active_at IS NULL))
    AND (v_suspended IS NULL
      OR (v_suspended = 'yes' AND COALESCE(p.is_suspended, false))
      OR (v_suspended = 'no' AND NOT COALESCE(p.is_suspended, false)))
    AND (v_role IS NULL
      OR (v_role = 'admin' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin'))
      OR (v_role = 'member' AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')));
END;
$fn$;

-- One page of people plus the total that match.
CREATE OR REPLACE FUNCTION public.admin_list_members(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'joined',
  p_dir text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_offset integer := GREATEST(0, COALESCE(p_offset, 0));
  v_desc boolean := lower(COALESCE(p_dir, 'desc')) <> 'asc';
  v_sort text := COALESCE(p_sort, 'joined');
  v_total bigint;
  v_rows jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT count(*) INTO v_total FROM public.admin_member_matches(p_filters);

  WITH page AS (
    SELECT m.*
    FROM public.admin_member_matches(p_filters) m
    ORDER BY
      CASE WHEN v_sort = 'name' AND NOT v_desc THEN lower(COALESCE(m.display_name, m.email, '')) END ASC,
      CASE WHEN v_sort = 'name' AND v_desc THEN lower(COALESCE(m.display_name, m.email, '')) END DESC,
      CASE WHEN v_sort = 'active' AND NOT v_desc THEN m.last_active_at END ASC NULLS FIRST,
      CASE WHEN v_sort = 'active' AND v_desc THEN m.last_active_at END DESC NULLS LAST,
      CASE WHEN v_sort = 'city' AND NOT v_desc THEN lower(COALESCE(m.city, '')) END ASC,
      CASE WHEN v_sort = 'city' AND v_desc THEN lower(COALESCE(m.city, '')) END DESC,
      CASE WHEN v_sort = 'level' AND NOT v_desc THEN m.mindset_level END ASC NULLS FIRST,
      CASE WHEN v_sort = 'level' AND v_desc THEN m.mindset_level END DESC NULLS LAST,
      CASE WHEN NOT v_desc THEN m.created_at END ASC,
      m.created_at DESC,
      m.user_id
    LIMIT v_limit OFFSET v_offset
  ), balances AS (
    SELECT l.user_id, COALESCE(SUM(d.genesis_delta + d.earned_delta), 0) AS balance
    FROM public.credit_ledger l
    CROSS JOIN LATERAL public.ledger_entry_deltas(l.credit_type, l.amount, l.genesis_amount, l.earned_amount) d
    WHERE l.user_id IN (SELECT user_id FROM page)
    GROUP BY l.user_id
  ), numbered AS (
    SELECT page.*, COALESCE(b.balance, 0) AS credit_balance, row_number() OVER () AS position
    FROM page
    LEFT JOIN balances b ON b.user_id = page.user_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(n) - 'position' ORDER BY n.position), '[]'::jsonb)
  INTO v_rows
  FROM numbered n;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$fn$;

-- Every id that matches a filter, for "select all that match". Capped.
CREATE OR REPLACE FUNCTION public.admin_member_ids(p_filters jsonb DEFAULT '{}'::jsonb, p_cap integer DEFAULT 5000)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  ids uuid[];
BEGIN
  PERFORM public.assert_admin();
  SELECT COALESCE(array_agg(m.user_id), ARRAY[]::uuid[]) INTO ids
  FROM (
    SELECT user_id
    FROM public.admin_member_matches(p_filters)
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_cap, 5000), 10000))
  ) m;
  RETURN ids;
END;
$fn$;

-- One person's skills, passions, roles and links for the detail sheet.
CREATE OR REPLACE FUNCTION public.admin_member_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'skills', COALESCE((
      SELECT jsonb_agg(DISTINCT s.name) FROM public.user_skills us JOIN public.skills s ON s.id = us.skill_id
      WHERE us.user_id = p_user_id), '[]'::jsonb),
    'passions', COALESCE((
      SELECT jsonb_agg(DISTINCT COALESCE(up.custom_name, ps.name)) FROM public.user_passions up
      LEFT JOIN public.passions ps ON ps.id = up.passion_id
      WHERE up.user_id = p_user_id AND COALESCE(up.custom_name, ps.name) IS NOT NULL), '[]'::jsonb),
    'creative_roles', COALESCE((
      SELECT jsonb_agg(DISTINCT cr.name) FROM public.user_creative_roles ucr JOIN public.creative_roles cr ON cr.id = ucr.role_id
      WHERE ucr.user_id = p_user_id), '[]'::jsonb),
    'social_links', (SELECT p.social_links FROM public.profiles p WHERE p.user_id = p_user_id),
    'bio', (SELECT p.bio FROM public.profiles p WHERE p.user_id = p_user_id)
  );
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Bulk actions. Up to 500 people per call; the page sends larger sets in
-- chunks. One failure does not stop the rest. Returns what each person was
-- before so the page can offer undo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_bulk_member_action(
  p_user_ids uuid[],
  p_action text,
  p_reason text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor uuid;
  target uuid;
  ids uuid[];
  v_level integer;
  v_title text;
  v_body text;
  ok_count integer := 0;
  failures jsonb := '[]'::jsonb;
  before jsonb := '[]'::jsonb;
  done_ids jsonb := '[]'::jsonb;
  prev record;
BEGIN
  actor := public.assert_admin();

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO ids FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) x WHERE x IS NOT NULL;
  IF cardinality(ids) = 0 THEN
    RAISE EXCEPTION 'Pick at least one person';
  END IF;
  IF cardinality(ids) > 500 THEN
    RAISE EXCEPTION 'Send at most 500 people at a time';
  END IF;
  IF p_action NOT IN ('suspend', 'unsuspend', 'ban', 'unban', 'remove', 'restore', 'set_level', 'message') THEN
    RAISE EXCEPTION 'Unknown bulk action';
  END IF;

  IF p_action = 'set_level' THEN
    v_level := NULLIF(p_payload->>'level', '')::integer;
    IF v_level IS NULL OR v_level NOT IN (1, 2, 3) THEN
      RAISE EXCEPTION 'Pick level 1, 2 or 3';
    END IF;
  ELSIF p_action = 'message' THEN
    v_title := NULLIF(btrim(COALESCE(p_payload->>'title', '')), '');
    v_body := NULLIF(btrim(COALESCE(p_payload->>'body', '')), '');
    IF v_title IS NULL THEN
      RAISE EXCEPTION 'A message needs a title';
    END IF;
  END IF;

  FOREACH target IN ARRAY ids LOOP
    SELECT p.mindset_level, p.access_level, p.is_suspended, p.suspension_reason, p.deleted_at, p.access_status
      INTO prev
      FROM public.profiles p WHERE p.user_id = target;

    BEGIN
      IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
      END IF;
      IF target = actor AND p_action IN ('suspend', 'ban', 'remove') THEN
        RAISE EXCEPTION 'You cannot change your own account';
      END IF;

      IF p_action IN ('suspend', 'unsuspend', 'ban', 'unban') THEN
        PERFORM public.admin_set_user_access(target, p_action, p_reason);
      ELSIF p_action = 'remove' THEN
        PERFORM public.admin_remove_user(target, p_reason, false, NULL);
      ELSIF p_action = 'restore' THEN
        PERFORM public.admin_restore_user(target, p_reason);
      ELSIF p_action = 'set_level' THEN
        UPDATE public.profiles
          SET mindset_level = v_level,
              access_level = ('level_' || v_level)::public.access_level
          WHERE user_id = target;
        PERFORM public.admin_write_audit(
          'change_level',
          target,
          p_reason,
          jsonb_build_object('level', v_level, 'previous_level', prev.mindset_level)
        );
      ELSIF p_action = 'message' THEN
        PERFORM public.admin_message_user(target, v_title, v_body);
      END IF;

      ok_count := ok_count + 1;
      done_ids := done_ids || to_jsonb(target);
      before := before || jsonb_build_array(jsonb_build_object(
        'user_id', target,
        'mindset_level', prev.mindset_level,
        'is_suspended', COALESCE(prev.is_suspended, false),
        'suspension_reason', prev.suspension_reason,
        'deleted_at', prev.deleted_at,
        'access_status', prev.access_status
      ));
    EXCEPTION WHEN OTHERS THEN
      failures := failures || jsonb_build_array(jsonb_build_object('user_id', target, 'error', SQLERRM));
    END;
  END LOOP;

  PERFORM public.admin_write_audit(
    'bulk_action',
    NULL,
    p_reason,
    jsonb_build_object(
      'action', p_action,
      'requested', cardinality(ids),
      'succeeded', ok_count,
      'failed', jsonb_array_length(failures),
      'payload', CASE WHEN p_action = 'message' THEN jsonb_build_object('title', v_title) ELSE COALESCE(p_payload, '{}'::jsonb) END
    )
  );

  RETURN jsonb_build_object(
    'action', p_action,
    'requested', cardinality(ids),
    'succeeded', ok_count,
    'failed', jsonb_array_length(failures),
    'errors', failures,
    'done', done_ids,
    'before', before
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_member_matches(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_member_matches(jsonb) TO service_role;

DO $grants$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_list_members(jsonb,text,text,integer,integer)'::regprocedure,
    'public.admin_member_ids(jsonb,integer)'::regprocedure,
    'public.admin_member_detail(uuid)'::regprocedure,
    'public.admin_bulk_member_action(uuid[],text,text,jsonb)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END
$grants$;
