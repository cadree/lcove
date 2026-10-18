-- Lock SECURITY DEFINER execute grants, bookkeeping, and open inserts.
-- Hosted Supabase grants EXECUTE on new public functions to anon and
-- authenticated. REVOKE FROM PUBLIC does not remove those grants.
-- Trigger functions still run as the table owner. Policy helpers stay
-- executable by the role that evaluates the policy.

-- ---------------------------------------------------------------------------
-- 1. Execute grants and search_path
-- ---------------------------------------------------------------------------

DO $sweep$
DECLARE
  rec record;
  classified integer := 0;
  total integer;
BEGIN
  SELECT count(*) INTO total
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef;

  FOR rec IN
    SELECT p.oid::regprocedure AS fn, cls.kind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN (
      VALUES
        -- Logged-out callers, or RLS policies that apply to anon.
        ('can_manage_event(uuid,uuid)', 'anon'),
        ('cinema_playback(uuid,uuid)', 'anon'),
        ('get_artist_payout_status(uuid)', 'anon'),
        ('get_client_project_by_token(text)', 'anon'),
        ('get_platform_stats()', 'anon'),
        ('get_public_creator_profile(uuid)', 'anon'),
        ('has_blocked(uuid,uuid)', 'anon'),
        ('has_role(uuid,app_role)', 'anon'),
        ('is_board_member(uuid,uuid)', 'anon'),
        ('is_conversation_participant(uuid,uuid)', 'anon'),
        ('is_team_admin(uuid,uuid)', 'anon'),
        ('is_team_member(uuid,uuid)', 'anon'),
        ('membership_fund_snapshot(timestamp with time zone,timestamp with time zone)', 'anon'),

        -- Signed-in callers, or RLS policies that apply only to authenticated.
        ('accept_custom_role_proposal(uuid,text,uuid)', 'user'),
        ('check_in_attendee(text,uuid,text,text)', 'user'),
        ('credit_balance_rows()', 'user'),
        ('end_live_stream(uuid)', 'user'),
        ('ensure_default_pipeline(uuid,uuid)', 'user'),
        ('get_admin_user_data()', 'user'),
        ('get_attendee_crm_profile(text,uuid)', 'user'),
        ('get_audience_estimate(jsonb)', 'user'),
        ('get_audience_preview(jsonb,integer)', 'user'),
        ('get_campaign_analytics(uuid)', 'user'),
        ('get_user_emails_for_admin()', 'user'),
        ('is_project_client(uuid,uuid)', 'user'),
        ('is_project_creator(uuid,uuid)', 'user'),
        ('record_content_view(uuid)', 'user'),
        ('sender_blocked_in_conversation(uuid,uuid)', 'user'),
        ('touch_last_active()', 'user'),
        ('touch_stream_presence(uuid)', 'user'),
        ('upsert_attendee_note(text,uuid,text)', 'user'),

        -- Trigger functions. The invoking role does not need EXECUTE.
        ('add_org_owner_as_member()', 'trigger'),
        ('create_notification_preferences_for_new_user()', 'trigger'),
        ('enforce_report_insert()', 'trigger'),
        ('grant_genesis_credits()', 'trigger'),
        ('handle_application_accepted()', 'trigger'),
        ('handle_new_user()', 'trigger'),
        ('live_streams_seal_keys()', 'trigger'),
        ('log_task_event()', 'trigger'),
        ('prevent_blocked_follow()', 'trigger'),
        ('prevent_blocked_message()', 'trigger'),
        ('prevent_blocked_participant()', 'trigger'),
        ('touch_updated_at()', 'trigger'),
        ('update_conversation_timestamp()', 'trigger'),
        ('update_reputation_from_review()', 'trigger'),
        ('update_updated_at_column()', 'trigger'),
        ('update_user_credits()', 'trigger'),
        ('update_user_credits_dual()', 'trigger'),
        ('validate_credit_balances()', 'trigger'),
        ('validate_profile_completion()', 'trigger'),
        ('xp_on_application()', 'trigger'),
        ('xp_on_board_member()', 'trigger'),
        ('xp_on_post()', 'trigger'),
        ('xp_on_project_completed()', 'trigger'),
        ('xp_on_rsvp()', 'trigger'),

        -- Service role and other SECURITY DEFINER callers only.
        ('apply_stream_tip(uuid,uuid,integer,text,text)', 'internal'),
        ('award_xp(uuid,text,uuid,integer)', 'internal'),
        ('calculate_reputation_score(uuid)', 'internal'),
        ('can_watch_network(uuid,uuid)', 'internal'),
        ('cancel_pending_store_order(uuid)', 'internal'),
        ('cancel_pending_ticket_order(uuid)', 'internal'),
        ('complete_store_credit_purchase(uuid,uuid,integer)', 'internal'),
        ('confirm_event_ticket_order(uuid,text)', 'internal'),
        ('confirm_store_card_order(uuid,text)', 'internal'),
        ('delete_email(text,bigint)', 'internal'),
        ('enqueue_email(text,jsonb)', 'internal'),
        ('is_user_blocked(uuid,uuid)', 'internal'),
        ('mark_store_order_refunded(text)', 'internal'),
        ('move_to_dlq(text,text,bigint,jsonb)', 'internal'),
        ('purge_user_personal_data(uuid)', 'internal'),
        ('read_email_batch(text,integer,integer)', 'internal')
    ) AS cls(sig, kind)
      ON cls.sig = (p.oid::regprocedure)::text
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    classified := classified + 1;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', rec.fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', rec.fn);
    IF rec.kind = 'anon' THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role',
        rec.fn
      );
    ELSIF rec.kind = 'user' THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        rec.fn
      );
    ELSIF rec.kind IN ('trigger', 'internal') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.fn);
    ELSE
      RAISE EXCEPTION 'unknown class % for %', rec.kind, rec.fn;
    END IF;
  END LOOP;

  IF classified <> total THEN
    RAISE EXCEPTION 'classified % of % public SECURITY DEFINER functions', classified, total;
  END IF;
