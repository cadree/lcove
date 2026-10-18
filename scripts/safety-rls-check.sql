-- Scratch-database check for the reporting and block policies.
-- Run with scripts/safety-rls-check.sh. Does not touch a hosted database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  created_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  UNIQUE (conversation_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorite_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_user_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their blocks" ON public.user_blocks;
CREATE POLICY "Users can view their blocks" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "Users can block others" ON public.user_blocks;
CREATE POLICY "Users can block others" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    public.is_conversation_participant(conversation_id, auth.uid())
    AND deleted_at IS NULL
  );
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Anyone can view comments" ON public.post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add favorites" ON public.favorite_friends;
CREATE POLICY "Users can add favorites" ON public.favorite_friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorite_friends;
CREATE POLICY "Users can view own favorites" ON public.favorite_friends
  FOR SELECT USING (auth.uid() = user_id);

\ir ../supabase/migrations/20261018153000_reports_blocks_and_account_deletion.sql

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO anon, authenticated, service_role;

CREATE POLICY "scratch participant insert"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "scratch participant select"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'c@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'admin@example.com');

INSERT INTO public.user_roles (user_id, role)
VALUES ('44444444-4444-4444-4444-444444444444', 'admin');

INSERT INTO public.posts (id, user_id, content) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '22222222-2222-2222-2222-222222222222', 'from B'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '33333333-3333-3333-3333-333333333333', 'from C');

INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'comment from B');

INSERT INTO public.conversations (id, type, created_by)
VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'direct', '11111111-1111-1111-1111-111111111111');

INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '22222222-2222-2222-2222-222222222222');

INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '22222222-2222-2222-2222-222222222222', 'hello from B'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'hello from A');

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
INSERT INTO public.content_reports (target_type, target_id, reason, details, status, reporter_id)
VALUES (
  'post',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'AI-generated or fake content',
  'looks synthetic',
  'actioned',
  '22222222-2222-2222-2222-222222222222'
);

DO $$
DECLARE
  n int;
  reporter uuid;
  status text;
BEGIN
  SELECT count(*), min(reporter_id::text)::uuid, min(content_reports.status)
  INTO n, reporter, status
  FROM public.content_reports;

  IF n <> 1 THEN
    RAISE EXCEPTION 'expected 1 report, saw %', n;
  END IF;
  IF reporter <> '11111111-1111-1111-1111-111111111111' THEN
    RAISE EXCEPTION 'insert trigger did not keep the caller as reporter';
  END IF;
  IF status <> 'open' THEN
    RAISE EXCEPTION 'insert trigger did not force status open, saw %', status;
  END IF;
END $$;

SET ROLE authenticated;

DO $$
DECLARE
  n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 1 THEN
    RAISE EXCEPTION 'reporter should read own report, saw %', n;
  END IF;

  SELECT count(*) INTO n FROM public.posts WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN
    RAISE EXCEPTION 'blocker still sees blocked user posts';
  END IF;

  SELECT count(*) INTO n FROM public.posts WHERE user_id = '33333333-3333-3333-3333-333333333333';
  IF n <> 1 THEN
    RAISE EXCEPTION 'blocker should still see other posts';
  END IF;

  SELECT count(*) INTO n FROM public.post_comments WHERE user_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN
    RAISE EXCEPTION 'blocker still sees blocked user comments';
  END IF;

  SELECT count(*) INTO n FROM public.messages WHERE sender_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN
    RAISE EXCEPTION 'blocker still sees blocked user messages';
  END IF;

  SELECT count(*) INTO n FROM public.messages WHERE sender_id = '11111111-1111-1111-1111-111111111111';
  IF n <> 1 THEN
    RAISE EXCEPTION 'blocker should still see their own messages';
  END IF;

  UPDATE public.content_reports SET status = 'actioned';
  SELECT count(*) INTO n FROM public.content_reports WHERE status = 'open';
  IF n <> 1 THEN
    RAISE EXCEPTION 'reporter was able to change report status';
  END IF;

  DELETE FROM public.content_reports;
  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 1 THEN
    RAISE EXCEPTION 'reporter was able to delete a report';
  END IF;
END $$;

DO $$
DECLARE
  n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 0 THEN
    RAISE EXCEPTION 'other user can read a report they did not file';
  END IF;

  SELECT count(*) INTO n FROM public.posts;
  IF n <> 2 THEN
    RAISE EXCEPTION 'blocked user should still see posts, saw %', n;
  END IF;

  SELECT count(*) INTO n FROM public.messages;
  IF n <> 2 THEN
    RAISE EXCEPTION 'blocked user should still see the thread, saw %', n;
  END IF;

  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '22222222-2222-2222-2222-222222222222', 'nope');
    RAISE EXCEPTION 'blocked user was able to message the blocker';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%cannot message this person%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    INSERT INTO public.favorite_friends (user_id, friend_user_id)
    VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'blocked user was able to follow the blocker';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%cannot follow%' THEN
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;
INSERT INTO public.conversations (id, type, created_by)
VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'direct', '22222222-2222-2222-2222-222222222222');

SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '22222222-2222-2222-2222-222222222222');

  BEGIN
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc2', '11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'blocked user was able to start a chat with the blocker';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%cannot message this person%' THEN
        RAISE;
      END IF;
  END;
END $$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111111', 'still allowed');
  INSERT INTO public.favorite_friends (user_id, friend_user_id)
  VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
END $$;

DO $$
DECLARE
  n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 0 THEN
    RAISE EXCEPTION 'unrelated user can read reports';
  END IF;
  SELECT count(*) INTO n FROM public.posts;
  IF n <> 2 THEN
    RAISE EXCEPTION 'unrelated user should see both posts, saw %', n;
  END IF;
END $$;

DO $$
DECLARE
  n int;
  new_status text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 1 THEN
    RAISE EXCEPTION 'admin should read reports, saw %', n;
  END IF;
  UPDATE public.content_reports SET status = 'actioned', reviewed_by = auth.uid(), reviewed_at = now();
  SELECT status INTO new_status FROM public.content_reports;
  IF new_status <> 'actioned' THEN
    RAISE EXCEPTION 'admin could not mark the report actioned';
  END IF;
END $$;

RESET ROLE;
SET ROLE anon;
DO $$
DECLARE
  n int;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SELECT count(*) INTO n FROM public.content_reports;
  IF n <> 0 THEN
    RAISE EXCEPTION 'anon can read reports';
  END IF;
  SELECT count(*) INTO n FROM public.posts;
  IF n <> 2 THEN
    RAISE EXCEPTION 'anon should still see posts, saw %', n;
  END IF;
  BEGIN
    PERFORM public.purge_user_personal_data('11111111-1111-1111-1111-111111111111');
    RAISE EXCEPTION 'anon was able to purge an account';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%permission denied%' THEN
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  BEGIN
    PERFORM public.purge_user_personal_data('22222222-2222-2222-2222-222222222222');
    RAISE EXCEPTION 'authenticated user was able to purge an account';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%permission denied%' THEN
        RAISE;
      END IF;
  END;
END $$;

RESET ROLE;
SELECT 'safety rls checks passed' AS result;
