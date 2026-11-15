-- Project wrap-up vouches.
--
-- When a project is marked completed, its members (the owner and everyone
-- accepted onto a role) can vouch for each other: "showed up and delivered",
-- with an optional note of up to 280 characters. One vouch per pair per
-- project, only between actual members, never yourself, never across a block.
-- The person vouched for gets an in-app notice. Vouch counts and notes show on
-- their profile.
-- Abuse: a vouch can be reported through the existing report flow
-- (content_reports target_type 'vouch'); an admin can hide or remove it from
-- the moderation console. The author can delete their own vouch.
-- Writes go through vouch_for (insert) and the author's DELETE policy.
-- Rollback: supabase/rollbacks/20261115162000_project_vouches.down.sql

CREATE TABLE IF NOT EXISTS public.project_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  CONSTRAINT project_vouches_not_self CHECK (author_id <> subject_id),
  CONSTRAINT project_vouches_note_length CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 280),
  CONSTRAINT project_vouches_one_per_pair UNIQUE (project_id, author_id, subject_id)
);

CREATE INDEX IF NOT EXISTS project_vouches_subject_idx ON public.project_vouches (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_vouches_author_idx ON public.project_vouches (author_id);

ALTER TABLE public.project_vouches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_vouches FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.project_vouches TO authenticated;
GRANT ALL ON public.project_vouches TO service_role;

DROP POLICY IF EXISTS "Vouches: the two people, and visible ones for members" ON public.project_vouches;
CREATE POLICY "Vouches: the two people, and visible ones for members"
ON public.project_vouches
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR (
    hidden_at IS NULL
    AND (subject_id = auth.uid() OR (
      NOT public.either_blocked(auth.uid(), subject_id)
      AND public.creative_account_ok(subject_id)
    ))
    AND NOT public.either_blocked(auth.uid(), author_id)
    AND public.creative_account_ok(author_id)
  )
);

DROP POLICY IF EXISTS "Authors delete their vouches" ON public.project_vouches;
CREATE POLICY "Authors delete their vouches"
ON public.project_vouches
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.vouch_for(p_project uuid, p_subject uuid, p_note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  proj public.projects%ROWTYPE;
  clean text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v public.project_vouches%ROWTYPE;
  who text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO proj FROM public.projects WHERE id = p_project;
  IF NOT FOUND OR proj.removed_at IS NOT NULL OR proj.hidden_at IS NOT NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF proj.status <> 'completed' THEN
    RAISE EXCEPTION 'Vouches open once the project is marked complete';
  END IF;
  IF NOT public.is_project_member(p_project, me) THEN
    RAISE EXCEPTION 'Only people who worked on this project can vouch' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject = me THEN RAISE EXCEPTION 'Pick a teammate to vouch for'; END IF;
  IF NOT public.is_project_member(p_project, p_subject) THEN
    RAISE EXCEPTION 'They didn''t work on this project' USING ERRCODE = '42501';
  END IF;
  IF NOT public.creative_account_ok(me) THEN
    RAISE EXCEPTION 'This account is not allowed to do that' USING ERRCODE = '42501';
  END IF;
  IF NOT public.creative_account_ok(p_subject) OR public.either_blocked(me, p_subject) THEN
    RAISE EXCEPTION 'You can''t vouch for this person' USING ERRCODE = '42501';
  END IF;
  IF clean IS NOT NULL AND char_length(clean) > 280 THEN
    RAISE EXCEPTION 'Keep the note to 280 characters';
  END IF;
  IF public.objectionable_text(clean) THEN
    RAISE EXCEPTION 'That text isn''t allowed.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.project_vouches (project_id, author_id, subject_id, note)
  VALUES (p_project, me, p_subject, clean)
  ON CONFLICT ON CONSTRAINT project_vouches_one_per_pair DO NOTHING
  RETURNING * INTO v;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'You already vouched for them on this project';
  END IF;

  SELECT coalesce(nullif(btrim(display_name), ''), 'A teammate') INTO who FROM public.profiles WHERE user_id = me;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_subject,
    'vouch',
    'New vouch',
    format('%s vouched for you on %s: showed up and delivered.', coalesce(who, 'A teammate'), proj.title),
    jsonb_build_object('vouch_id', v.id, 'project_id', p_project, 'path', '/profile?section=vouches')
  );
  RETURN jsonb_build_object('id', v.id, 'note', v.note, 'created_at', v.created_at);
