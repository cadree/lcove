-- Reporting, block enforcement, and account-deletion support.
-- This file is not applied by the app. Apply it in a review environment.
-- Do not run it against the live database from a client or this repo's scripts.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'profile', 'message', 'comment', 'project')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'Harassment or abuse',
    'Spam',
    'Hate or violence',
    'Sexual content',
    'Scam or fraud',
    'AI-generated or fake content',
    'Other'
  )),
  details text CHECK (details IS NULL OR char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE UNIQUE INDEX content_reports_one_open
  ON public.content_reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

CREATE INDEX content_reports_status_created
  ON public.content_reports (status, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to report'
      USING ERRCODE = '42501';
  END IF;

  NEW.reporter_id := auth.uid();
  NEW.status := 'open';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_report_insert ON public.content_reports;
CREATE TRIGGER enforce_report_insert
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_report_insert();

CREATE POLICY "Reporters insert own reports"
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'open'
  );

CREATE POLICY "Reporters read own reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "Admins read reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update reports"
  ON public.content_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
REVOKE DELETE ON public.content_reports FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- Blocks: the blocker stops seeing the person, and the blocked person
-- cannot message or follow the blocker. Checks run as security definer
-- because user_blocks is not readable by the blocked person.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_blocked(blocker uuid, blocked uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks
    WHERE blocker_id = blocker
      AND blocked_id = blocked
  );
$$;

CREATE OR REPLACE FUNCTION public.sender_blocked_in_conversation(_conversation_id uuid, _sender uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    JOIN public.user_blocks b
      ON b.blocker_id = cp.user_id
     AND b.blocked_id = _sender
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id <> _sender
  );
$$;

REVOKE ALL ON FUNCTION public.has_blocked(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sender_blocked_in_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_blocked(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sender_blocked_in_conversation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_report_insert() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_blocked_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.sender_blocked_in_conversation(NEW.conversation_id, NEW.sender_id) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_blocked_message ON public.messages;
CREATE TRIGGER prevent_blocked_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_message();

CREATE OR REPLACE FUNCTION public.prevent_blocked_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The actor is blocked by the person they are adding.
  IF public.has_blocked(NEW.user_id, auth.uid()) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  -- The actor is joining a conversation that already includes someone who blocked them.
  IF auth.uid() = NEW.user_id AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND public.has_blocked(cp.user_id, NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_blocked_participant ON public.conversation_participants;
CREATE TRIGGER prevent_blocked_participant
  BEFORE INSERT ON public.conversation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_participant();

CREATE OR REPLACE FUNCTION public.prevent_blocked_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_blocked(NEW.friend_user_id, NEW.user_id) THEN
    RAISE EXCEPTION 'This person has blocked you, so you cannot follow them'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_blocked_follow ON public.favorite_friends;
CREATE TRIGGER prevent_blocked_follow
  BEFORE INSERT ON public.favorite_friends
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_follow();

GRANT EXECUTE ON FUNCTION public.prevent_blocked_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_blocked_participant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_blocked_follow() TO authenticated;

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts"
  ON public.posts
  FOR SELECT
  USING (NOT public.has_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Anyone can view comments"
  ON public.post_comments
  FOR SELECT
  USING (NOT public.has_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages
  FOR SELECT
  USING (
    public.is_conversation_participant(conversation_id, auth.uid())
    AND deleted_at IS NULL
    AND NOT public.has_blocked(auth.uid(), sender_id)
  );

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND NOT public.sender_blocked_in_conversation(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can add favorites" ON public.favorite_friends;
CREATE POLICY "Users can add favorites"
  ON public.favorite_friends
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.has_blocked(friend_user_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Account deletion: keep shared money records, drop the login link.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  conname text;
BEGIN
  IF to_regclass('public.fund_distributions') IS NOT NULL THEN
    ALTER TABLE public.fund_distributions ALTER COLUMN created_by DROP NOT NULL;

    SELECT c.conname INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'fund_distributions'
      AND c.contype = 'f'
      AND a.attname = 'created_by';

    IF conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.fund_distributions DROP CONSTRAINT %I', conname);
    END IF;

    ALTER TABLE public.fund_distributions
      ADD CONSTRAINT fund_distributions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

    SELECT c.conname INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'fund_distributions'
      AND c.contype = 'f'
      AND a.attname = 'recipient_id';

    IF conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.fund_distributions DROP CONSTRAINT %I', conname);
    END IF;

    ALTER TABLE public.fund_distributions
      ADD CONSTRAINT fund_distributions_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.collective_join_requests') IS NOT NULL THEN
    SELECT c.conname INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'collective_join_requests'
      AND c.contype = 'f'
      AND a.attname = 'reviewed_by';

    IF conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.collective_join_requests DROP CONSTRAINT %I', conname);
      ALTER TABLE public.collective_join_requests
        ADD CONSTRAINT collective_join_requests_reviewed_by_fkey
        FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;

  IF to_regclass('public.brand_partnerships') IS NOT NULL THEN
    SELECT c.conname INTO conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'brand_partnerships'
      AND c.contype = 'f'
      AND a.attname = 'owner_user_id';

    IF conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.brand_partnerships DROP CONSTRAINT %I', conname);
      ALTER TABLE public.brand_partnerships
        ADD CONSTRAINT brand_partnerships_owner_user_id_fkey
        FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Deletes content that is not tied to auth.users by a foreign key.
-- Called only by the delete-account edge function, and only for the caller.
CREATE OR REPLACE FUNCTION public.purge_user_personal_data(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'missing user';
  END IF;

  IF to_regclass('public.post_comments') IS NOT NULL THEN
    DELETE FROM public.post_comments WHERE user_id = target;
  END IF;
  IF to_regclass('public.post_likes') IS NOT NULL THEN
    DELETE FROM public.post_likes WHERE user_id = target;
  END IF;
  IF to_regclass('public.post_reactions') IS NOT NULL THEN
    DELETE FROM public.post_reactions WHERE user_id = target;
  END IF;
  IF to_regclass('public.saved_posts') IS NOT NULL THEN
    DELETE FROM public.saved_posts WHERE user_id = target;
  END IF;
  IF to_regclass('public.posts') IS NOT NULL THEN
    DELETE FROM public.posts WHERE user_id = target;
  END IF;
  IF to_regclass('public.story_views') IS NOT NULL THEN
    DELETE FROM public.story_views WHERE viewer_id = target;
  END IF;
  IF to_regclass('public.story_reactions') IS NOT NULL THEN
    DELETE FROM public.story_reactions WHERE user_id = target;
  END IF;
  IF to_regclass('public.stories') IS NOT NULL THEN
    DELETE FROM public.stories WHERE user_id = target;
  END IF;
  IF to_regclass('public.message_read_receipts') IS NOT NULL THEN
    DELETE FROM public.message_read_receipts WHERE user_id = target;
  END IF;
  IF to_regclass('public.typing_indicators') IS NOT NULL THEN
    DELETE FROM public.typing_indicators WHERE user_id = target;
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    DELETE FROM public.messages WHERE sender_id = target;
  END IF;
  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    DELETE FROM public.conversation_participants WHERE user_id = target;
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = target;
  END IF;
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    DELETE FROM public.notification_preferences WHERE user_id = target;
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    DELETE FROM public.push_subscriptions WHERE user_id = target;
  END IF;
  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    DELETE FROM public.user_blocks
    WHERE blocker_id = target OR blocked_id = target;
  END IF;
  IF to_regclass('public.favorite_friends') IS NOT NULL THEN
    DELETE FROM public.favorite_friends
    WHERE user_id = target OR friend_user_id = target;
  END IF;
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    DELETE FROM public.content_reports WHERE reporter_id = target;
  END IF;
  IF to_regclass('public.user_credits') IS NOT NULL THEN
    DELETE FROM public.user_credits WHERE user_id = target;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_personal_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_user_personal_data(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_personal_data(uuid) TO service_role;
