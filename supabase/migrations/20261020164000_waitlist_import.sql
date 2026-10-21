-- Admin bulk import onto the waitlist. Do not apply this file from the app.
-- Existing emails are left unchanged, including their original src.

CREATE OR REPLACE FUNCTION public.import_waitlist(p_src text, p_rows jsonb)
RETURNS TABLE (
  email text,
  outcome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_src text := lower(btrim(coalesce(p_src, '')));
  v_item jsonb;
  v_name text;
  v_email text;
  v_ig text;
  v_code text;
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i integer;
  n integer;
  attempt integer;
  inserted boolean;
BEGIN
  IF NOT public.waitlist_admin_allowed() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF v_src NOT IN ('oct27', 'ig', 'dm', 'slack', 'familcy', 'sponsor', 'nuance', 'manifest', 'direct') THEN
    RAISE EXCEPTION 'invalid src';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows required';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'too many rows';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_email := lower(btrim(coalesce(v_item ->> 'email', '')));
    v_ig := regexp_replace(btrim(coalesce(v_item ->> 'ig', '')), '^@+', '');
    email := v_email;
    outcome := NULL;

    IF v_name = '' OR char_length(v_name) > 100
       OR v_email = '' OR char_length(v_email) > 255
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR (v_ig <> '' AND (char_length(v_ig) > 30 OR v_ig !~ '^[A-Za-z0-9._]+$')) THEN
      outcome := 'invalid';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_ig = '' THEN
      v_ig := NULL;
    END IF;

    inserted := false;
    FOR attempt IN 1..8 LOOP
      v_code := '';
      FOR i IN 1..8 LOOP
        n := 1 + floor(random() * length(alphabet))::integer;
        v_code := v_code || substr(alphabet, n, 1);
      END LOOP;
      BEGIN
        INSERT INTO public.waitlist (
          name, email, ig_handle, email_me, src, ref_code, founding
        ) VALUES (
          v_name, v_email, v_ig, true, v_src, v_code, true
        );
        inserted := true;
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          IF EXISTS (SELECT 1 FROM public.waitlist w WHERE w.email = v_email) THEN
            outcome := 'unchanged';
            RETURN NEXT;
            inserted := true;
            EXIT;
          END IF;
      END;
    END LOOP;

    IF inserted AND outcome IS DISTINCT FROM 'unchanged' THEN
      outcome := 'added';
      RETURN NEXT;
    ELSIF NOT inserted THEN
      outcome := 'invalid';
      RETURN NEXT;
    END IF;
    outcome := NULL;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION public.import_waitlist(text, jsonb) IS
  'Admin or service_role. Adds waitlist rows for a chosen src. Duplicate emails are skipped and keep their original src.';

REVOKE ALL ON FUNCTION public.import_waitlist(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_waitlist(text, jsonb) TO authenticated, service_role;
