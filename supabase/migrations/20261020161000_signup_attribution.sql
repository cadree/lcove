-- First-touch signup source captured in the browser. Do not apply this file from the app.
-- profiles_public does not select this column. Own-row RLS on profiles still applies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_attribution jsonb;

COMMENT ON COLUMN public.profiles.signup_attribution IS
  'First-touch browser capture before signup. Keys: src, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_path, captured_at. Not part of profiles_public.';
