-- Admin console actions on the existing user_roles / admin_actions / content_reports
-- system. The React page is only a client. Every change below is refused unless
-- auth.uid() has the admin role inside a SECURITY DEFINER function.
--
-- This file is not applied by the app. Apply it with the other migrations.
-- It does not grant the admin role to anyone. That step is scripts/grant-cadre-admin.sql
-- and it is not part of this migration.

-- ---------------------------------------------------------------------------
-- Standing and moderation columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

ALTER TABLE public.store_items
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

DO $cols$
BEGIN
  IF to_regclass('public.post_comments') IS NOT NULL THEN
    ALTER TABLE public.post_comments
      ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
      ADD COLUMN IF NOT EXISTS removed_at timestamptz;
  END IF;
  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
      ADD COLUMN IF NOT EXISTS removed_at timestamptz;
  END IF;
  IF to_regclass('public.stream_chat') IS NOT NULL THEN
    ALTER TABLE public.stream_chat
      ADD COLUMN IF NOT EXISTS removed_at timestamptz;
  END IF;
END
$cols$;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_moderation
  ON public.posts (hidden_at, removed_at)
  WHERE hidden_at IS NOT NULL OR removed_at IS NOT NULL;

-- Content actions have no member target. Keep the column for member actions.
ALTER TABLE public.admin_actions
  ALTER COLUMN target_user_id DROP NOT NULL;

ALTER TABLE public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_type_check;

ALTER TABLE public.admin_actions
  ADD CONSTRAINT admin_actions_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'suspend',
    'unsuspend',
    'warn',
    'remove',
    'approve_onboarding',
    'deny_onboarding',
    'reset_onboarding',
    'override',
    'mass_notification',
    'change_status_active',
    'change_status_denied',
    'change_status_banned',
    'remove_user',
    'adjust_credits',
    'toggle_admin',
    'bulk_award_credits',
    'award_credits',
    'deduct_credits',
    'grant_admin',
    'revoke_admin',
    'individual_message',
    'ban',
    'unban',
    'soft_delete_user',
    'hard_delete_user',
    'restore_user',
    'message_user',
    'report_dismiss',
    'report_resolve',
    'report_hide',
    'report_remove',
    'report_hard_delete',
    'content_hide',
    'content_unhide',
    'content_remove',
    'content_restore',
    'content_hard_delete'
  ]));

