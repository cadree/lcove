-- Novi quest progress. XP stays in xp_events. This table only records
-- which quests a member has cleared, and award_xp writes the grant once.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.xp_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.xp_events DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE public.xp_events
  ADD CONSTRAINT xp_events_source_check
  CHECK (source IN ('post_work', 'collaborate', 'attend_event', 'complete_project', 'novi_quest'));

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user uuid,
  p_source text,
  p_source_id uuid,
  p_amount integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today integer;
  v_room integer;
  v_grant integer;
  v_cap constant integer := 40;
BEGIN
  IF p_user IS NULL OR p_source_id IS NULL OR p_amount IS NULL OR p_amount < 1 THEN
    RETURN;
  END IF;
  IF p_source NOT IN ('post_work', 'collaborate', 'attend_event', 'complete_project', 'novi_quest') THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('xp:' || p_user::text, 0));

  SELECT COALESCE(SUM(amount), 0)::integer INTO v_today
  FROM public.xp_events
  WHERE user_id = p_user
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');

  v_room := v_cap - v_today;
  IF v_room < 1 THEN
    RETURN;
  END IF;
  v_grant := LEAST(p_amount, v_room);

  INSERT INTO public.xp_events (user_id, source, source_id, amount)
  VALUES (p_user, p_source, p_source_id, v_grant)
  ON CONFLICT (user_id, source, source_id) DO NOTHING;
END;
$$;

CREATE TABLE IF NOT EXISTS public.novi_quest_progress (
  user_id uuid NOT NULL,
  quest_id text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  target integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  PRIMARY KEY (user_id, quest_id)
);

ALTER TABLE public.novi_quest_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own novi quests" ON public.novi_quest_progress;
CREATE POLICY "Users read own novi quests"
ON public.novi_quest_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.novi_quest_uuid(p_quest text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5('novi:' || p_quest), 1, 8) || '-' ||
    substr(md5('novi:' || p_quest), 9, 4) || '-' ||
    substr(md5('novi:' || p_quest), 13, 4) || '-' ||
    substr(md5('novi:' || p_quest), 17, 4) || '-' ||
    substr(md5('novi:' || p_quest), 21, 12)
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.complete_novi_quest(p_quest text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_progress integer := 0;
  v_target integer := 1;
  v_xp integer := 0;
  v_done boolean := false;
BEGIN
  IF v_user IS NULL OR p_quest IS NULL OR length(p_quest) > 80 THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF p_quest = 'enter_signal' THEN
    SELECT CASE WHEN display_name IS NOT NULL AND city IS NOT NULL THEN 1 ELSE 0 END
      INTO v_progress
    FROM public.profiles WHERE user_id = v_user;
    v_xp := 10;
  ELSIF p_quest = 'first_post' THEN
    SELECT LEAST(1, COUNT(*))::integer INTO v_progress FROM public.posts WHERE user_id = v_user;
    v_xp := 0;
  ELSIF p_quest = 'find_people' THEN
    SELECT LEAST(3, COUNT(*))::integer INTO v_progress FROM public.favorite_friends WHERE user_id = v_user;
    v_target := 3;
    v_xp := 10;
  ELSIF p_quest = 'read_book' THEN
    v_progress := 1;
    v_xp := 10;
  ELSIF p_quest = 'finish_project' THEN
    SELECT LEAST(1, COUNT(*))::integer INTO v_progress
    FROM public.projects WHERE creator_id = v_user AND status = 'completed';
    v_xp := 0;
  ELSIF p_quest LIKE 'daily:%' AND p_quest = 'daily:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') THEN
    v_progress := 1;
    v_xp := 5;
  ELSE
    RAISE EXCEPTION 'unknown quest';
  END IF;

  v_done := v_progress >= v_target;

  INSERT INTO public.novi_quest_progress (user_id, quest_id, progress, target, completed_at)
  VALUES (v_user, p_quest, v_progress, v_target, CASE WHEN v_done THEN now() ELSE NULL END)
  ON CONFLICT (user_id, quest_id) DO UPDATE
    SET progress = EXCLUDED.progress,
        target = EXCLUDED.target,
        completed_at = COALESCE(public.novi_quest_progress.completed_at, EXCLUDED.completed_at);

  IF v_done AND v_xp > 0 THEN
    PERFORM public.award_xp(v_user, 'novi_quest', public.novi_quest_uuid(p_quest), v_xp);
  END IF;

  RETURN public.novi_board();
END;
$$;

CREATE OR REPLACE FUNCTION public.novi_board()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_posts integer := 0;
  v_friends integer := 0;
  v_projects integer := 0;
  v_profile boolean := false;
  v_book boolean := false;
  v_daily boolean := false;
  v_today text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_xp integer := 0;
  v_days text[];
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('total', 0, 'level', 1, 'streak', 0, 'bookOpened', false, 'dailyDone', false, 'postCount', 0, 'connectionCount', 0, 'completedProjects', 0, 'profileReady', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_user AND display_name IS NOT NULL AND city IS NOT NULL
  ) INTO v_profile;
  SELECT COUNT(*)::integer INTO v_posts FROM public.posts WHERE user_id = v_user;
  SELECT COUNT(*)::integer INTO v_friends FROM public.favorite_friends WHERE user_id = v_user;
  SELECT COUNT(*)::integer INTO v_projects FROM public.projects WHERE creator_id = v_user AND status = 'completed';
  SELECT EXISTS (
    SELECT 1 FROM public.novi_quest_progress
    WHERE user_id = v_user AND quest_id = 'read_book' AND completed_at IS NOT NULL
  ) INTO v_book;
  SELECT EXISTS (
    SELECT 1 FROM public.novi_quest_progress
    WHERE user_id = v_user AND quest_id = 'daily:' || v_today AND completed_at IS NOT NULL
  ) INTO v_daily;
  SELECT COALESCE(SUM(amount), 0)::integer INTO v_xp FROM public.xp_events WHERE user_id = v_user;
  SELECT COALESCE(array_agg(DISTINCT day), ARRAY[]::text[]) INTO v_days
  FROM (
    SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
    FROM public.xp_events WHERE user_id = v_user
    UNION
    SELECT to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    FROM public.novi_quest_progress
    WHERE user_id = v_user AND completed_at IS NOT NULL
  ) days;

  RETURN jsonb_build_object(
    'total', v_xp,
    'level', public.xp_level(v_xp),
    'streakDays', v_days,
    'bookOpened', v_book,
    'dailyDone', v_daily,
    'postCount', v_posts,
    'connectionCount', v_friends,
    'completedProjects', v_projects,
    'profileReady', v_profile
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_novi_quest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.novi_board() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.novi_quest_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_novi_quest(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.novi_board() TO authenticated;
