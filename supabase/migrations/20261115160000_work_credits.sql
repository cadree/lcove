-- Credits on finished work.
--
-- When a project is marked completed, everyone accepted onto it is credited
-- with the role they were accepted for (several roles are joined with " · ").
-- The owner gets an accepted "Project lead" credit. A post's author can credit
-- people on a published post with a short role ("Stylist", "Shot on film").
--
-- Consent: a credit starts pending and shows on the credited person's profile
-- only after they accept it. They can hide it again at any time (and show it
-- again later). Hidden credits disappear for everyone but them.
-- The credited person gets an in-app notice for each new credit.
--
-- Never: crediting yourself, a blocked pair (either way), a banned, suspended
-- or deleted account, more than 20 people on one post, more than 40 post
-- credits an hour. Project credits come only from accepted roles.
-- Writes go through the SECURITY DEFINER RPCs and the project trigger below;
-- the table has no client write grant.
-- Rollback: supabase/rollbacks/20261115160000_work_credits.down.sql

CREATE OR REPLACE FUNCTION public.creative_account_ok(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT u IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = u
      AND p.deleted_at IS NULL
      AND p.access_status IS DISTINCT FROM 'banned'
      AND NOT coalesce(p.is_suspended, false)
  );
$$;

-- The owner or anyone accepted onto one of its roles.
CREATE OR REPLACE FUNCTION public.is_project_member(p_project uuid, p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT p_user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project AND p.creator_id = p_user)
    OR EXISTS (
      SELECT 1 FROM public.project_applications a
      WHERE a.project_id = p_project AND a.applicant_id = p_user AND a.status = 'accepted'
    )
  );
$$;

CREATE TABLE IF NOT EXISTS public.work_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT work_credits_one_source CHECK (num_nonnulls(project_id, post_id) = 1),
  CONSTRAINT work_credits_role_length CHECK (char_length(btrim(role)) BETWEEN 1 AND 60),
  CONSTRAINT work_credits_status CHECK (status IN ('pending', 'accepted', 'hidden'))
);