-- ---------------------------------------------------------------------------
-- Internal helpers. Authenticated callers cannot execute these directly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Admins only'
      USING ERRCODE = '42501';
  END IF;
  RETURN uid;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_action text,
  p_target uuid,
  p_reason text,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason, metadata)
  VALUES (
    auth.uid(),
    p_action,
    p_target,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_set_auth_ban(p_user_id uuid, p_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'banned_until'
  ) THEN
    RETURN;
  END IF;

  IF p_banned THEN
    EXECUTE 'UPDATE auth.users SET banned_until = $1 WHERE id = $2'
      USING 'infinity'::timestamptz, p_user_id;
  ELSE
    EXECUTE 'UPDATE auth.users SET banned_until = NULL WHERE id = $1'
      USING p_user_id;
  END IF;
END;
$fn$;

-- A member can still edit their own profile. They cannot change standing.
CREATE OR REPLACE FUNCTION public.protect_admin_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF current_user IN ('authenticated', 'anon', 'authenticator') THEN
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
      OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
      OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
      OR (
        NEW.access_status IS DISTINCT FROM OLD.access_status
        AND (OLD.access_status = 'banned' OR NEW.access_status = 'banned')
      )
    THEN
      RAISE EXCEPTION 'Only an admin can change account standing'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS protect_admin_profile_columns ON public.profiles;
CREATE TRIGGER protect_admin_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_profile_columns();

-- Owners keep editing their own rows. They cannot clear a moderation hold,
-- and they cannot delete a row an admin is holding.
CREATE OR REPLACE FUNCTION public.protect_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  held boolean;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon', 'authenticator') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    held := (to_jsonb(OLD) ? 'hidden_at' AND to_jsonb(OLD)->>'hidden_at' IS NOT NULL)
      OR (to_jsonb(OLD) ? 'removed_at' AND to_jsonb(OLD)->>'removed_at' IS NOT NULL);
    IF held THEN
      RAISE EXCEPTION 'An admin is holding this'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF (to_jsonb(NEW) ? 'hidden_at' AND NEW.hidden_at IS DISTINCT FROM OLD.hidden_at)
    OR (to_jsonb(NEW) ? 'removed_at' AND NEW.removed_at IS DISTINCT FROM OLD.removed_at)
  THEN
    RAISE EXCEPTION 'Only an admin can change visibility'
      USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'store_items'
    AND (OLD.hidden_at IS NOT NULL OR OLD.removed_at IS NOT NULL)
    AND NEW.is_active IS DISTINCT FROM OLD.is_active
  THEN
    RAISE EXCEPTION 'An admin is holding this item'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DO $mod_triggers$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['posts', 'events', 'store_items', 'post_comments', 'projects']
  LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS protect_moderation_columns ON public.%I', target);
    EXECUTE format(
      'CREATE TRIGGER protect_moderation_columns
         BEFORE UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.protect_moderation_columns()',
      target
    );
  END LOOP;
END
$mod_triggers$;

CREATE OR REPLACE FUNCTION public.reject_inactive_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  standing public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO standing FROM public.profiles WHERE user_id = auth.uid();
  IF standing.deleted_at IS NOT NULL
    OR standing.access_status = 'banned'
    OR COALESCE(standing.is_suspended, false)
  THEN
    RAISE EXCEPTION 'This account is not allowed to do that'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DO $inactive$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['posts', 'post_comments', 'events', 'store_items', 'messages']
  LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS reject_inactive_account ON public.%I', target);
    EXECUTE format(
      'CREATE TRIGGER reject_inactive_account
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.reject_inactive_account()',
      target
    );
  END LOOP;
END
$inactive$;

-- ---------------------------------------------------------------------------
-- Visibility. Admins still see held rows. Everyone else does not.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts"
  ON public.posts
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      removed_at IS NULL
      AND (hidden_at IS NULL OR user_id = auth.uid())
      AND NOT public.either_blocked(auth.uid(), user_id)
    )
  );

DO $comment_policy$
BEGIN
  IF to_regclass('public.post_comments') IS NULL THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
  CREATE POLICY "Anyone can view comments"
    ON public.post_comments
    FOR SELECT
    USING (
      public.has_role(auth.uid(), 'admin')
      OR (
        removed_at IS NULL
        AND (hidden_at IS NULL OR user_id = auth.uid())
        AND NOT public.either_blocked(auth.uid(), user_id)
      )
    );
END
$comment_policy$;

DO $stream_chat_policy$
BEGIN
  IF to_regclass('public.stream_chat') IS NULL THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "Stream chat visible unless blocked" ON public.stream_chat;
  CREATE POLICY "Stream chat visible unless blocked"
    ON public.stream_chat
    FOR SELECT
    TO authenticated
    USING (
      removed_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR NOT public.either_blocked(auth.uid(), user_id)
      )
    );
END
$stream_chat_policy$;

DROP POLICY IF EXISTS "Anyone can view public events" ON public.events;
CREATE POLICY "Anyone can view public events"
  ON public.events
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      removed_at IS NULL
      AND (
        (hidden_at IS NULL AND is_public = true)
        OR (auth.uid() IS NOT NULL AND creator_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Anyone can view active items" ON public.store_items;
CREATE POLICY "Anyone can view active items"
  ON public.store_items
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      removed_at IS NULL
      AND (
        (hidden_at IS NULL AND is_active = true)
        OR EXISTS (
          SELECT 1
          FROM public.stores
          WHERE stores.id = store_items.store_id
            AND stores.user_id = auth.uid()
        )
      )
    )
  );

