
DROP TABLE IF EXISTS public.challenge_submissions CASCADE;
DROP TABLE IF EXISTS public.challenge_participants CASCADE;
DROP TABLE IF EXISTS public.challenges CASCADE;
DROP FUNCTION IF EXISTS public.bump_challenge_participant_count() CASCADE;

DROP TABLE IF EXISTS public.fan_challenge_completions CASCADE;
DROP FUNCTION IF EXISTS public.get_challenge_unlock_count(uuid) CASCADE;
