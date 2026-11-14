-- Grant the admin role to Cadre's account only.
--
-- Do not apply this from the app, a migration, CI, or a seed.
-- Run it once in the Supabase SQL editor after 20261024120000_admin_console.sql
-- is on that database. It inserts one user_roles row and nothing else.
--
-- The repository does not contain Cadre's login address. Replace the
-- placeholder below with that address, confirm it, then run this block.

DO $grant$
DECLARE
  cadre_email text := 'REPLACE_WITH_CADRE_LOGIN_EMAIL';
  cadre_id uuid;
BEGIN
  IF cadre_email = 'REPLACE_WITH_CADRE_LOGIN_EMAIL' OR cadre_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Set Cadre''s login email in scripts/grant-cadre-admin.sql before running it';
  END IF;

  SELECT id INTO cadre_id
  FROM auth.users
  WHERE lower(email) = lower(cadre_email);

  IF cadre_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for %', cadre_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (cadre_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END
$grant$;
