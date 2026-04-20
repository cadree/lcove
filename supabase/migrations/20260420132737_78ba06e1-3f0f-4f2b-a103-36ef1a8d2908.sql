
-- 1. Profile columns for targeting
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS region_state text,
  ADD COLUMN IF NOT EXISTS region_country text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_interests ON public.profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles (last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_birth_year ON public.profiles (birth_year);
CREATE INDEX IF NOT EXISTS idx_profiles_region_state ON public.profiles (region_state);
CREATE INDEX IF NOT EXISTS idx_profiles_region_country ON public.profiles (region_country);

-- 2. notification_campaigns
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  name text,
  type text NOT NULL CHECK (type IN ('reminder','invite','blast','individual')),
  title text,
  body text,
  channels text[] DEFAULT '{}'::text[],
  audience_filter jsonb DEFAULT '{}'::jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  rsvp_conversions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_host ON public.notification_campaigns (host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_event ON public.notification_campaigns (event_id);

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own campaigns"
  ON public.notification_campaigns FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can create own campaigns"
  ON public.notification_campaigns FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update own campaigns"
  ON public.notification_campaigns FOR UPDATE
  USING (auth.uid() = host_user_id);

-- 3. notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL,
  user_id uuid,
  recipient_email text,
  recipient_phone text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('reminder','invite','blast','individual')),
  channel text NOT NULL CHECK (channel IN ('push','email','sms','in_app')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','opened','clicked','failed','bounced')),
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_host ON public.notification_logs (host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON public.notification_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_logs_event ON public.notification_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_logs_user ON public.notification_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_logs_email ON public.notification_logs (recipient_email);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own logs"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Hosts can create own logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

-- 4. event_auto_reminders
CREATE TABLE IF NOT EXISTS public.event_auto_reminders (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  enabled_24h boolean NOT NULL DEFAULT false,
  enabled_2h boolean NOT NULL DEFAULT false,
  enabled_at_door boolean NOT NULL DEFAULT false,
  last_24h_sent_at timestamptz,
  last_2h_sent_at timestamptz,
  last_at_door_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_auto_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event managers can view auto reminders"
  ON public.event_auto_reminders FOR SELECT
  USING (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Event managers can insert auto reminders"
  ON public.event_auto_reminders FOR INSERT
  WITH CHECK (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Event managers can update auto reminders"
  ON public.event_auto_reminders FOR UPDATE
  USING (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Event managers can delete auto reminders"
  ON public.event_auto_reminders FOR DELETE
  USING (public.can_manage_event(event_id, auth.uid()));

CREATE TRIGGER trg_event_auto_reminders_updated_at
  BEFORE UPDATE ON public.event_auto_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RPC: get_audience_estimate
CREATE OR REPLACE FUNCTION public.get_audience_estimate(filter jsonb)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_city_keys text[];
  v_states text[];
  v_countries text[];
  v_interests text[];
  v_passions text[];
  v_genders text[];
  v_age_min int;
  v_age_max int;
  v_active_only boolean;
  v_current_year int := EXTRACT(YEAR FROM now())::int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_city_keys := ARRAY(SELECT lower(jsonb_array_elements_text(COALESCE(filter->'cities','[]'::jsonb))));
  v_states := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'states','[]'::jsonb)));
  v_countries := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'countries','[]'::jsonb)));
  v_interests := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'interests','[]'::jsonb)));
  v_passions := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'passions','[]'::jsonb)));
  v_genders := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'genders','[]'::jsonb)));
  v_age_min := NULLIF(filter->>'age_min','')::int;
  v_age_max := NULLIF(filter->>'age_max','')::int;
  v_active_only := COALESCE((filter->>'active_only')::boolean, false);

  SELECT count(DISTINCT p.user_id) INTO v_count
  FROM public.profiles p
  WHERE p.access_status = 'active'
    AND (array_length(v_city_keys,1) IS NULL OR lower(COALESCE(p.city_key, p.city, '')) = ANY(v_city_keys))
    AND (array_length(v_states,1) IS NULL OR p.region_state = ANY(v_states))
    AND (array_length(v_countries,1) IS NULL OR p.region_country = ANY(v_countries))
    AND (array_length(v_genders,1) IS NULL OR p.gender = ANY(v_genders))
    AND (v_age_min IS NULL OR p.birth_year IS NULL OR (v_current_year - p.birth_year) >= v_age_min)
    AND (v_age_max IS NULL OR p.birth_year IS NULL OR (v_current_year - p.birth_year) <= v_age_max)
    AND (array_length(v_interests,1) IS NULL OR p.interests && v_interests)
    AND (NOT v_active_only OR p.last_active_at >= now() - interval '30 days')
    AND (
      array_length(v_passions,1) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_passions up
        JOIN public.passions ps ON ps.id = up.passion_id
        WHERE up.user_id = p.user_id AND ps.name = ANY(v_passions)
      )
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 6. RPC: get_campaign_analytics
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_totals jsonb;
  v_by_channel jsonb;
  v_recent jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT jsonb_build_object(
    'sent', count(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked')),
    'opened', count(*) FILTER (WHERE opened_at IS NOT NULL),
    'clicked', count(*) FILTER (WHERE clicked_at IS NOT NULL),
    'failed', count(*) FILTER (WHERE status IN ('failed','bounced')),
    'total', count(*)
  ) INTO v_totals
  FROM public.notification_logs
  WHERE host_user_id = v_caller
    AND (p_event_id IS NULL OR event_id = p_event_id);

  SELECT COALESCE(jsonb_object_agg(channel, c), '{}'::jsonb) INTO v_by_channel
  FROM (
    SELECT channel, count(*) AS c
    FROM public.notification_logs
    WHERE host_user_id = v_caller
      AND (p_event_id IS NULL OR event_id = p_event_id)
    GROUP BY channel
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'type', type, 'title', title,
    'recipient_count', recipient_count, 'sent_count', sent_count,
    'opened_count', opened_count, 'clicked_count', clicked_count,
    'rsvp_conversions', rsvp_conversions, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT * FROM public.notification_campaigns
    WHERE host_user_id = v_caller
      AND (p_event_id IS NULL OR event_id = p_event_id)
    ORDER BY created_at DESC
    LIMIT 20
  ) c;

  RETURN jsonb_build_object(
    'totals', COALESCE(v_totals, '{}'::jsonb),
    'by_channel', v_by_channel,
    'recent_campaigns', v_recent
  );
END;
$$;

-- 7. touch_last_active
CREATE OR REPLACE FUNCTION public.touch_last_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles SET last_active_at = now() WHERE user_id = auth.uid();
END;
$$;
