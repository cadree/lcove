-- Attendance is a security-definer count of people going, not the RSVP
-- rows the caller can see. A member only sees their own RSVP after the
-- privacy change, so a row count showed 1 when two people were going.
-- Ticket holders who are not already a going RSVP are included once.

CREATE OR REPLACE FUNCTION public.public_event_attendance_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = p_event_id
        AND (
          e.is_public = true
          OR e.creator_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR EXISTS (
            SELECT 1 FROM public.event_rsvps mine
            WHERE mine.event_id = e.id AND mine.user_id = auth.uid()
          )
        )
    ) THEN (
      COALESCE((
        SELECT COUNT(*) FROM public.event_rsvps r
        WHERE r.event_id = p_event_id AND r.status = 'going'
      ), 0)
      +
      COALESCE((
        SELECT COUNT(*) FROM public.event_attendees a
        WHERE a.event_id = p_event_id
          AND a.status IN ('confirmed', 'checked_in', 'registered', 'approved')
          AND NOT EXISTS (
            SELECT 1 FROM public.event_rsvps r
            WHERE r.event_id = a.event_id
              AND r.status = 'going'
              AND (
                (a.attendee_user_id IS NOT NULL AND r.user_id = a.attendee_user_id)
                OR (
                  a.attendee_email IS NOT NULL
                  AND r.guest_email IS NOT NULL
                  AND lower(r.guest_email) = lower(a.attendee_email)
                )
              )
          )
      ), 0)
    )::integer
    ELSE 0
  END;
$fn$;

-- novi_board returns the same keys signed in or out. dailyXp is the amount
-- award_xp actually wrote for today's decode, which is 0 when the daily cap
-- is already full.

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
    'dailyDone', v_daily,
    'postCount', v_posts,
    'connectionCount', v_friends,
    'completedProjects', v_projects,
    'profileReady', v_profile
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.novi_board() TO anon, authenticated;
