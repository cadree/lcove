
-- Audience preview RPC (sample of matching users)
CREATE OR REPLACE FUNCTION public.get_audience_preview(filter jsonb, p_limit int DEFAULT 12)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, interests text[], last_active_at timestamptz, city text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_city_keys text[];
  v_states text[];
  v_countries text[];
  v_interests text[];
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
  v_genders := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'genders','[]'::jsonb)));
  v_age_min := NULLIF(filter->>'age_min','')::int;
  v_age_max := NULLIF(filter->>'age_max','')::int;
  v_active_only := COALESCE((filter->>'active_only')::boolean, false);

  RETURN QUERY
  SELECT p.user_id, p.display_name, p.avatar_url, p.interests, p.last_active_at, p.city
  FROM public.profiles p
  WHERE p.access_status = 'active'
    AND p.display_name IS NOT NULL
    AND (array_length(v_city_keys,1) IS NULL OR lower(COALESCE(p.city_key, p.city, '')) = ANY(v_city_keys))
    AND (array_length(v_states,1) IS NULL OR p.region_state = ANY(v_states))
    AND (array_length(v_countries,1) IS NULL OR p.region_country = ANY(v_countries))
    AND (array_length(v_genders,1) IS NULL OR p.gender = ANY(v_genders))
    AND (v_age_min IS NULL OR p.birth_year IS NULL OR (v_current_year - p.birth_year) >= v_age_min)
    AND (v_age_max IS NULL OR p.birth_year IS NULL OR (v_current_year - p.birth_year) <= v_age_max)
    AND (array_length(v_interests,1) IS NULL OR p.interests && v_interests)
    AND (NOT v_active_only OR p.last_active_at >= now() - interval '30 days')
  ORDER BY 
    CASE WHEN p.avatar_url IS NOT NULL THEN 0 ELSE 1 END,
    p.last_active_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 24));
END;
$$;

-- Event moodboard items
CREATE TABLE IF NOT EXISTS public.event_moodboard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image','link','note','itinerary')),
  media_url text,
  link_url text,
  title text,
  body text,
  start_time timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_moodboard_event ON public.event_moodboard_items(event_id, sort_order);

ALTER TABLE public.event_moodboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view moodboard for public events"
ON public.event_moodboard_items FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_public = true)
  OR public.can_manage_event(event_id, auth.uid())
);

CREATE POLICY "Event managers can insert moodboard"
ON public.event_moodboard_items FOR INSERT
WITH CHECK (public.can_manage_event(event_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Event managers can update moodboard"
ON public.event_moodboard_items FOR UPDATE
USING (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Event managers can delete moodboard"
ON public.event_moodboard_items FOR DELETE
USING (public.can_manage_event(event_id, auth.uid()));
