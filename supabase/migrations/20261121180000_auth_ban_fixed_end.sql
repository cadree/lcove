-- Removing or banning a member blocks their login until a fixed date instead
-- of 'infinity'. Supabase Auth cannot read an 'infinity' banned_until: the
-- auth admin API answers "Database error loading user" for that account.
-- Restore and unban still clear the ban (banned_until = NULL).
--
-- Accounts already stuck on 'infinity' are repaired separately through the
-- auth admin API; the UPDATE at the end catches any it could not reach.

CREATE OR REPLACE FUNCTION public.admin_set_auth_ban(p_user_id uuid, p_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'banned_until'
  ) THEN
    RETURN;
  END IF;

  IF p_banned THEN
    EXECUTE 'UPDATE auth.users SET banned_until = $1 WHERE id = $2'
      USING '2126-01-01 00:00:00+00'::timestamptz, p_user_id;
  ELSE
    EXECUTE 'UPDATE auth.users SET banned_until = NULL WHERE id = $1'
      USING p_user_id;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_set_auth_ban(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_auth_ban(uuid, boolean) TO service_role;

DO $repair$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'banned_until'
  ) THEN
    EXECUTE 'UPDATE auth.users SET banned_until = $1 WHERE banned_until = ''infinity''::timestamptz'
      USING '2126-01-01 00:00:00+00'::timestamptz;
  END IF;
END
$repair$;
