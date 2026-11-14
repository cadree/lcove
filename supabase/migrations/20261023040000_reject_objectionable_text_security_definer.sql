-- 20261022120000 replaced reject_objectionable_text and dropped SECURITY DEFINER.
-- Signed-in writes then fail with: permission denied for function objectionable_text.
-- Matches the ether-prod hot-fix. Safe to run again.

ALTER FUNCTION public.reject_objectionable_text()
  SECURITY DEFINER
  SET search_path = public, pg_temp;