END
$sweep$;

DO $path$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
  END LOOP;
END
$path$;

-- Schema-level grants are merged with PostgreSQL's built-in default,
-- which gives EXECUTE to PUBLIC on every new function. PUBLIC includes
-- anon, so a schema-only revoke of anon still leaves the function callable.
-- The global revoke removes that built-in grant for functions this role creates.
ALTER DEFAULT PRIVILEGES
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bundle bookkeeping. The schema bundle creates this table before the
-- migrations run. Create it here too so a migrations-only scratch database
-- locks the same object.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ether_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ether_schema_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ether_schema_migrations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ether_schema_migrations TO service_role;

COMMENT ON TABLE public.ether_schema_migrations IS
  'Bundle bookkeeping. RLS is on and there are no policies. anon and authenticated have no grants. The table owner records applied versions.';

-- ---------------------------------------------------------------------------
-- 3. Open INSERT policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users create notifications they caused" ON public.notifications;
CREATE POLICY "Authenticated users create notifications they caused"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (
      type = 'event_reminder'
      AND user_id = auth.uid()
    )
    OR (
      type = 'message'
      AND user_id IS DISTINCT FROM auth.uid()
      AND COALESCE(data->>'conversation_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.is_conversation_participant((data->>'conversation_id')::uuid, auth.uid())
      AND public.is_conversation_participant((data->>'conversation_id')::uuid, user_id)
    )
    OR (
      type = 'follow'
      AND EXISTS (
        SELECT 1
        FROM public.favorite_friends f
        WHERE f.user_id = auth.uid()
          AND f.friend_user_id = notifications.user_id
      )
    )
    OR (
      type = 'like'
      AND COALESCE(data->>'post_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.post_likes l
        JOIN public.posts p ON p.id = l.post_id
        WHERE l.user_id = auth.uid()
          AND l.post_id = (notifications.data->>'post_id')::uuid
          AND p.user_id = notifications.user_id
      )
    )
    OR (
      type = 'comment'
      AND COALESCE(data->>'post_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.post_comments c
        JOIN public.posts p ON p.id = c.post_id
        WHERE c.user_id = auth.uid()
          AND c.post_id = (notifications.data->>'post_id')::uuid
          AND p.user_id = notifications.user_id
      )
    )
    OR (
      type = 'live_stream'
      AND COALESCE(data->>'stream_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (
        SELECT 1
        FROM public.live_streams s
        WHERE s.id = (notifications.data->>'stream_id')::uuid
          AND s.host_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1
        FROM public.favorite_friends f
        WHERE f.friend_user_id = auth.uid()
          AND f.user_id = notifications.user_id
      )
    )
    OR (
      type IN ('project_update', 'project_client_invite')
      AND COALESCE(data->>'project_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND (
        EXISTS (
          SELECT 1
          FROM public.projects p
          WHERE p.id = (notifications.data->>'project_id')::uuid
            AND p.creator_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.conversations c ON c.project_id = p.id
          JOIN public.conversation_participants cp ON cp.conversation_id = c.id
          WHERE p.id = (notifications.data->>'project_id')::uuid
            AND p.creator_id = notifications.user_id
            AND cp.user_id = auth.uid()
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "System can create matches" ON public.ai_project_matches;

DROP POLICY IF EXISTS "System can create timeline entries" ON public.contact_timeline;

-- ---------------------------------------------------------------------------
-- 4. Tables with RLS and no policies. The browser does not read them.
-- service_role bypasses RLS. No client policy is added.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.processed_stripe_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.processed_stripe_events TO service_role;

COMMENT ON TABLE public.processed_stripe_events IS
  'Stripe webhook idempotency. RLS is on and there are no policies on purpose. The browser never reads this table. service_role bypasses RLS. anon and authenticated have no grants.';

COMMENT ON TABLE public.store_secrets IS
  'Store payment secrets. RLS is on and there are no policies on purpose. The browser never reads this table. service_role bypasses RLS. anon and authenticated have no grants.';

-- ---------------------------------------------------------------------------
-- 5. profiles realtime would deliver every column of a row the subscriber
-- can SELECT, including phone and exam fields the public view omits.
-- The landing stats hook only used the event to refresh a count.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. delete-account lists an avatars bucket. Profile photos are public
-- URLs in the media bucket, so this bucket is private.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view own avatars" ON storage.objects;
CREATE POLICY "Users can view own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
