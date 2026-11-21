-- Undo 20261115160000_work_credits.sql. Revert the app commit first, so no
-- client calls these RPCs after they are gone. Roll back the later
-- creative-bridge migrations (vouches, open calls) first: they use
-- creative_account_ok and is_project_member.
-- Credit notices already sent stay in notifications (type credit) and open /profile.
DROP TRIGGER IF EXISTS credit_completed_project ON public.projects;
DROP FUNCTION IF EXISTS public.credit_completed_project();
DROP FUNCTION IF EXISTS public.post_credits(uuid);
DROP FUNCTION IF EXISTS public.profile_credits(uuid);
DROP FUNCTION IF EXISTS public.respond_work_credit(uuid, boolean);
DROP FUNCTION IF EXISTS public.remove_post_credit(uuid);
DROP FUNCTION IF EXISTS public.credit_post(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.notify_work_credit(uuid);
DROP TABLE IF EXISTS public.work_credits;
DROP FUNCTION IF EXISTS public.credit_source_visible(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.creative_account_ok(uuid);