END;
$$;

-- A completed project's team, for the wrap-up. Members only.
CREATE OR REPLACE FUNCTION public.project_wrap_up(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  proj public.projects%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO proj FROM public.projects WHERE id = p_project;
  IF NOT FOUND OR NOT public.is_project_member(p_project, me) THEN
    RETURN jsonb_build_object('member', false, 'completed', coalesce(proj.status = 'completed', false), 'team', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'member', true,
    'completed', proj.status = 'completed',
    'team', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', t.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'role', t.role,
        'vouched', EXISTS (SELECT 1 FROM public.project_vouches v WHERE v.project_id = p_project AND v.author_id = me AND v.subject_id = t.user_id),
        'vouch_id', (SELECT v.id FROM public.project_vouches v WHERE v.project_id = p_project AND v.author_id = me AND v.subject_id = t.user_id)
      ) ORDER BY t.lead DESC, p.display_name)
      FROM (
        SELECT proj.creator_id AS user_id, 'Project lead'::text AS role, true AS lead
        UNION ALL
        SELECT a.applicant_id, string_agg(DISTINCT coalesce(nullif(btrim(r.role_name), ''), 'Collaborator'), ' · '), false
        FROM public.project_applications a
        LEFT JOIN public.project_roles r ON r.id = a.role_id
        WHERE a.project_id = p_project AND a.status = 'accepted' AND a.applicant_id IS DISTINCT FROM proj.creator_id
        GROUP BY a.applicant_id
      ) t
      JOIN public.profiles p ON p.user_id = t.user_id
      WHERE t.user_id <> me
        AND public.creative_account_ok(t.user_id)
        AND NOT public.either_blocked(me, t.user_id)
    ), '[]'::jsonb)
  );
END;
$$;

-- A profile's vouches as the viewer may see them (RLS decides which rows).
-- The project title shows only when the viewer may see the project.
CREATE OR REPLACE FUNCTION public.profile_vouches(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'note', v.note, 'created_at', v.created_at, 'hidden', v.hidden_at IS NOT NULL,
      'author_id', v.author_id, 'author_name', a.display_name, 'author_avatar', a.avatar_url,
      'project_id', pr.id, 'project_title', pr.title
    ) ORDER BY v.created_at DESC), '[]'::jsonb)
  )
  FROM public.project_vouches v
  LEFT JOIN public.profiles_public a ON a.user_id = v.author_id
  LEFT JOIN public.projects pr ON pr.id = v.project_id
  WHERE v.subject_id = p_user AND v.hidden_at IS NULL;
$$;

-- Reports: vouches join the existing report flow.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type = ANY (ARRAY['post'::text, 'profile'::text, 'message'::text, 'comment'::text, 'project'::text, 'stream_message'::text, 'stream'::text, 'event'::text, 'vouch'::text]));

-- prod's admin_apply_report_target with one new branch for 'vouch'
-- (hide sets hidden_at; remove and hard delete delete the vouch).
CREATE OR REPLACE FUNCTION public.admin_apply_report_target(p_target_type text, p_target_id uuid, p_action text, p_reason text, p_confirm text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ELSIF p_target_type = 'vouch' AND to_regclass('public.project_vouches') IS NOT NULL THEN
    SELECT author_id INTO owner_id FROM public.project_vouches WHERE id = p_target_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Content not found';
    END IF;
    IF p_action = 'hide' THEN
      UPDATE public.project_vouches SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_target_id;
    ELSIF p_action = 'unhide' OR p_action = 'restore' THEN
      UPDATE public.project_vouches SET hidden_at = NULL WHERE id = p_target_id;
    ELSIF p_action IN ('remove', 'hard_delete') THEN
      DELETE FROM public.project_vouches WHERE id = p_target_id;
    END IF;
    RETURN owner_id;
  ELSE
    RAISE EXCEPTION 'This report target cannot be moderated that way';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.vouch_for(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.project_wrap_up(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.profile_vouches(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vouch_for(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_wrap_up(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_vouches(uuid) TO authenticated;
