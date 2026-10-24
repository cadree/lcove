-- Ether ID portrait. Defaults to the profile picture when this is null.
-- Uploads reuse the media bucket at {user_id}/ether-id-photo.ext.
-- "Users can upload own media" and "Users can update own media" already
-- require that folder, so this migration adds no storage policy.
-- The directory view profiles_public does not select this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_photo_url text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_photo_url_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_photo_url_length
  CHECK (id_photo_url IS NULL OR char_length(id_photo_url) <= 2000);

COMMENT ON COLUMN public.profiles.id_photo_url IS
  'Optional Ether ID portrait. The card uses this, then avatar_url. Owner writes go through "Users can update own profile" (auth.uid() = user_id). Not an age check.';

-- The column is covered by the existing table policies. Fail the migration
-- if a member can no longer update their own profile row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'profiles update policy missing; id_photo_url would have no owner write path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own media'
  ) THEN
    RAISE EXCEPTION 'media upload policy missing; Ether ID photos use that path';
  END IF;
END $$;

-- A photo change is not a standing change. ether_id_on_profile_status still
-- watches access_status, is_suspended, onboarding_completed, and last_active_at.
-- An admin ban still updates the pass row and queues the Wallet push, and the
-- in-app card still reads ether_member_status.

CREATE OR REPLACE FUNCTION public.ether_id_public_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_username text;
  v_avatar text;
  v_id_photo text;
  v_created timestamptz;
  v_status text;
BEGIN
  SELECT
    p.display_name,
    p.username,
    p.avatar_url,
    p.id_photo_url,
    p.created_at,
    public.ether_member_status(p.access_status, p.is_suspended, p.onboarding_completed, p.last_active_at)
  INTO v_name, v_username, v_avatar, v_id_photo, v_created, v_status
  FROM public.profiles p
  WHERE p.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'display_name', v_name,
    'username', v_username,
    'avatar_url', v_avatar,
    'photo_url', COALESCE(NULLIF(btrim(v_id_photo), ''), v_avatar),
    'status', v_status,
    'member_since', to_char(v_created, 'YYYY-MM-DD'),
    'member_since_label', to_char(v_created, 'FMMonth YYYY')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_public_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_public_card(uuid) TO service_role;

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
  v_id_photo text;
  v_birthday text;
  v_review_label text;
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

  SELECT birthday_month, birthday_day, show_birthday, id_photo_url
  INTO v_month, v_day, v_show, v_id_photo
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
    'id_photo_url', NULLIF(btrim(v_id_photo), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ether_id_owner_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_id_owner_card(uuid) TO service_role;
