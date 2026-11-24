-- In-app sharing, story credits, reposts, and owner-only post views.
-- Additive. Apply to ether-prod before deploying the client that writes these columns.
--
-- post_views is not readable by anon or authenticated.
-- RLS is on and there is no policy, so a later SELECT grant still returns no rows.
-- The table owner bypasses RLS. API roles are not the owner.
-- Counts leave the database only through get_own_post_view_counts and
-- get_own_view_dashboard, which keep rows where posts.user_id = auth.uid().
-- record_post_view writes at most one row per viewer per post per UTC day
-- and does not write when the viewer owns the post.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS shared_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_profile_id uuid;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS source_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_messages_shared_post
  ON public.messages (shared_post_id)
  WHERE shared_post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_reposts_user_created
  ON public.reposts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reposts_post
  ON public.reposts (post_id);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.reposts FROM PUBLIC;
GRANT SELECT ON TABLE public.reposts TO anon, authenticated, service_role;
GRANT INSERT, DELETE ON TABLE public.reposts TO authenticated, service_role;

DROP POLICY IF EXISTS "Visible reposts" ON public.reposts;
CREATE POLICY "Visible reposts"
  ON public.reposts
  FOR SELECT
  USING (
    NOT public.has_blocked(auth.uid(), user_id)
    AND NOT public.has_blocked(user_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_id
        AND NOT public.has_blocked(auth.uid(), p.user_id)
        AND NOT public.has_blocked(p.user_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users repost as themselves" ON public.reposts;
CREATE POLICY "Users repost as themselves"
  ON public.reposts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users undo their reposts" ON public.reposts;
CREATE POLICY "Users undo their reposts"
  ON public.reposts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, viewer_id, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_post_views_day
  ON public.post_views (viewed_on);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.post_views FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.post_views TO service_role;

-- No SELECT, INSERT, UPDATE, or DELETE policy.
-- authenticated and anon have no table privilege.

CREATE OR REPLACE FUNCTION public.record_post_view(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT user_id INTO v_owner
  FROM public.posts
  WHERE id = p_post_id;

  IF v_owner IS NULL OR v_owner = v_uid THEN
    RETURN;
  END IF;

  IF public.has_blocked(v_uid, v_owner) OR public.has_blocked(v_owner, v_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.post_views (post_id, viewer_id, viewed_on)
  VALUES (p_post_id, v_uid, (timezone('utc', now()))::date)
  ON CONFLICT (post_id, viewer_id, viewed_on) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_own_post_view_counts(p_post_ids uuid[] DEFAULT NULL)
RETURNS TABLE (post_id uuid, view_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, count(v.post_id)::bigint
  FROM public.posts p
  LEFT JOIN public.post_views v ON v.post_id = p.id
  WHERE p.user_id = auth.uid()
    AND (p_post_ids IS NULL OR p.id = ANY (p_post_ids))
  GROUP BY p.id;
$$;

CREATE OR REPLACE FUNCTION public.get_own_view_dashboard()
RETURNS TABLE (views_30d bigint, photo_views_30d bigint, video_views_30d bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(v.post_id)::bigint,
    count(v.post_id) FILTER (WHERE p.media_type = 'photo')::bigint,
    count(v.post_id) FILTER (WHERE p.media_type = 'video')::bigint
  FROM public.posts p
  LEFT JOIN public.post_views v
    ON v.post_id = p.id
   AND v.viewed_on >= (timezone('utc', now()))::date - 29
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.record_post_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_own_post_view_counts(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_own_view_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_post_view(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_own_post_view_counts(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_own_view_dashboard() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_blocked_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other uuid;
BEGIN
  IF NEW.shared_post_id IS NULL
     AND NEW.shared_story_id IS NULL
     AND NEW.shared_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND (
        public.has_blocked(NEW.sender_id, cp.user_id)
        OR public.has_blocked(cp.user_id, NEW.sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.shared_post_id IS NOT NULL THEN
    SELECT user_id INTO v_other FROM public.posts WHERE id = NEW.shared_post_id;
  ELSIF NEW.shared_story_id IS NOT NULL THEN
    SELECT COALESCE(credit_user_id, user_id) INTO v_other FROM public.stories WHERE id = NEW.shared_story_id;
  ELSIF NEW.shared_profile_id IS NOT NULL THEN
    v_other := NEW.shared_profile_id;
  END IF;

  IF v_other IS NOT NULL AND (
    public.has_blocked(NEW.sender_id, v_other)
    OR public.has_blocked(v_other, NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'You cannot share this'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_blocked_share ON public.messages;
CREATE TRIGGER prevent_blocked_share
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_share();

REVOKE ALL ON FUNCTION public.prevent_blocked_share() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_blocked_share() TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_media text;
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'You cannot repost as someone else'
      USING ERRCODE = '42501';
  END IF;

  SELECT user_id, media_type INTO v_owner, v_media
  FROM public.posts
  WHERE id = NEW.post_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Post not found'
      USING ERRCODE = '42501';
  END IF;

  IF v_owner = NEW.user_id THEN
    RAISE EXCEPTION 'You cannot repost your own post'
      USING ERRCODE = '42501';
  END IF;

  IF v_media IS DISTINCT FROM 'photo' AND v_media IS DISTINCT FROM 'video' THEN
    RAISE EXCEPTION 'Only photos and videos can be reposted'
      USING ERRCODE = '42501';
  END IF;

  IF public.has_blocked(NEW.user_id, v_owner) OR public.has_blocked(v_owner, NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot repost this'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_repost ON public.reposts;
CREATE TRIGGER enforce_repost
  BEFORE INSERT ON public.reposts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_repost();

REVOKE ALL ON FUNCTION public.enforce_repost() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_repost() TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_story_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_media text;
  v_url text;
BEGIN
  -- A story with no source cannot claim credit. Deleting the original post
  -- nulls source_post_id and leaves the credit that was already stored.
  IF NEW.source_post_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.credit_user_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT user_id, media_type, media_url INTO v_owner, v_media, v_url
  FROM public.posts
  WHERE id = NEW.source_post_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Post not found'
      USING ERRCODE = '42501';
  END IF;

  IF v_media IS DISTINCT FROM 'photo' AND v_media IS DISTINCT FROM 'video' THEN
    RAISE EXCEPTION 'Only photos and videos can be added to a story'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.media_url IS DISTINCT FROM v_url OR NEW.media_type IS DISTINCT FROM v_media THEN
    RAISE EXCEPTION 'Story media must match the original post'
      USING ERRCODE = '42501';
  END IF;

  IF public.has_blocked(NEW.user_id, v_owner) OR public.has_blocked(v_owner, NEW.user_id) THEN
    RAISE EXCEPTION 'You cannot share this'
      USING ERRCODE = '42501';
  END IF;

  IF v_owner = NEW.user_id THEN
    NEW.credit_user_id := NULL;
  ELSE
    NEW.credit_user_id := v_owner;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_story_credit ON public.stories;
CREATE TRIGGER enforce_story_credit
  BEFORE INSERT OR UPDATE OF source_post_id, media_url, media_type, credit_user_id
  ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_story_credit();

REVOKE ALL ON FUNCTION public.enforce_story_credit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_story_credit() TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_blocked_story_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.stories WHERE id = NEW.story_id;
  IF v_owner IS NOT NULL AND (
    public.has_blocked(NEW.user_id, v_owner)
    OR public.has_blocked(v_owner, NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_blocked_story_reaction ON public.story_reactions;
CREATE TRIGGER prevent_blocked_story_reaction
  BEFORE INSERT OR UPDATE ON public.story_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_blocked_story_reaction();

REVOKE ALL ON FUNCTION public.prevent_blocked_story_reaction() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_blocked_story_reaction() TO service_role;

DROP POLICY IF EXISTS "Users can update own story reactions" ON public.story_reactions;
CREATE POLICY "Users can update own story reactions"
  ON public.story_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view non-expired stories" ON public.stories;
CREATE POLICY "Anyone can view non-expired stories"
  ON public.stories
  FOR SELECT
  USING (
    expires_at > now()
    AND NOT public.has_blocked(auth.uid(), user_id)
    AND NOT public.has_blocked(user_id, auth.uid())
    AND (
      credit_user_id IS NULL
      OR (
        NOT public.has_blocked(auth.uid(), credit_user_id)
        AND NOT public.has_blocked(credit_user_id, auth.uid())
      )
    )
  );
