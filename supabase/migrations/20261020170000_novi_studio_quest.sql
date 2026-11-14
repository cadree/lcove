-- Find your people completes after one favorite. Opening Studio files its own quest
-- and stays beside the current quest instead of replacing it.

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
    SELECT LEAST(1, COUNT(*))::integer INTO v_progress FROM public.favorite_friends WHERE user_id = v_user;
    v_target := 1;
    v_xp := 10;
  ELSIF p_quest = 'read_book' THEN
    v_progress := 1;
    v_xp := 10;
  ELSIF p_quest = 'finish_project' THEN
    SELECT LEAST(1, COUNT(*))::integer INTO v_progress
    FROM public.projects WHERE creator_id = v_user AND status = 'completed';
    v_xp := 0;
  ELSIF p_quest = 'open_studio' THEN
    v_progress := 1;
    v_xp := 10;
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
  v_studio boolean := false;
  v_daily boolean := false;
  v_daily_xp integer := 0;
  v_today text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_xp integer := 0;
  v_days text[] := ARRAY[]::text[];
  v_streak integer := 0;
  v_cursor date;
BEGIN
  IF v_user IS NOT NULL THEN
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
      WHERE user_id = v_user AND quest_id = 'open_studio' AND completed_at IS NOT NULL
    ) INTO v_studio;
    SELECT EXISTS (
      SELECT 1 FROM public.novi_quest_progress
      WHERE user_id = v_user AND quest_id = 'daily:' || v_today AND completed_at IS NOT NULL
    ) INTO v_daily;
    SELECT COALESCE(SUM(amount), 0)::integer INTO v_xp FROM public.xp_events WHERE user_id = v_user;
    SELECT COALESCE(SUM(amount), 0)::integer INTO v_daily_xp
    FROM public.xp_events
    WHERE user_id = v_user
      AND source = 'novi_quest'
      AND source_id = public.novi_quest_uuid('daily:' || v_today);
    SELECT COALESCE(array_agg(DISTINCT day), ARRAY[]::text[]) INTO v_days
    FROM (
      SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
      FROM public.xp_events WHERE user_id = v_user
      UNION
      SELECT to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      FROM public.novi_quest_progress
      WHERE user_id = v_user AND completed_at IS NOT NULL
    ) days;

    v_cursor := v_today::date;
    IF NOT (v_today = ANY(v_days)) THEN
      v_cursor := v_cursor - 1;
    END IF;
    WHILE to_char(v_cursor, 'YYYY-MM-DD') = ANY(v_days) LOOP
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'total', v_xp,
    'level', public.xp_level(v_xp),
    'streak', v_streak,
    'streakDays', to_jsonb(v_days),
    'dailyXp', v_daily_xp,
    'bookOpened', v_book,
    'studioOpened', v_studio,
    'dailyDone', v_daily,
    'postCount', v_posts,
    'connectionCount', v_friends,
    'completedProjects', v_projects,
    'profileReady', v_profile
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_novi_quest(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.novi_board() TO anon, authenticated;