DO $project_policy$
BEGIN
  IF to_regclass('public.projects') IS NULL
    OR to_regprocedure('public.can_view_project(uuid,uuid)') IS NULL
  THEN
    RETURN;
  END IF;
  EXECUTE $policy$
    DROP POLICY IF EXISTS "Anyone can view open projects" ON public.projects;
    DROP POLICY IF EXISTS "Private projects visible to creator and clients" ON public.projects;
    DROP POLICY IF EXISTS "Projects are visible to the community or their members" ON public.projects;
    CREATE POLICY "Projects are visible to the community or their members"
      ON public.projects
      FOR SELECT
      USING (
        public.has_role(auth.uid(), 'admin')
        OR (
          removed_at IS NULL
          AND (hidden_at IS NULL OR creator_id = auth.uid())
          AND (creator_id = auth.uid() OR public.can_view_project(id, auth.uid()))
        )
      );
  $policy$;
END
$project_policy$;

-- Hide banned and removed accounts from the directory. The person and an admin
-- can still read the row. Column order matches the previous view.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_barrier = true, security_invoker = false) AS
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
WHERE
  (
    p.user_id = auth.uid()
    OR COALESCE(p.show_only_to_passed_exam, false) = false
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.passed_exam = true
    )
  )
  AND (
    p.user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (p.deleted_at IS NULL AND p.access_status IS DISTINCT FROM 'banned')
  );

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Directory the admin page already calls. Same function, plus standing.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_admin_user_data();