CREATE UNIQUE INDEX IF NOT EXISTS work_credits_one_per_project ON public.work_credits (user_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS work_credits_one_per_post ON public.work_credits (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_credits_user_idx ON public.work_credits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS work_credits_project_idx ON public.work_credits (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_credits_post_idx ON public.work_credits (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_credits_credited_by_idx ON public.work_credits (credited_by, created_at DESC);

ALTER TABLE public.work_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.work_credits TO authenticated;
GRANT ALL ON public.work_credits TO service_role;

-- A credit's project or post is still up, and the viewer may see it.
CREATE OR REPLACE FUNCTION public.credit_source_visible(p_project uuid, p_post uuid, p_viewer uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_project IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = p_project AND p.removed_at IS NULL AND p.hidden_at IS NULL
        AND public.can_view_project(p.id, p_viewer)
        AND NOT public.either_blocked(p_viewer, p.creator_id))
    WHEN p_post IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = p_post AND p.removed_at IS NULL AND p.hidden_at IS NULL
        AND NOT public.either_blocked(p_viewer, p.user_id))
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "Credits: the credited person, the creditor, and accepted ones for members" ON public.work_credits;
CREATE POLICY "Credits: the credited person, the creditor, and accepted ones for members"
ON public.work_credits
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (credited_by = auth.uid() AND status <> 'hidden')
  OR (
    status = 'accepted'
    AND NOT public.either_blocked(auth.uid(), user_id)
    AND public.creative_account_ok(user_id)
    AND public.credit_source_visible(project_id, post_id, auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.notify_work_credit(p_credit uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  c public.work_credits%ROWTYPE;
  who text;
  what text;
BEGIN
  SELECT * INTO c FROM public.work_credits WHERE id = p_credit;
  IF NOT FOUND OR c.status <> 'pending' THEN RETURN; END IF;
  SELECT coalesce(nullif(btrim(display_name), ''), 'Someone') INTO who FROM public.profiles WHERE user_id = c.credited_by;
  IF c.project_id IS NOT NULL THEN
    SELECT title INTO what FROM public.projects WHERE id = c.project_id;
  ELSE
    what := 'their post';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    c.user_id,
    'credit',
    'You were credited',
    format('%s credited you as %s on %s. Accept it to show it on your profile.', coalesce(who, 'Someone'), c.role, coalesce(what, 'a project')),
    jsonb_build_object('credit_id', c.id, 'path', '/profile?section=credits')
  );
END;
$$;

-- Completing a project credits its team. Re-completing a reopened project
-- credits anyone accepted since; existing credits are left as they are.
CREATE OR REPLACE FUNCTION public.credit_completed_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  m record;
  new_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;

  IF public.creative_account_ok(NEW.creator_id) THEN
    INSERT INTO public.work_credits (user_id, credited_by, project_id, role, status, responded_at)
    VALUES (NEW.creator_id, NEW.creator_id, NEW.id, 'Project lead', 'accepted', now())
    ON CONFLICT (user_id, project_id) WHERE project_id IS NOT NULL DO NOTHING;
  END IF;

  FOR m IN
    SELECT a.applicant_id,
           left(string_agg(DISTINCT coalesce(nullif(btrim(r.role_name), ''), 'Collaborator'), ' · '), 60) AS role
    FROM public.project_applications a
    LEFT JOIN public.project_roles r ON r.id = a.role_id
    WHERE a.project_id = NEW.id
      AND a.status = 'accepted'
      AND a.applicant_id IS DISTINCT FROM NEW.creator_id
      AND public.creative_account_ok(a.applicant_id)
      AND NOT public.either_blocked(NEW.creator_id, a.applicant_id)
    GROUP BY a.applicant_id
  LOOP
    new_id := NULL;
    INSERT INTO public.work_credits (user_id, credited_by, project_id, role)
    VALUES (m.applicant_id, NEW.creator_id, NEW.id, m.role)
    ON CONFLICT (user_id, project_id) WHERE project_id IS NOT NULL DO NOTHING
    RETURNING id INTO new_id;
    IF new_id IS NOT NULL THEN
      PERFORM public.notify_work_credit(new_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_completed_project ON public.projects;
CREATE TRIGGER credit_completed_project
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.credit_completed_project();

-- The author of a post credits someone on it. Crediting the same person again
-- while the credit is pending changes the role.
CREATE OR REPLACE FUNCTION public.credit_post(p_post uuid, p_user uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  post public.posts%ROWTYPE;
  clean text := btrim(regexp_replace(coalesce(p_role, ''), '\s+', ' ', 'g'));
  c public.work_credits%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO post FROM public.posts WHERE id = p_post;
  IF NOT FOUND OR post.user_id IS DISTINCT FROM me THEN
    RAISE EXCEPTION 'You can only credit people on your own posts' USING ERRCODE = '42501';
  END IF;
  IF post.removed_at IS NOT NULL OR post.hidden_at IS NOT NULL THEN
    RAISE EXCEPTION 'This post is on hold';
  END IF;
  IF NOT public.creative_account_ok(me) THEN
    RAISE EXCEPTION 'This account is not allowed to do that' USING ERRCODE = '42501';
  END IF;
  IF p_user IS NULL OR p_user = me THEN RAISE EXCEPTION 'Pick someone else to credit'; END IF;
  IF char_length(clean) < 1 OR char_length(clean) > 60 THEN
    RAISE EXCEPTION 'Add their role in 60 characters or fewer';
  END IF;
  IF public.objectionable_text(clean) THEN
    RAISE EXCEPTION 'That text isn''t allowed.' USING ERRCODE = '23514';
  END IF;
  IF NOT public.creative_account_ok(p_user) OR public.either_blocked(me, p_user) THEN
    RAISE EXCEPTION 'You can''t credit this person' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.work_credits WHERE post_id = p_post AND user_id = p_user;
  IF FOUND THEN
    IF c.status = 'pending' THEN
      UPDATE public.work_credits SET role = clean WHERE id = c.id RETURNING * INTO c;
    END IF;
    RETURN jsonb_build_object('id', c.id, 'status', c.status, 'role', c.role, 'created', false);
  END IF;

  IF (SELECT count(*) FROM public.work_credits WHERE post_id = p_post) >= 20 THEN
    RAISE EXCEPTION 'A post can credit up to 20 people';
  END IF;
  IF (SELECT count(*) FROM public.work_credits WHERE credited_by = me AND post_id IS NOT NULL AND created_at > now() - interval '1 hour') >= 40 THEN
    RAISE EXCEPTION 'That''s a lot of credits for one hour. Try again later.';
  END IF;

  INSERT INTO public.work_credits (user_id, credited_by, post_id, role)
  VALUES (p_user, me, p_post, clean)
  ON CONFLICT (user_id, post_id) WHERE post_id IS NOT NULL DO NOTHING
  RETURNING * INTO c;
  IF c.id IS NULL THEN
    SELECT * INTO c FROM public.work_credits WHERE post_id = p_post AND user_id = p_user;
    RETURN jsonb_build_object('id', c.id, 'status', c.status, 'role', c.role, 'created', false);
  END IF;
  PERFORM public.notify_work_credit(c.id);
  RETURN jsonb_build_object('id', c.id, 'status', c.status, 'role', c.role, 'created', true);
END;
$$;

-- The post's author takes a credit off their post.
CREATE OR REPLACE FUNCTION public.remove_post_credit(p_credit uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.work_credits
  WHERE id = p_credit AND post_id IS NOT NULL AND credited_by = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the post''s author can remove this credit' USING ERRCODE = '42501'; END IF;
END;
$$;

-- The credited person shows (accepts) or hides a credit.
CREATE OR REPLACE FUNCTION public.respond_work_credit(p_credit uuid, p_show boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  new_status text := CASE WHEN p_show THEN 'accepted' ELSE 'hidden' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF p_show IS NULL THEN RAISE EXCEPTION 'Choose show or hide'; END IF;
  UPDATE public.work_credits
  SET status = new_status, responded_at = now()
  WHERE id = p_credit AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit not found'; END IF;
  -- The credit notice has done its job once answered.
  UPDATE public.notifications SET read_at = coalesce(read_at, now())
  WHERE user_id = auth.uid() AND type = 'credit' AND data->>'credit_id' = p_credit::text;
  RETURN new_status;
END;
$$;

-- A profile's credits as the viewer may see them (RLS decides which rows).
CREATE OR REPLACE FUNCTION public.profile_credits(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.sort_at DESC), '[]'::jsonb)
  FROM (
    SELECT c.id, c.role, c.status, c.created_at,
      CASE WHEN c.project_id IS NOT NULL THEN 'project' ELSE 'post' END AS source,
      c.project_id, c.post_id,
      coalesce(pr.title, nullif(left(btrim(po.content), 80), ''), 'Post') AS title,
      coalesce(pr.cover_image_url, po.thumbnail_url, CASE WHEN po.media_type = 'photo' THEN po.media_url END) AS cover,
      coalesce(pr.timeline_end::timestamptz, pr.updated_at, po.created_at, c.created_at) AS sort_at,
      c.credited_by,
      cb.display_name AS credited_by_name
    FROM public.work_credits c
    LEFT JOIN public.projects pr ON pr.id = c.project_id
    LEFT JOIN public.posts po ON po.id = c.post_id
    LEFT JOIN public.profiles_public cb ON cb.user_id = c.credited_by
    WHERE c.user_id = p_user
      AND (pr.id IS NOT NULL OR po.id IS NOT NULL)
    LIMIT 200
  ) x;
$$;

-- Who is credited on a post (RLS decides which rows).
CREATE OR REPLACE FUNCTION public.post_credits(p_post uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'user_id', c.user_id, 'role', c.role, 'status', c.status,
    'name', p.display_name, 'avatar_url', p.avatar_url) ORDER BY c.created_at), '[]'::jsonb)
  FROM public.work_credits c
  LEFT JOIN public.profiles_public p ON p.user_id = c.user_id
  WHERE c.post_id = p_post;
$$;

REVOKE ALL ON FUNCTION public.creative_account_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.credit_source_visible(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_work_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_completed_project() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_post(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_post_credit(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_work_credit(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_credits(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_credits(uuid) FROM PUBLIC, anon;
-- creative_account_ok runs inside the RLS policy, which evaluates as the viewer.
GRANT EXECUTE ON FUNCTION public.creative_account_ok(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_source_visible(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_post(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_post_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_work_credit(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_credits(uuid) TO authenticated;
