-- 1. State normalization functions
CREATE OR REPLACE FUNCTION public.normalize_state(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE s text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  s := lower(trim(input));
  IF s = '' THEN RETURN NULL; END IF;
  RETURN CASE s
    WHEN 'al' THEN 'AL' WHEN 'alabama' THEN 'AL'
    WHEN 'ak' THEN 'AK' WHEN 'alaska' THEN 'AK'
    WHEN 'az' THEN 'AZ' WHEN 'arizona' THEN 'AZ'
    WHEN 'ar' THEN 'AR' WHEN 'arkansas' THEN 'AR'
    WHEN 'ca' THEN 'CA' WHEN 'california' THEN 'CA'
    WHEN 'co' THEN 'CO' WHEN 'colorado' THEN 'CO'
    WHEN 'ct' THEN 'CT' WHEN 'connecticut' THEN 'CT'
    WHEN 'de' THEN 'DE' WHEN 'delaware' THEN 'DE'
    WHEN 'dc' THEN 'DC' WHEN 'district of columbia' THEN 'DC' WHEN 'washington dc' THEN 'DC' WHEN 'washington d.c.' THEN 'DC'
    WHEN 'fl' THEN 'FL' WHEN 'florida' THEN 'FL'
    WHEN 'ga' THEN 'GA' WHEN 'georgia' THEN 'GA'
    WHEN 'hi' THEN 'HI' WHEN 'hawaii' THEN 'HI'
    WHEN 'id' THEN 'ID' WHEN 'idaho' THEN 'ID'
    WHEN 'il' THEN 'IL' WHEN 'illinois' THEN 'IL'
    WHEN 'in' THEN 'IN' WHEN 'indiana' THEN 'IN'
    WHEN 'ia' THEN 'IA' WHEN 'iowa' THEN 'IA'
    WHEN 'ks' THEN 'KS' WHEN 'kansas' THEN 'KS'
    WHEN 'ky' THEN 'KY' WHEN 'kentucky' THEN 'KY'
    WHEN 'la' THEN 'LA' WHEN 'louisiana' THEN 'LA'
    WHEN 'me' THEN 'ME' WHEN 'maine' THEN 'ME'
    WHEN 'md' THEN 'MD' WHEN 'maryland' THEN 'MD'
    WHEN 'ma' THEN 'MA' WHEN 'massachusetts' THEN 'MA'
    WHEN 'mi' THEN 'MI' WHEN 'michigan' THEN 'MI'
    WHEN 'mn' THEN 'MN' WHEN 'minnesota' THEN 'MN'
    WHEN 'ms' THEN 'MS' WHEN 'mississippi' THEN 'MS'
    WHEN 'mo' THEN 'MO' WHEN 'missouri' THEN 'MO'
    WHEN 'mt' THEN 'MT' WHEN 'montana' THEN 'MT'
    WHEN 'ne' THEN 'NE' WHEN 'nebraska' THEN 'NE'
    WHEN 'nv' THEN 'NV' WHEN 'nevada' THEN 'NV'
    WHEN 'nh' THEN 'NH' WHEN 'new hampshire' THEN 'NH'
    WHEN 'nj' THEN 'NJ' WHEN 'new jersey' THEN 'NJ'
    WHEN 'nm' THEN 'NM' WHEN 'new mexico' THEN 'NM'
    WHEN 'ny' THEN 'NY' WHEN 'new york' THEN 'NY'
    WHEN 'nc' THEN 'NC' WHEN 'north carolina' THEN 'NC'
    WHEN 'nd' THEN 'ND' WHEN 'north dakota' THEN 'ND'
    WHEN 'oh' THEN 'OH' WHEN 'ohio' THEN 'OH'
    WHEN 'ok' THEN 'OK' WHEN 'oklahoma' THEN 'OK'
    WHEN 'or' THEN 'OR' WHEN 'oregon' THEN 'OR'
    WHEN 'pa' THEN 'PA' WHEN 'pennsylvania' THEN 'PA'
    WHEN 'ri' THEN 'RI' WHEN 'rhode island' THEN 'RI'
    WHEN 'sc' THEN 'SC' WHEN 'south carolina' THEN 'SC'
    WHEN 'sd' THEN 'SD' WHEN 'south dakota' THEN 'SD'
    WHEN 'tn' THEN 'TN' WHEN 'tennessee' THEN 'TN'
    WHEN 'tx' THEN 'TX' WHEN 'texas' THEN 'TX'
    WHEN 'ut' THEN 'UT' WHEN 'utah' THEN 'UT'
    WHEN 'vt' THEN 'VT' WHEN 'vermont' THEN 'VT'
    WHEN 'va' THEN 'VA' WHEN 'virginia' THEN 'VA'
    WHEN 'wa' THEN 'WA' WHEN 'washington' THEN 'WA'
    WHEN 'wv' THEN 'WV' WHEN 'west virginia' THEN 'WV'
    WHEN 'wi' THEN 'WI' WHEN 'wisconsin' THEN 'WI'
    WHEN 'wy' THEN 'WY' WHEN 'wyoming' THEN 'WY'
    ELSE NULL
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.city_to_state(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE c text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  c := lower(trim(input));
  c := regexp_replace(c, ',.*$', '');
  c := trim(c);
  IF c = '' THEN RETURN NULL; END IF;
  RETURN CASE c
    WHEN 'birmingham' THEN 'AL' WHEN 'montgomery' THEN 'AL' WHEN 'mobile' THEN 'AL' WHEN 'huntsville' THEN 'AL' WHEN 'tuscaloosa' THEN 'AL'
    WHEN 'anchorage' THEN 'AK' WHEN 'fairbanks' THEN 'AK' WHEN 'juneau' THEN 'AK'
    WHEN 'phoenix' THEN 'AZ' WHEN 'tucson' THEN 'AZ' WHEN 'mesa' THEN 'AZ' WHEN 'scottsdale' THEN 'AZ' WHEN 'tempe' THEN 'AZ' WHEN 'chandler' THEN 'AZ' WHEN 'glendale' THEN 'AZ' WHEN 'flagstaff' THEN 'AZ'
    WHEN 'little rock' THEN 'AR' WHEN 'fort smith' THEN 'AR'
    WHEN 'los angeles' THEN 'CA' WHEN 'la' THEN 'CA' WHEN 'san francisco' THEN 'CA' WHEN 'sf' THEN 'CA' WHEN 'san diego' THEN 'CA' WHEN 'san jose' THEN 'CA' WHEN 'sacramento' THEN 'CA' WHEN 'oakland' THEN 'CA' WHEN 'long beach' THEN 'CA' WHEN 'anaheim' THEN 'CA' WHEN 'fresno' THEN 'CA' WHEN 'berkeley' THEN 'CA' WHEN 'santa monica' THEN 'CA' WHEN 'pasadena' THEN 'CA' WHEN 'beverly hills' THEN 'CA' WHEN 'hollywood' THEN 'CA' WHEN 'irvine' THEN 'CA' WHEN 'santa clara' THEN 'CA' WHEN 'palo alto' THEN 'CA' WHEN 'burbank' THEN 'CA' WHEN 'inglewood' THEN 'CA' WHEN 'compton' THEN 'CA' WHEN 'santa ana' THEN 'CA'
    WHEN 'denver' THEN 'CO' WHEN 'boulder' THEN 'CO' WHEN 'colorado springs' THEN 'CO' WHEN 'aurora' THEN 'CO' WHEN 'fort collins' THEN 'CO'
    WHEN 'hartford' THEN 'CT' WHEN 'new haven' THEN 'CT' WHEN 'stamford' THEN 'CT' WHEN 'bridgeport' THEN 'CT'
    WHEN 'wilmington' THEN 'DE' WHEN 'dover' THEN 'DE'
    WHEN 'washington' THEN 'DC' WHEN 'dc' THEN 'DC'
    WHEN 'miami' THEN 'FL' WHEN 'orlando' THEN 'FL' WHEN 'tampa' THEN 'FL' WHEN 'jacksonville' THEN 'FL' WHEN 'fort lauderdale' THEN 'FL' WHEN 'miami beach' THEN 'FL' WHEN 'tallahassee' THEN 'FL' WHEN 'st. petersburg' THEN 'FL' WHEN 'st petersburg' THEN 'FL' WHEN 'hialeah' THEN 'FL' WHEN 'gainesville' THEN 'FL' WHEN 'west palm beach' THEN 'FL'
    WHEN 'atlanta' THEN 'GA' WHEN 'savannah' THEN 'GA' WHEN 'athens' THEN 'GA' WHEN 'augusta' THEN 'GA' WHEN 'columbus' THEN 'GA' WHEN 'macon' THEN 'GA'
    WHEN 'honolulu' THEN 'HI' WHEN 'hilo' THEN 'HI'
    WHEN 'boise' THEN 'ID'
    WHEN 'chicago' THEN 'IL' WHEN 'evanston' THEN 'IL' WHEN 'springfield' THEN 'IL' WHEN 'naperville' THEN 'IL' WHEN 'rockford' THEN 'IL'
    WHEN 'indianapolis' THEN 'IN' WHEN 'fort wayne' THEN 'IN' WHEN 'bloomington' THEN 'IN'
    WHEN 'des moines' THEN 'IA' WHEN 'cedar rapids' THEN 'IA' WHEN 'iowa city' THEN 'IA'
    WHEN 'wichita' THEN 'KS' WHEN 'topeka' THEN 'KS' WHEN 'kansas city' THEN 'KS' WHEN 'overland park' THEN 'KS'
    WHEN 'louisville' THEN 'KY' WHEN 'lexington' THEN 'KY'
    WHEN 'new orleans' THEN 'LA' WHEN 'baton rouge' THEN 'LA' WHEN 'shreveport' THEN 'LA' WHEN 'nola' THEN 'LA'
    WHEN 'portland' THEN 'ME' WHEN 'bangor' THEN 'ME'
    WHEN 'baltimore' THEN 'MD' WHEN 'annapolis' THEN 'MD' WHEN 'silver spring' THEN 'MD'
    WHEN 'boston' THEN 'MA' WHEN 'cambridge' THEN 'MA' WHEN 'worcester' THEN 'MA' WHEN 'springfield ma' THEN 'MA'
    WHEN 'detroit' THEN 'MI' WHEN 'ann arbor' THEN 'MI' WHEN 'grand rapids' THEN 'MI' WHEN 'lansing' THEN 'MI' WHEN 'flint' THEN 'MI'
    WHEN 'minneapolis' THEN 'MN' WHEN 'st. paul' THEN 'MN' WHEN 'st paul' THEN 'MN' WHEN 'saint paul' THEN 'MN'
    WHEN 'jackson' THEN 'MS'
    WHEN 'st. louis' THEN 'MO' WHEN 'st louis' THEN 'MO' WHEN 'saint louis' THEN 'MO' WHEN 'springfield mo' THEN 'MO'
    WHEN 'billings' THEN 'MT' WHEN 'missoula' THEN 'MT' WHEN 'bozeman' THEN 'MT'
    WHEN 'omaha' THEN 'NE' WHEN 'lincoln' THEN 'NE'
    WHEN 'las vegas' THEN 'NV' WHEN 'vegas' THEN 'NV' WHEN 'reno' THEN 'NV' WHEN 'henderson' THEN 'NV'
    WHEN 'manchester' THEN 'NH' WHEN 'concord' THEN 'NH'
    WHEN 'newark' THEN 'NJ' WHEN 'jersey city' THEN 'NJ' WHEN 'hoboken' THEN 'NJ' WHEN 'trenton' THEN 'NJ' WHEN 'princeton' THEN 'NJ'
    WHEN 'albuquerque' THEN 'NM' WHEN 'santa fe' THEN 'NM'
    WHEN 'new york' THEN 'NY' WHEN 'new york city' THEN 'NY' WHEN 'nyc' THEN 'NY' WHEN 'brooklyn' THEN 'NY' WHEN 'queens' THEN 'NY' WHEN 'bronx' THEN 'NY' WHEN 'manhattan' THEN 'NY' WHEN 'staten island' THEN 'NY' WHEN 'buffalo' THEN 'NY' WHEN 'rochester' THEN 'NY' WHEN 'albany' THEN 'NY' WHEN 'syracuse' THEN 'NY' WHEN 'yonkers' THEN 'NY'
    WHEN 'charlotte' THEN 'NC' WHEN 'raleigh' THEN 'NC' WHEN 'durham' THEN 'NC' WHEN 'greensboro' THEN 'NC' WHEN 'winston-salem' THEN 'NC' WHEN 'winston salem' THEN 'NC' WHEN 'asheville' THEN 'NC' WHEN 'cary' THEN 'NC' WHEN 'wilmington nc' THEN 'NC' WHEN 'chapel hill' THEN 'NC' WHEN 'fayetteville' THEN 'NC'
    WHEN 'fargo' THEN 'ND' WHEN 'bismarck' THEN 'ND'
    WHEN 'cleveland' THEN 'OH' WHEN 'cincinnati' THEN 'OH' WHEN 'toledo' THEN 'OH' WHEN 'akron' THEN 'OH' WHEN 'dayton' THEN 'OH'
    WHEN 'oklahoma city' THEN 'OK' WHEN 'okc' THEN 'OK' WHEN 'tulsa' THEN 'OK' WHEN 'norman' THEN 'OK'
    WHEN 'eugene' THEN 'OR' WHEN 'salem' THEN 'OR' WHEN 'bend' THEN 'OR' WHEN 'portland or' THEN 'OR'
    WHEN 'philadelphia' THEN 'PA' WHEN 'philly' THEN 'PA' WHEN 'pittsburgh' THEN 'PA' WHEN 'harrisburg' THEN 'PA' WHEN 'allentown' THEN 'PA' WHEN 'erie' THEN 'PA'
    WHEN 'providence' THEN 'RI'
    WHEN 'charleston' THEN 'SC' WHEN 'columbia' THEN 'SC' WHEN 'greenville' THEN 'SC' WHEN 'myrtle beach' THEN 'SC'
    WHEN 'sioux falls' THEN 'SD' WHEN 'rapid city' THEN 'SD'
    WHEN 'nashville' THEN 'TN' WHEN 'memphis' THEN 'TN' WHEN 'knoxville' THEN 'TN' WHEN 'chattanooga' THEN 'TN'
    WHEN 'houston' THEN 'TX' WHEN 'dallas' THEN 'TX' WHEN 'austin' THEN 'TX' WHEN 'san antonio' THEN 'TX' WHEN 'fort worth' THEN 'TX' WHEN 'el paso' THEN 'TX' WHEN 'arlington' THEN 'TX' WHEN 'plano' THEN 'TX' WHEN 'corpus christi' THEN 'TX' WHEN 'lubbock' THEN 'TX' WHEN 'irving' THEN 'TX' WHEN 'garland' THEN 'TX' WHEN 'frisco' THEN 'TX' WHEN 'mckinney' THEN 'TX'
    WHEN 'salt lake city' THEN 'UT' WHEN 'slc' THEN 'UT' WHEN 'provo' THEN 'UT' WHEN 'park city' THEN 'UT'
    WHEN 'burlington' THEN 'VT' WHEN 'montpelier' THEN 'VT'
    WHEN 'virginia beach' THEN 'VA' WHEN 'richmond' THEN 'VA' WHEN 'norfolk' THEN 'VA' WHEN 'arlington va' THEN 'VA' WHEN 'alexandria' THEN 'VA' WHEN 'charlottesville' THEN 'VA'
    WHEN 'seattle' THEN 'WA' WHEN 'tacoma' THEN 'WA' WHEN 'spokane' THEN 'WA' WHEN 'bellevue' THEN 'WA' WHEN 'olympia' THEN 'WA'
    WHEN 'charleston wv' THEN 'WV'
    WHEN 'milwaukee' THEN 'WI' WHEN 'madison' THEN 'WI' WHEN 'green bay' THEN 'WI'
    WHEN 'cheyenne' THEN 'WY' WHEN 'jackson hole' THEN 'WY'
    ELSE NULL
  END;
END;
$$;

-- 2. Backfill region_state and last_active_at — temporarily disable validation trigger
ALTER TABLE public.profiles DISABLE TRIGGER USER;

UPDATE public.profiles
SET region_state = COALESCE(
  public.normalize_state(region_state),
  public.city_to_state(city),
  public.city_to_state(city_key)
)
WHERE region_state IS DISTINCT FROM COALESCE(
  public.normalize_state(region_state),
  public.city_to_state(city),
  public.city_to_state(city_key)
);

WITH signals AS (
  SELECT p.user_id,
    GREATEST(
      COALESCE((SELECT MAX(created_at) FROM public.messages WHERE sender_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM public.event_rsvps WHERE user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM public.blog_posts WHERE user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE((SELECT MAX(created_at) FROM public.dance_videos WHERE user_id = p.user_id), 'epoch'::timestamptz),
      COALESCE(p.updated_at, 'epoch'::timestamptz)
    ) AS real_last_active
  FROM public.profiles p
)
UPDATE public.profiles p
SET last_active_at = CASE
  WHEN s.real_last_active <= 'epoch'::timestamptz + interval '1 day' THEN NULL
  ELSE s.real_last_active
END
FROM signals s
WHERE p.user_id = s.user_id;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

-- 3. Moodboard columns
ALTER TABLE public.event_moodboard_items
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text;

-- 4. Rewrite get_audience_estimate
CREATE OR REPLACE FUNCTION public.get_audience_estimate(filter jsonb)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
  v_city_keys text[]; v_states text[]; v_states_norm text[]; v_countries text[];
  v_interests text[]; v_passions text[]; v_genders text[];
  v_age_min int; v_age_max int; v_active_only boolean; v_include_unknown_ages boolean;
  v_current_year int := EXTRACT(YEAR FROM now())::int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_city_keys := ARRAY(SELECT lower(jsonb_array_elements_text(COALESCE(filter->'cities','[]'::jsonb))));
  v_states := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'states','[]'::jsonb)));
  v_states_norm := ARRAY(SELECT public.normalize_state(s) FROM unnest(v_states) s WHERE public.normalize_state(s) IS NOT NULL);
  v_countries := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'countries','[]'::jsonb)));
  v_interests := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'interests','[]'::jsonb)));
  v_passions := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'passions','[]'::jsonb)));
  v_genders := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'genders','[]'::jsonb)));
  v_age_min := NULLIF(filter->>'age_min','')::int;
  v_age_max := NULLIF(filter->>'age_max','')::int;
  v_active_only := COALESCE((filter->>'active_only')::boolean, false);
  v_include_unknown_ages := COALESCE((filter->>'include_unknown_ages')::boolean, false);

  SELECT count(DISTINCT p.user_id) INTO v_count
  FROM public.profiles p
  WHERE p.access_status = 'active'
    AND (array_length(v_city_keys,1) IS NULL OR lower(COALESCE(p.city_key, p.city, '')) = ANY(v_city_keys))
    AND (array_length(v_states_norm,1) IS NULL
      OR COALESCE(public.normalize_state(p.region_state), public.city_to_state(p.city), public.city_to_state(p.city_key)) = ANY(v_states_norm))
    AND (array_length(v_countries,1) IS NULL OR p.region_country = ANY(v_countries))
    AND (array_length(v_genders,1) IS NULL OR p.gender = ANY(v_genders))
    AND ((v_age_min IS NULL AND v_age_max IS NULL)
      OR (p.birth_year IS NULL AND v_include_unknown_ages)
      OR (p.birth_year IS NOT NULL
        AND (v_age_min IS NULL OR (v_current_year - p.birth_year) >= v_age_min)
        AND (v_age_max IS NULL OR (v_current_year - p.birth_year) <= v_age_max)))
    AND (array_length(v_interests,1) IS NULL OR p.interests && v_interests)
    AND (NOT v_active_only OR p.last_active_at >= now() - interval '30 days')
    AND (array_length(v_passions,1) IS NULL
      OR EXISTS (SELECT 1 FROM public.user_passions up
        JOIN public.passions ps ON ps.id = up.passion_id
        WHERE up.user_id = p.user_id AND ps.name = ANY(v_passions)));
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 5. Rewrite get_audience_preview
CREATE OR REPLACE FUNCTION public.get_audience_preview(filter jsonb, p_limit integer DEFAULT 12)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, interests text[], last_active_at timestamptz, city text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_city_keys text[]; v_states text[]; v_states_norm text[]; v_countries text[];
  v_interests text[]; v_passions text[]; v_genders text[];
  v_age_min int; v_age_max int; v_active_only boolean; v_include_unknown_ages boolean;
  v_effective_limit int; v_current_year int := EXTRACT(YEAR FROM now())::int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_city_keys := ARRAY(SELECT lower(jsonb_array_elements_text(COALESCE(filter->'cities','[]'::jsonb))));
  v_states := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'states','[]'::jsonb)));
  v_states_norm := ARRAY(SELECT public.normalize_state(s) FROM unnest(v_states) s WHERE public.normalize_state(s) IS NOT NULL);
  v_countries := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'countries','[]'::jsonb)));
  v_interests := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'interests','[]'::jsonb)));
  v_passions := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'passions','[]'::jsonb)));
  v_genders := ARRAY(SELECT jsonb_array_elements_text(COALESCE(filter->'genders','[]'::jsonb)));
  v_age_min := NULLIF(filter->>'age_min','')::int;
  v_age_max := NULLIF(filter->>'age_max','')::int;
  v_active_only := COALESCE((filter->>'active_only')::boolean, false);
  v_include_unknown_ages := COALESCE((filter->>'include_unknown_ages')::boolean, false);
  v_effective_limit := GREATEST(1, LEAST(COALESCE(p_limit, 12), 10000));

  RETURN QUERY
  SELECT p.user_id, p.display_name, p.avatar_url, p.interests, p.last_active_at, p.city
  FROM public.profiles p
  WHERE p.access_status = 'active' AND p.display_name IS NOT NULL
    AND (array_length(v_city_keys,1) IS NULL OR lower(COALESCE(p.city_key, p.city, '')) = ANY(v_city_keys))
    AND (array_length(v_states_norm,1) IS NULL
      OR COALESCE(public.normalize_state(p.region_state), public.city_to_state(p.city), public.city_to_state(p.city_key)) = ANY(v_states_norm))
    AND (array_length(v_countries,1) IS NULL OR p.region_country = ANY(v_countries))
    AND (array_length(v_genders,1) IS NULL OR p.gender = ANY(v_genders))
    AND ((v_age_min IS NULL AND v_age_max IS NULL)
      OR (p.birth_year IS NULL AND v_include_unknown_ages)
      OR (p.birth_year IS NOT NULL
        AND (v_age_min IS NULL OR (v_current_year - p.birth_year) >= v_age_min)
        AND (v_age_max IS NULL OR (v_current_year - p.birth_year) <= v_age_max)))
    AND (array_length(v_interests,1) IS NULL OR p.interests && v_interests)
    AND (NOT v_active_only OR p.last_active_at >= now() - interval '30 days')
    AND (array_length(v_passions,1) IS NULL
      OR EXISTS (SELECT 1 FROM public.user_passions up
        JOIN public.passions ps ON ps.id = up.passion_id
        WHERE up.user_id = p.user_id AND ps.name = ANY(v_passions)))
  ORDER BY
    CASE WHEN p.avatar_url IS NOT NULL THEN 0 ELSE 1 END,
    p.last_active_at DESC NULLS LAST
  LIMIT v_effective_limit;
END;
$$;