CREATE FUNCTION public.get_admin_user_data()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  phone text,
  city text,
  mindset_level integer,
  access_status text,
  created_at timestamptz,
  is_suspended boolean,
  suspension_reason text,
  deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT
    p.user_id,
    au.email::text,
    p.display_name,
    p.phone,
    p.city,
    p.mindset_level,
    p.access_status,
    p.created_at,
    p.is_suspended,
    p.suspension_reason,
    p.deleted_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Member standing
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  p_user_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor uuid;
BEGIN
  actor := public.assert_admin();
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing user';
  END IF;
  IF p_user_id = actor AND p_action IN ('suspend', 'ban') THEN
    RAISE EXCEPTION 'You cannot change your own standing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_action = 'suspend' THEN
    UPDATE public.profiles
      SET is_suspended = true,
          suspended_at = now(),
          suspension_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Suspended by admin')
      WHERE user_id = p_user_id;
  ELSIF p_action = 'unsuspend' THEN
    UPDATE public.profiles
      SET is_suspended = false,
          suspended_at = NULL,
          suspension_reason = NULL
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
        AND access_status IS DISTINCT FROM 'banned';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This account is banned or removed';
    END IF;
  ELSIF p_action = 'ban' THEN
    UPDATE public.profiles
      SET access_status = 'banned',
          is_suspended = true,
          suspended_at = COALESCE(suspended_at, now()),
          suspension_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Banned by admin')
      WHERE user_id = p_user_id;
    PERFORM public.admin_set_auth_ban(p_user_id, true);
  ELSIF p_action = 'unban' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Account was removed. Restore it first.';
    END IF;
    UPDATE public.profiles
      SET access_status = 'active',
          is_suspended = false,
          suspended_at = NULL,
          suspension_reason = NULL
      WHERE user_id = p_user_id;
    PERFORM public.admin_set_auth_ban(p_user_id, false);
  ELSE
    RAISE EXCEPTION 'Unknown account action';
  END IF;

  PERFORM public.admin_write_audit(p_action, p_user_id, p_reason, jsonb_build_object('action', p_action));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_remove_user(
  p_user_id uuid,
  p_reason text DEFAULT NULL,
  p_hard boolean DEFAULT false,
  p_confirm text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  actor uuid;
BEGIN
  actor := public.assert_admin();
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing user';
  END IF;
  IF p_user_id = actor THEN
    RAISE EXCEPTION 'You cannot remove your own account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id)
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id)
  THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(p_hard, false) THEN
    IF p_confirm IS DISTINCT FROM p_user_id::text THEN
      RAISE EXCEPTION 'Hard delete requires a second confirmation of the user id'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.admin_write_audit(
      'hard_delete_user',
      p_user_id,
      p_reason,
      jsonb_build_object('hard', true)
    );
    IF to_regprocedure('public.purge_user_personal_data(uuid)') IS NOT NULL THEN
      PERFORM public.purge_user_personal_data(p_user_id);
    END IF;
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN;
  END IF;

  UPDATE public.profiles
    SET deleted_at = COALESCE(deleted_at, now()),
        access_status = 'banned',
        is_suspended = true,
        suspended_at = COALESCE(suspended_at, now()),
        suspension_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Removed by admin')
    WHERE user_id = p_user_id;
  PERFORM public.admin_set_auth_ban(p_user_id, true);
  PERFORM public.admin_write_audit(
    'soft_delete_user',
    p_user_id,
    p_reason,
    jsonb_build_object('hard', false)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_restore_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  PERFORM public.assert_admin();
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  UPDATE public.profiles
    SET deleted_at = NULL,
        access_status = 'active',
        is_suspended = false,
        suspended_at = NULL,
        suspension_reason = NULL
    WHERE user_id = p_user_id;
  PERFORM public.admin_set_auth_ban(p_user_id, false);
  PERFORM public.admin_write_audit('restore_user', p_user_id, p_reason, '{}'::jsonb);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Posts, events, and products
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_moderate_content(
  p_kind text,
  p_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_confirm text DEFAULT NULL,
  p_audit boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  owner_id uuid;
  action_name text;
BEGIN
  PERFORM public.assert_admin();
  IF p_id IS NULL OR p_kind NOT IN ('post', 'event', 'product') THEN
    RAISE EXCEPTION 'Unknown content';
  END IF;
  IF p_action NOT IN ('hide', 'unhide', 'remove', 'restore', 'hard_delete') THEN
    RAISE EXCEPTION 'Unknown moderation action';
  END IF;
  IF p_action = 'hard_delete' AND p_confirm IS DISTINCT FROM p_id::text THEN
    RAISE EXCEPTION 'Hard delete requires a second confirmation of the content id'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind = 'post' THEN
    SELECT user_id INTO owner_id FROM public.posts WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.posts SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_id;
    ELSIF p_action = 'unhide' THEN
      UPDATE public.posts SET hidden_at = NULL WHERE id = p_id AND removed_at IS NULL;
    ELSIF p_action = 'remove' THEN
      UPDATE public.posts
        SET removed_at = COALESCE(removed_at, now()),
            hidden_at = COALESCE(hidden_at, now())
        WHERE id = p_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.posts SET removed_at = NULL, hidden_at = NULL WHERE id = p_id;
    ELSE
      DELETE FROM public.posts WHERE id = p_id;
    END IF;
  ELSIF p_kind = 'event' THEN
    SELECT creator_id INTO owner_id FROM public.events WHERE id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.events SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_id;
    ELSIF p_action = 'unhide' THEN
      UPDATE public.events SET hidden_at = NULL WHERE id = p_id AND removed_at IS NULL;
    ELSIF p_action = 'remove' THEN
      UPDATE public.events
        SET removed_at = COALESCE(removed_at, now()),
            hidden_at = COALESCE(hidden_at, now())
        WHERE id = p_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.events SET removed_at = NULL, hidden_at = NULL WHERE id = p_id;
    ELSE
      DELETE FROM public.events WHERE id = p_id;
    END IF;
  ELSE
    SELECT s.user_id INTO owner_id
    FROM public.store_items i
    JOIN public.stores s ON s.id = i.store_id
    WHERE i.id = p_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.store_items
        SET hidden_at = COALESCE(hidden_at, now()), is_active = false
        WHERE id = p_id;
    ELSIF p_action = 'unhide' THEN
      UPDATE public.store_items
        SET hidden_at = NULL, is_active = true
        WHERE id = p_id AND removed_at IS NULL;
    ELSIF p_action = 'remove' THEN
      UPDATE public.store_items
        SET removed_at = COALESCE(removed_at, now()),
            hidden_at = COALESCE(hidden_at, now()),
            is_active = false
        WHERE id = p_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.store_items
        SET removed_at = NULL, hidden_at = NULL, is_active = true
        WHERE id = p_id;
    ELSE
      DELETE FROM public.store_items WHERE id = p_id;
    END IF;
  END IF;

  action_name := CASE p_action
    WHEN 'hide' THEN 'content_hide'
    WHEN 'unhide' THEN 'content_unhide'
    WHEN 'remove' THEN 'content_remove'
    WHEN 'restore' THEN 'content_restore'
    ELSE 'content_hard_delete'
  END;

  IF COALESCE(p_audit, true) THEN
    PERFORM public.admin_write_audit(
      action_name,
      owner_id,
      p_reason,
      jsonb_build_object('kind', p_kind, 'content_id', p_id, 'action', p_action)
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_list_content(
  p_kind text,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  id uuid,
  kind text,
  title text,
  owner_id uuid,
  owner_name text,
  state text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  q text := NULLIF(btrim(COALESCE(p_query, '')), '');
BEGIN
  PERFORM public.assert_admin();
  IF p_kind = 'post' THEN
    RETURN QUERY
    SELECT
      posts.id,
      'post'::text,
      LEFT(COALESCE(posts.content, ''), 140),
      posts.user_id,
      profiles.display_name,
      CASE
        WHEN posts.removed_at IS NOT NULL THEN 'removed'
        WHEN posts.hidden_at IS NOT NULL THEN 'hidden'
        ELSE 'visible'
      END,
      posts.created_at
    FROM public.posts
    LEFT JOIN public.profiles ON profiles.user_id = posts.user_id
    WHERE q IS NULL
      OR posts.id::text = q
      OR posts.content ILIKE '%' || q || '%'
    ORDER BY posts.created_at DESC
    LIMIT lim;
  ELSIF p_kind = 'event' THEN
    RETURN QUERY
    SELECT
      events.id,
      'event'::text,
      events.title,
      events.creator_id,
      profiles.display_name,
      CASE
        WHEN events.removed_at IS NOT NULL THEN 'removed'
        WHEN events.hidden_at IS NOT NULL THEN 'hidden'
        ELSE 'visible'
      END,
      events.created_at
    FROM public.events
    LEFT JOIN public.profiles ON profiles.user_id = events.creator_id
    WHERE q IS NULL
      OR events.id::text = q
      OR events.title ILIKE '%' || q || '%'
    ORDER BY events.created_at DESC
    LIMIT lim;
  ELSIF p_kind = 'product' THEN
    RETURN QUERY
    SELECT
      store_items.id,
      'product'::text,
      store_items.title,
      stores.user_id,
      profiles.display_name,
      CASE
        WHEN store_items.removed_at IS NOT NULL THEN 'removed'
        WHEN store_items.hidden_at IS NOT NULL THEN 'hidden'
        ELSE 'visible'
      END,
      store_items.created_at
    FROM public.store_items
    JOIN public.stores ON stores.id = store_items.store_id
    LEFT JOIN public.profiles ON profiles.user_id = stores.user_id
    WHERE q IS NULL
      OR store_items.id::text = q
      OR store_items.title ILIKE '%' || q || '%'
    ORDER BY store_items.created_at DESC
    LIMIT lim;
  ELSE
    RAISE EXCEPTION 'Unknown content';
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Report queue. resolve and dismiss close the report. hide and remove hold
-- the target. hard_delete needs the target id a second time.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_apply_report_target(
  p_target_type text,
  p_target_id uuid,
  p_action text,
  p_reason text,
  p_confirm text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  owner_id uuid;
BEGIN
  IF p_action = 'hard_delete' AND p_confirm IS DISTINCT FROM p_target_id::text THEN
    RAISE EXCEPTION 'Hard delete requires a second confirmation of the target id'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_type = 'post' THEN
    SELECT user_id INTO owner_id FROM public.posts WHERE id = p_target_id;
    PERFORM public.admin_moderate_content('post', p_target_id, p_action, p_reason, p_confirm, false);
    RETURN owner_id;
  ELSIF p_target_type = 'comment' AND to_regclass('public.post_comments') IS NOT NULL THEN
    SELECT user_id INTO owner_id FROM public.post_comments WHERE id = p_target_id;
    IF owner_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = p_target_id) THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.post_comments SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_target_id;
    ELSIF p_action IN ('remove', 'unhide') THEN
      UPDATE public.post_comments
        SET removed_at = CASE WHEN p_action = 'remove' THEN COALESCE(removed_at, now()) ELSE NULL END,
            hidden_at = CASE WHEN p_action = 'remove' THEN COALESCE(hidden_at, now()) ELSE NULL END
        WHERE id = p_target_id;
    ELSIF p_action = 'restore' THEN
      UPDATE public.post_comments SET removed_at = NULL, hidden_at = NULL WHERE id = p_target_id;
    ELSIF p_action = 'hard_delete' THEN
      DELETE FROM public.post_comments WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'message' AND to_regclass('public.messages') IS NOT NULL THEN
    SELECT sender_id INTO owner_id FROM public.messages WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.messages WHERE id = p_target_id;
    ELSE
      UPDATE public.messages
        SET deleted_at = now(), content = NULL
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'profile' THEN
    IF p_action = 'hide' THEN
      PERFORM public.admin_set_user_access(p_target_id, 'suspend', p_reason);
    ELSIF p_action = 'remove' THEN
      PERFORM public.admin_remove_user(p_target_id, p_reason, false, NULL);
    ELSIF p_action = 'hard_delete' THEN
      PERFORM public.admin_remove_user(p_target_id, p_reason, true, p_confirm);
    END IF;
    RETURN p_target_id;
  ELSIF p_target_type = 'project' AND to_regclass('public.projects') IS NOT NULL THEN
    SELECT creator_id INTO owner_id FROM public.projects WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.projects SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_target_id;
    ELSIF p_action = 'remove' THEN
      UPDATE public.projects
        SET removed_at = COALESCE(removed_at, now()),
            hidden_at = COALESCE(hidden_at, now())
        WHERE id = p_target_id;
    ELSIF p_action = 'hard_delete' THEN
      DELETE FROM public.projects WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'stream' AND to_regclass('public.live_streams') IS NOT NULL THEN
    SELECT host_id INTO owner_id FROM public.live_streams WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.live_streams WHERE id = p_target_id;
    ELSE
      UPDATE public.live_streams
        SET is_live = false,
            ended_at = COALESCE(ended_at, now()),
            title = CASE WHEN p_action = 'remove' THEN 'Removed' ELSE title END
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSIF p_target_type = 'stream_message' AND to_regclass('public.stream_chat') IS NOT NULL THEN
    SELECT user_id INTO owner_id FROM public.stream_chat WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hard_delete' THEN
      DELETE FROM public.stream_chat WHERE id = p_target_id;
    ELSE
      UPDATE public.stream_chat
        SET removed_at = COALESCE(removed_at, now())
        WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSE
    RAISE EXCEPTION 'This report target cannot be moderated that way';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_review_report(
  p_report_id uuid,
  p_action text,
  p_reason text DEFAULT NULL,
  p_confirm text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  report public.content_reports;
  owner_id uuid;
  audit_action text;
BEGIN
  PERFORM public.assert_admin();
  SELECT * INTO report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  IF report.status <> 'open' THEN
    RAISE EXCEPTION 'Report is already closed';
  END IF;

  IF p_action = 'dismiss' THEN
    audit_action := 'report_dismiss';
    UPDATE public.content_reports
      SET status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      WHERE id = p_report_id;
  ELSIF p_action = 'resolve' THEN
    audit_action := 'report_resolve';
    UPDATE public.content_reports
      SET status = 'actioned', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      WHERE id = p_report_id;
  ELSIF p_action IN ('hide', 'remove', 'hard_delete') THEN
    audit_action := CASE p_action
      WHEN 'hide' THEN 'report_hide'
      WHEN 'remove' THEN 'report_remove'
      ELSE 'report_hard_delete'
    END;
    owner_id := public.admin_apply_report_target(
      report.target_type,
      report.target_id,
      p_action,
      p_reason,
      p_confirm
    );
    UPDATE public.content_reports
      SET status = 'actioned', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      WHERE id = p_report_id;
  ELSE
    RAISE EXCEPTION 'Unknown moderation action';
  END IF;

  PERFORM public.admin_write_audit(
    audit_action,
    COALESCE(owner_id, report.reporter_id),
    COALESCE(p_reason, report.reason),
    jsonb_build_object(
      'report_id', report.id,
      'target_type', report.target_type,
      'target_id', report.target_id,
      'report_reason', report.reason,
      'action', p_action
    )
  );
END;
$fn$;

-- The existing button calls moderate_report(id, 'remove'). That path now
-- soft-removes. Permanent deletion goes through admin_review_report with a
-- second confirmation.
CREATE OR REPLACE FUNCTION public.moderate_report(p_report_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_action = 'dismiss' THEN
    PERFORM public.admin_review_report(p_report_id, 'dismiss', NULL, NULL);
  ELSIF p_action = 'remove' THEN
    PERFORM public.admin_review_report(p_report_id, 'remove', NULL, NULL);
  ELSE
    RAISE EXCEPTION 'Unknown moderation action';
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- In-app notice. Email and SMS stay on the admin edge function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_message_user(
  p_user_id uuid,
  p_title text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  notice_id uuid;
BEGIN
  PERFORM public.assert_admin();
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A title and a person are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.notification_preferences
    WHERE user_id = p_user_id
      AND admin_enabled = false
  ) THEN
    RAISE EXCEPTION 'This person turned off admin messages';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_user_id,
    'admin',
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_body, '')), ''),
    jsonb_build_object('from_admin', true, 'admin_id', auth.uid())
  )
  RETURNING id INTO notice_id;

  PERFORM public.admin_write_audit(
    'message_user',
    p_user_id,
    NULL,
    jsonb_build_object('title', btrim(p_title), 'notification_id', notice_id)
  );
  RETURN notice_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Counts an admin can see. Revenue is Stripe charges already stored.
-- Community-fund fee rows are a slice of those charges and are not added again.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  tickets bigint := 0;
  store_cents bigint := 0;
  music bigint := 0;
  memberships bigint := 0;
  studios bigint := 0;
  donations bigint := 0;
  result jsonb;
BEGIN
  PERFORM public.assert_admin();

  IF to_regclass('public.ticket_orders') IS NOT NULL THEN
    SELECT COALESCE(SUM(total_cents - LEAST(GREATEST(refund_amount_cents, 0), total_cents)), 0)::bigint
      INTO tickets
    FROM public.ticket_orders
    WHERE payment_method = 'stripe'
      AND payment_status IN ('paid', 'partial_refund')
      AND (stripe_payment_intent_id IS NOT NULL OR stripe_session_id IS NOT NULL);
  END IF;

  IF to_regclass('public.store_orders') IS NOT NULL THEN
    SELECT COALESCE(SUM(ROUND(GREATEST(total_price, 0) * 100)), 0)::bigint
      INTO store_cents
    FROM public.store_orders
    WHERE stripe_payment_intent_id IS NOT NULL
      AND status IN ('confirmed', 'completed');
  END IF;

  IF to_regclass('public.exclusive_track_purchases') IS NOT NULL THEN
    SELECT COALESCE(SUM(GREATEST(amount_cents, 0)), 0)::bigint
      INTO music
    FROM public.exclusive_track_purchases
    WHERE stripe_payment_intent_id IS NOT NULL;
  END IF;

  IF to_regclass('public.membership_contributions') IS NOT NULL THEN
    SELECT COALESCE(SUM(ROUND(GREATEST(amount, 0) * 100)), 0)::bigint
      INTO memberships
    FROM public.membership_contributions
    WHERE stripe_invoice_id IS NOT NULL;
  END IF;

  IF to_regclass('public.studio_bookings') IS NOT NULL THEN
    SELECT COALESCE(SUM(ROUND(GREATEST(COALESCE(total_price, 0), 0) * 100)), 0)::bigint
      INTO studios
    FROM public.studio_bookings
    WHERE stripe_payment_intent_id IS NOT NULL
      AND status IN ('approved', 'completed');
  END IF;

  IF to_regclass('public.donations') IS NOT NULL THEN
    SELECT COALESCE(SUM(ROUND(GREATEST(amount, 0) * 100)), 0)::bigint
      INTO donations
    FROM public.donations
    WHERE status = 'paid'
      AND (
        stripe_payment_intent_id IS NOT NULL
        OR stripe_session_id IS NOT NULL
        OR stripe_invoice_id IS NOT NULL
      );
  END IF;

  result := jsonb_build_object(
    'signups_total', (SELECT COUNT(*) FROM public.profiles),
    'signups_7d', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'signups_30d', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'posts_total', (SELECT COUNT(*) FROM public.posts),
    'posts_visible', (SELECT COUNT(*) FROM public.posts WHERE hidden_at IS NULL AND removed_at IS NULL),
    'events_total', (SELECT COUNT(*) FROM public.events),
    'events_upcoming', (
      SELECT COUNT(*) FROM public.events
      WHERE start_date > now() AND hidden_at IS NULL AND removed_at IS NULL
    ),
    'reports_total', (SELECT COUNT(*) FROM public.content_reports),
    'reports_open', (SELECT COUNT(*) FROM public.content_reports WHERE status = 'open'),
    'reports_ai_open', (
      SELECT COUNT(*) FROM public.content_reports
      WHERE status = 'open'
        AND reason IN (
          'AI-generated or fake content',
          'Fake or AI-generated person',
          'Fully AI-generated scene passed off as real work',
          'AI slop / spam promotion'
        )
    ),
    'revenue_cents', tickets + store_cents + music + memberships + studios + donations,
    'revenue_by_source', jsonb_build_object(
      'tickets', tickets,
      'store', store_cents,
      'music', music,
      'memberships', memberships,
      'studios', studios,
      'donations', donations
    )
  );
  RETURN result;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Grants. Hosted Supabase grants EXECUTE on new public functions to anon and
-- authenticated. REVOKE FROM PUBLIC does not remove those role grants.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.assert_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_write_audit(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_auth_ban(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_apply_report_target(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_write_audit(text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_auth_ban(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_apply_report_target(text, uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.protect_admin_profile_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_moderation_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_inactive_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_admin_profile_columns() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_moderation_columns() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_inactive_account() TO anon, authenticated, service_role;

DO $grants$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_admin_user_data()'::regprocedure,
    'public.admin_set_user_access(uuid,text,text)'::regprocedure,
    'public.admin_remove_user(uuid,text,boolean,text)'::regprocedure,
    'public.admin_restore_user(uuid,text)'::regprocedure,
    'public.admin_moderate_content(text,uuid,text,text,text,boolean)'::regprocedure,
    'public.admin_list_content(text,text,integer)'::regprocedure,
    'public.admin_review_report(uuid,text,text,text)'::regprocedure,
    'public.moderate_report(uuid,text)'::regprocedure,
    'public.admin_message_user(uuid,text,text)'::regprocedure,
    'public.admin_dashboard_stats()'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END
$grants$;
