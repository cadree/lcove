-- Member Of on the Ether ID. Free text, trimmed, at most 24 characters.
-- Blank becomes null. The card shows LCOVE when this is empty.
-- This file is not applied by the app. Apply it by hand with the other migrations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_of text;

COMMENT ON COLUMN public.profiles.member_of IS
  'Community or personal brand printed on the Ether ID. Trimmed, at most 24 characters. Empty prints as LCOVE.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_member_of_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_member_of_length
  CHECK (member_of IS NULL OR char_length(member_of) <= 24);

CREATE OR REPLACE FUNCTION public.ether_id_normalize_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.member_of IS NOT NULL THEN
    NEW.member_of := btrim(NEW.member_of);
    IF NEW.member_of = '' THEN
      NEW.member_of := NULL;
    ELSIF char_length(NEW.member_of) > 24 THEN
      RAISE EXCEPTION 'member of is 24 characters or fewer'
        USING ERRCODE = '23514';
    ELSIF public.objectionable_text(NEW.member_of) THEN
      RAISE EXCEPTION 'That member of isn''t allowed.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(regexp_replace(btrim(NEW.username), '^@+', ''));
    IF NEW.username = '' THEN
      NEW.username := NULL;
    ELSIF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'username must be 3 to 20 letters, numbers, or underscores'
        USING ERRCODE = '23514';
    ELSIF public.objectionable_text(NEW.username) THEN
      RAISE EXCEPTION 'That username isn''t allowed.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.birthday_month IS NULL AND NEW.birthday_day IS NULL THEN
    NEW.show_birthday := false;
  ELSIF NEW.birthday_month IS NULL OR NEW.birthday_day IS NULL
        OR NEW.birthday_month < 1 OR NEW.birthday_month > 12
        OR NEW.birthday_day < 1 OR NEW.birthday_day > 31 THEN
    RAISE EXCEPTION 'birthday needs a real month and day'
      USING ERRCODE = '23514';
  ELSE
    BEGIN
      PERFORM make_date(2024, NEW.birthday_month::int, NEW.birthday_day::int);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'birthday is not a real month and day'
        USING ERRCODE = '23514';
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_id_normalize_profile ON public.profiles;
CREATE TRIGGER ether_id_normalize_profile
  BEFORE INSERT OR UPDATE OF username, birthday_month, birthday_day, show_birthday, member_of
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ether_id_normalize_profile();

-- Owner card gains Member Of and city. The public verify payload stays the
-- short list: name, username, avatar, status, member since.
CREATE OR REPLACE FUNCTION public.ether_id_owner_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_public jsonb;
  v_passion text;
  v_avg numeric;
  v_count integer;
  v_projects integer;
  v_month smallint;
  v_day smallint;
  v_show boolean;
  v_birthday text;
  v_review_label text;
  v_member_of text;
  v_city text;
BEGIN
  v_public := public.ether_id_public_card(p_user_id);
  IF v_public IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(NULLIF(btrim(up.custom_name), ''), pa.name)
  INTO v_passion
  FROM public.user_passions up
  LEFT JOIN public.passions pa ON pa.id = up.passion_id
  WHERE up.user_id = p_user_id
  ORDER BY up.created_at ASC, up.id ASC
  LIMIT 1;

  SELECT round(avg(rating)::numeric, 1), COUNT(*)::integer
  INTO v_avg, v_count
  FROM public.user_reviews
  WHERE reviewed_user_id = p_user_id;

  IF v_count = 0 THEN
    v_avg := NULL;
    v_review_label := 'No peer reviews';
  ELSE
    v_review_label := trim(to_char(v_avg, 'FM990.0'))
      || ' average · '
      || v_count::text
      || CASE WHEN v_count = 1 THEN ' review' ELSE ' reviews' END;
  END IF;

  SELECT COUNT(DISTINCT p.id)::integer
  INTO v_projects
  FROM public.projects p
  WHERE p.status = 'completed'
    AND (
      p.creator_id = p_user_id
      OR EXISTS (
        SELECT 1
        FROM public.project_applications pa
        WHERE pa.project_id = p.id
          AND pa.applicant_id = p_user_id
          AND pa.status = 'accepted'
      )
    );

  SELECT birthday_month, birthday_day, show_birthday,
         NULLIF(btrim(member_of), ''),
         NULLIF(btrim(COALESCE(NULLIF(btrim(city_display), ''), NULLIF(btrim(city), ''))), '')
  INTO v_month, v_day, v_show, v_member_of, v_city
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF v_show AND v_month IS NOT NULL AND v_day IS NOT NULL THEN
    v_birthday := to_char(make_date(2024, v_month::int, v_day::int), 'FMMonth FMDD');
  ELSE
    v_birthday := NULL;
  END IF;

  RETURN v_public || jsonb_build_object(
    'passion', v_passion,
    'peer_review_average', v_avg,
    'peer_review_count', v_count,
    'peer_review_label', v_review_label,
    'projects_completed', v_projects,
    'projects_label', v_projects::text || ' completed',
    'birthday_label', v_birthday,
    'birthday_note', CASE WHEN v_birthday IS NULL THEN NULL ELSE 'self-reported' END,
    'show_birthday', COALESCE(v_show, false),
    'birthday_month', v_month,
    'birthday_day', v_day,
    'member_of', v_member_of,
    'city', v_city
  );
END;
$$;

-- Impersonation, including a false Member Of, can be reported.
ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_reason_check;

ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reason_check
  CHECK (reason IN (
    'Harassment or abuse',
    'Spam',
    'Hate or violence',
    'Sexual content',
    'Scam or fraud',
    'AI-generated or fake content',
    'Fake or AI-generated person',
    'Fully AI-generated scene passed off as real work',
    'AI slop / spam promotion',
    'Plagiarized or stolen work',
    'Impersonation',
    'Other'
  ));
