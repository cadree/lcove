-- Admin approval cannot be skipped from the client.
--
-- New members finish onboarding as access_status = 'pending' and wait for an
-- admin. Before this, the own-row UPDATE policy let a pending member set their
-- own access_status to 'active' (or 'denied', which sync_profile_exam_access
-- turns into 'active') with one API call.
--
-- Now a non-admin client can only keep their access_status or move it to
-- 'pending'. Any other change is quietly kept at the old value, so an older
-- app build that still sends 'active' at the end of onboarding saves the rest
-- of the profile and the member lands on the pending screen. A client insert
-- of their own profile row always starts as 'pending'.
--
-- Unchanged: admins (has_role admin), service_role and SECURITY DEFINER
-- functions owned by postgres (handle_new_user, admin_set_user_access, Stripe
-- and other edge functions) still set any status. Members who are already
-- active stay active. Ban and suspension rules stay in ether_id_protect_standing.
-- SECURITY INVOKER on purpose, same reason as ether_id_protect_standing.
-- Rollback: supabase/rollbacks/20261115190000_access_status_self_approve_guard.down.sql

CREATE OR REPLACE FUNCTION public.ether_access_self_approve_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.access_status IS DISTINCT FROM 'banned' THEN
      NEW.access_status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.access_status IS DISTINCT FROM OLD.access_status
     AND NEW.access_status IS DISTINCT FROM 'pending'
     AND NEW.access_status IS DISTINCT FROM 'banned'
     AND OLD.access_status IS DISTINCT FROM 'banned' THEN
    NEW.access_status := OLD.access_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_access_self_approve_guard ON public.profiles;
CREATE TRIGGER ether_access_self_approve_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ether_access_self_approve_guard();

REVOKE ALL ON FUNCTION public.ether_access_self_approve_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ether_access_self_approve_guard() TO service_role;
