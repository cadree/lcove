-- App Store 1.2: both-way blocks, live-stream reports, a text filter, and an admin remove action.
-- This file is not applied by the app. Apply it in a review environment.
-- Do not run it against the live database from a client or this repo's scripts.

CREATE OR REPLACE FUNCTION public.either_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a IS NOT NULL
    AND b IS NOT NULL
    AND a <> b
    AND (
      public.has_blocked(a, b)
      OR public.has_blocked(b, a)
    );
$$;

REVOKE ALL ON FUNCTION public.either_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.either_blocked(uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.blocked_peer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN blocker_id = auth.uid() THEN blocked_id ELSE blocker_id END
  FROM public.user_blocks
  WHERE auth.uid() IS NOT NULL
    AND (blocker_id = auth.uid() OR blocked_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.blocked_peer_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blocked_peer_ids() TO authenticated, service_role;

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
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id <> _sender
      AND public.either_blocked(cp.user_id, _sender)
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_blocked_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.either_blocked(NEW.user_id, auth.uid()) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() = NEW.user_id AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND public.either_blocked(cp.user_id, NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts"
  ON public.posts
  FOR SELECT
  USING (NOT public.either_blocked(auth.uid(), user_id));

DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Anyone can view comments"
  ON public.post_comments
  FOR SELECT
  USING (NOT public.either_blocked(auth.uid(), user_id));

-- Prod's message policy is "Users can view messages in chats they can read"
-- (can_read_conversation plus deleted_at). Drop the retired name as well so a
-- second apply cannot leave both policies in place. Permissive policies are OR'd.
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in chats they can read" ON public.messages;
CREATE POLICY "Users can view messages in chats they can read"
  ON public.messages
  FOR SELECT
  USING (
    public.can_read_conversation(conversation_id, auth.uid())
    AND deleted_at IS NULL
    AND NOT public.either_blocked(auth.uid(), sender_id)
  );

-- Keep prod's credit_user_id block. either_blocked is both directions.
DROP POLICY IF EXISTS "Anyone can view non-expired stories" ON public.stories;
CREATE POLICY "Anyone can view non-expired stories"
  ON public.stories
  FOR SELECT
  USING (
    expires_at > now()
    AND NOT public.either_blocked(auth.uid(), user_id)
    AND (
      credit_user_id IS NULL
      OR NOT public.either_blocked(auth.uid(), credit_user_id)
    )
  );

DROP POLICY IF EXISTS "Anyone can view live streams" ON public.live_streams;
CREATE POLICY "Anyone can view live streams"
  ON public.live_streams
  FOR SELECT
  USING (NOT public.either_blocked(auth.uid(), host_id));

DROP POLICY IF EXISTS "Stream chat visible unless blocked" ON public.stream_chat;
CREATE POLICY "Stream chat visible unless blocked"
  ON public.stream_chat
  FOR SELECT
  TO authenticated
  USING (NOT public.either_blocked(auth.uid(), user_id));

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
        AND public.either_blocked(s.host_id, auth.uid())
    )
  );

DO $$
BEGIN
  IF to_regclass('public.content_reports') IS NOT NULL THEN
    ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
    ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
      CHECK (target_type IN ('post', 'profile', 'message', 'comment', 'project', 'stream_message', 'stream'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.objectionable_text(input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  token text;
  banned text[] := ARRAY[
    'porn', 'porno', 'xxx', 'nude', 'nudes', 'slut', 'whore',
    'faggot', 'nigger', 'nigga', 'retard', 'kike'
  ];
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN false;
  END IF;

  normalized := lower(input);
  normalized := replace(normalized, '0', 'o');
  normalized := replace(normalized, '1', 'i');
  normalized := replace(normalized, '3', 'e');
  normalized := replace(normalized, '4', 'a');
  normalized := replace(normalized, '5', 's');
  normalized := replace(normalized, '@', 'a');
  normalized := replace(normalized, '$', 's');
  normalized := regexp_replace(normalized, '[^a-z]+', ' ', 'g');
  normalized := btrim(regexp_replace(normalized, '\s+', ' ', 'g'));

  IF normalized ~ '(^| )kill yourself( |$)' THEN
    RETURN true;
  END IF;

  FOREACH token IN ARRAY regexp_split_to_array(normalized, ' ')
  LOOP
    IF token = ANY (banned) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_objectionable_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sample text;
BEGIN
  sample := CASE TG_TABLE_NAME
    WHEN 'posts' THEN NEW.content
    WHEN 'post_comments' THEN NEW.content
    WHEN 'messages' THEN NEW.content
    WHEN 'stream_chat' THEN NEW.body
    WHEN 'profiles' THEN concat_ws(' ', NEW.display_name, NEW.bio)
    WHEN 'live_streams' THEN concat_ws(' ', NEW.title, NEW.description)
    ELSE NULL
  END;

  IF public.objectionable_text(sample) THEN
    RAISE EXCEPTION 'That text isn''t allowed.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.posts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_posts ON public.posts;
    CREATE TRIGGER reject_objectionable_posts
      BEFORE INSERT OR UPDATE OF content ON public.posts
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
  IF to_regclass('public.post_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_comments ON public.post_comments;
    CREATE TRIGGER reject_objectionable_comments
      BEFORE INSERT OR UPDATE OF content ON public.post_comments
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_messages ON public.messages;
    CREATE TRIGGER reject_objectionable_messages
      BEFORE INSERT OR UPDATE OF content ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
  IF to_regclass('public.stream_chat') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_stream_chat ON public.stream_chat;
    CREATE TRIGGER reject_objectionable_stream_chat
      BEFORE INSERT OR UPDATE OF body ON public.stream_chat
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_profiles ON public.profiles;
    CREATE TRIGGER reject_objectionable_profiles
      BEFORE INSERT OR UPDATE OF display_name, bio ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
  IF to_regclass('public.live_streams') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS reject_objectionable_streams ON public.live_streams;
    CREATE TRIGGER reject_objectionable_streams
      BEFORE INSERT OR UPDATE OF title, description ON public.live_streams
      FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.moderate_report(p_report_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report public.content_reports;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF p_action = 'dismiss' THEN
    UPDATE public.content_reports
      SET status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      WHERE id = p_report_id;
    RETURN;
  END IF;

  IF p_action <> 'remove' THEN
    RAISE EXCEPTION 'Unknown moderation action';
  END IF;

  IF report.target_type = 'post' THEN
    DELETE FROM public.posts WHERE id = report.target_id;
  ELSIF report.target_type = 'comment' THEN
    DELETE FROM public.post_comments WHERE id = report.target_id;
  ELSIF report.target_type = 'message' THEN
    UPDATE public.messages
      SET deleted_at = now(), content = NULL
      WHERE id = report.target_id;
  ELSIF report.target_type = 'stream_message' AND to_regclass('public.stream_chat') IS NOT NULL THEN
    DELETE FROM public.stream_chat WHERE id = report.target_id;
  ELSIF report.target_type = 'stream' THEN
    UPDATE public.live_streams
      SET is_live = false, ended_at = COALESCE(ended_at, now()), title = 'Removed'
      WHERE id = report.target_id;
  ELSIF report.target_type = 'profile' THEN
    UPDATE public.profiles
      SET display_name = 'Removed profile', bio = NULL, avatar_url = NULL
      WHERE user_id = report.target_id;
  ELSIF report.target_type = 'project' THEN
    UPDATE public.projects
      SET description = NULL
      WHERE id = report.target_id;
  END IF;

  UPDATE public.content_reports
    SET status = 'actioned', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_report(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_report(uuid, text) TO authenticated, service_role;
