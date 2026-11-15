-- Open calls nearby.
--
-- A project owner posts an open call for one of the project's roles (or a new
-- role): date, city, paid or unpaid, and a short description. It shows on the
-- project and in Explore for people whose city matches (city level only; the
-- project's venue or any address is never part of a call). Applying is the
-- existing role application (project_applications), so accepting fills the
-- role through the existing slot trigger.
-- A call stops showing when its role is full or locked, the day after its
-- date, when the owner closes it, or when the project is no longer open
-- (private, draft, completed, cancelled, held by an admin).
-- Explore lists a call only when its owner is discoverable (discovery_eligible)
-- and not blocked with the viewer either way. One open call per role.
-- Writes go through post_open_call / close_open_call; the table has no client
-- write grant.
-- Rollback: supabase/rollbacks/20261115163000_open_calls.down.sql

CREATE TABLE IF NOT EXISTS public.project_open_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city_key text NOT NULL,
  city_label text NOT NULL,
  call_date date NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT project_open_calls_status CHECK (status IN ('open', 'closed')),
  CONSTRAINT project_open_calls_city_key CHECK (city_key ~ '^[a-z0-9][^|]{0,79}(\|[a-z]{2})?$'),
  CONSTRAINT project_open_calls_city_label CHECK (char_length(btrim(city_label)) BETWEEN 1 AND 80),
  CONSTRAINT project_open_calls_description CHECK (description IS NULL OR char_length(description) BETWEEN 1 AND 280)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_open_calls_one_open_per_role ON public.project_open_calls (role_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS project_open_calls_city_idx ON public.project_open_calls (city_key, call_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS project_open_calls_project_idx ON public.project_open_calls (project_id);

ALTER TABLE public.project_open_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_open_calls FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_open_calls TO authenticated;
GRANT ALL ON public.project_open_calls TO service_role;

-- On the project: whoever may see the project, unless blocked with its owner.
DROP POLICY IF EXISTS "Open calls follow project visibility" ON public.project_open_calls;
CREATE POLICY "Open calls follow project visibility"
ON public.project_open_calls
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR (public.can_view_project(project_id, auth.uid()) AND NOT public.either_blocked(auth.uid(), created_by))
);

-- Still taking people: open, not past its date, role not full, project open and public.
CREATE OR REPLACE FUNCTION public.open_call_live(p_call uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_open_calls c
    JOIN public.project_roles r ON r.id = c.role_id
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = p_call
      AND c.status = 'open'
      AND c.call_date >= (now() AT TIME ZONE 'UTC')::date
      AND NOT r.is_locked AND r.slots_filled < r.slots_available
      AND p.status IN ('open', 'in_progress') AND NOT p.is_private
      AND p.removed_at IS NULL AND p.hidden_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.post_open_call(
  p_project uuid,
  p_role uuid,
  p_role_name text,
  p_call_date date,
  p_city_key text,
  p_city_label text,
  p_paid boolean,
  p_description text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
  proj public.projects%ROWTYPE;
  role_row public.project_roles%ROWTYPE;
  name_clean text := btrim(regexp_replace(coalesce(p_role_name, ''), '\s+', ' ', 'g'));
  desc_clean text := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');
  key_clean text := lower(btrim(coalesce(p_city_key, '')));
  label_clean text := btrim(coalesce(p_city_label, ''));
  c public.project_open_calls%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT * INTO proj FROM public.projects WHERE id = p_project;
  IF NOT FOUND OR proj.creator_id <> me THEN
    RAISE EXCEPTION 'Only the project owner can post an open call' USING ERRCODE = '42501';
  END IF;
  IF NOT public.creative_account_ok(me) THEN
    RAISE EXCEPTION 'This account is not allowed to do that' USING ERRCODE = '42501';
  END IF;
  IF proj.removed_at IS NOT NULL OR proj.hidden_at IS NOT NULL THEN RAISE EXCEPTION 'This project is on hold'; END IF;
  IF proj.status NOT IN ('open', 'in_progress') THEN RAISE EXCEPTION 'Open the project before posting a call'; END IF;
  IF proj.is_private THEN RAISE EXCEPTION 'Private projects can''t post open calls. Make it public first.'; END IF;
  IF p_call_date IS NULL OR p_call_date < today OR p_call_date > today + 365 THEN
    RAISE EXCEPTION 'Pick a date in the next 12 months';
  END IF;
  IF key_clean !~ '^[a-z0-9][^|]{0,79}(\|[a-z]{2})?$' OR char_length(label_clean) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Choose a city';
  END IF;
  IF desc_clean IS NOT NULL AND char_length(desc_clean) > 280 THEN
    RAISE EXCEPTION 'Keep the description to 280 characters';
  END IF;
  IF public.objectionable_text(concat_ws(' ', name_clean, desc_clean)) THEN
    RAISE EXCEPTION 'That text isn''t allowed.' USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(*) FROM public.project_open_calls WHERE project_id = p_project AND status = 'open') >= 10 THEN
    RAISE EXCEPTION 'A project can have 10 open calls at a time';
  END IF;

  IF p_role IS NOT NULL THEN
    SELECT * INTO role_row FROM public.project_roles WHERE id = p_role AND project_id = p_project;
    IF NOT FOUND THEN RAISE EXCEPTION 'That role isn''t on this project'; END IF;
    IF role_row.is_locked OR role_row.slots_filled >= role_row.slots_available THEN
      RAISE EXCEPTION 'That role is already filled';
    END IF;
  ELSE
    IF char_length(name_clean) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Name the role'; END IF;
    INSERT INTO public.project_roles (project_id, role_name, description, slots_available)
    VALUES (p_project, name_clean, desc_clean, 1)
    RETURNING * INTO role_row;
  END IF;

  IF EXISTS (SELECT 1 FROM public.project_open_calls WHERE role_id = role_row.id AND status = 'open') THEN
    RAISE EXCEPTION 'That role already has an open call';
  END IF;

  INSERT INTO public.project_open_calls (project_id, role_id, created_by, city_key, city_label, call_date, paid, description)
  VALUES (p_project, role_row.id, me, key_clean, label_clean, p_call_date, coalesce(p_paid, false), desc_clean)
  RETURNING * INTO c;
  RETURN jsonb_build_object('id', c.id, 'role_id', c.role_id, 'listed', public.discovery_eligible(me));
END;
$$;

CREATE OR REPLACE FUNCTION public.close_open_call(p_call uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  UPDATE public.project_open_calls SET status = 'closed', closed_at = now()
  WHERE id = p_call AND status = 'open'
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.creator_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the project owner can close this call' USING ERRCODE = '42501'; END IF;
END;
$$;

-- Explore: live open calls in a city, newest date first. Never the viewer's own.
CREATE OR REPLACE FUNCTION public.open_calls_near(p_city_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $$
DECLARE
  me uuid := auth.uid();
  key_clean text := lower(btrim(coalesce(p_city_key, '')));
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to see open calls' USING ERRCODE = '42501'; END IF;
  IF key_clean = '' THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x.call ORDER BY x.call_date, x.created_at DESC)
    FROM (
      SELECT c.call_date, c.created_at, jsonb_build_object(
        'id', c.id, 'project_id', c.project_id, 'role_id', c.role_id, 'role', r.role_name,
        'project_title', p.title, 'cover', p.cover_image_url, 'listing_type', p.listing_type,
        'city_label', c.city_label, 'call_date', c.call_date, 'paid', c.paid, 'description', c.description,
        'owner_id', p.creator_id, 'owner_name', o.display_name, 'owner_avatar', o.avatar_url,
        'applied', EXISTS (SELECT 1 FROM public.project_applications a WHERE a.role_id = c.role_id AND a.applicant_id = me AND a.status IN ('pending', 'accepted'))
      ) AS call
      FROM public.project_open_calls c
      JOIN public.project_roles r ON r.id = c.role_id
      JOIN public.projects p ON p.id = c.project_id
      JOIN public.profiles o ON o.user_id = p.creator_id
      WHERE (c.city_key = key_clean OR split_part(c.city_key, '|', 1) = key_clean OR c.city_key = split_part(key_clean, '|', 1))
        AND public.open_call_live(c.id)
        AND p.creator_id <> me
        AND public.discovery_eligible(p.creator_id)
        AND NOT public.either_blocked(me, p.creator_id)
      ORDER BY c.call_date, c.created_at DESC
      LIMIT 50
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.open_call_live(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_open_call(uuid, uuid, text, date, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_open_call(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_calls_near(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_call_live(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_open_call(uuid, uuid, text, date, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_open_call(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_calls_near(text) TO authenticated;
