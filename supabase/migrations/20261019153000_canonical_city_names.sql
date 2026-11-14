-- Group city spellings for the landing count without rewriting profiles.city.
-- "Charlotte", "Charlotte, NC", and "Charlotte, North Carolina" share one name.
-- A city_key written by the app as "charlotte|nc" (including a high-confidence
-- typo fold) counts as that same name. The original city text stays put.

CREATE OR REPLACE FUNCTION public.canonical_city_name(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  cleaned text := lower(regexp_replace(btrim(coalesce(raw, '')), '\s+', ' ', 'g'));
  name_part text;
  rest text;
  state_name text;
  abbrevs text[] := ARRAY[
    'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia','ks',
    'ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj','nm','ny',
    'nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt','va','wa','wv',
    'wi','wy','dc'
  ];
BEGIN
  cleaned := replace(cleaned, '.', '');
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  IF position(',' in cleaned) > 0 THEN
    name_part := regexp_replace(btrim(split_part(cleaned, ',', 1)), '\s+', ' ', 'g');
    RETURN NULLIF(name_part, '');
  END IF;

  SELECT state INTO state_name
  FROM unnest(ARRAY[
    'district of columbia','north carolina','north dakota','south carolina','south dakota',
    'west virginia','new hampshire','new jersey','new mexico','new york','rhode island',
    'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
    'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas',
    'kentucky','louisiana','maine','maryland','massachusetts','michigan','minnesota',
    'mississippi','missouri','montana','nebraska','nevada','ohio','oklahoma','oregon',
    'pennsylvania','tennessee','texas','utah','vermont','virginia','washington',
    'wisconsin','wyoming'
  ]) AS state
  WHERE right(cleaned, length(state) + 1) = ' ' || state
  ORDER BY length(state) DESC
  LIMIT 1;

  IF state_name IS NOT NULL THEN
    name_part := btrim(left(cleaned, length(cleaned) - length(state_name)));
    IF name_part <> '' THEN
      RETURN regexp_replace(name_part, '\s+', ' ', 'g');
    END IF;
  END IF;

  rest := regexp_replace(cleaned, '^.* ', '');
  IF position(' ' in cleaned) > 0 AND rest = ANY(abbrevs) THEN
    name_part := btrim(left(cleaned, length(cleaned) - length(rest)));
    IF name_part <> '' THEN
      RETURN regexp_replace(name_part, '\s+', ' ', 'g');
    END IF;
  END IF;

  RETURN cleaned;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_creators BIGINT,
  total_projects BIGINT,
  total_events BIGINT,
  total_cities BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles WHERE display_name IS NOT NULL)::BIGINT,
    (SELECT COUNT(*) FROM projects WHERE status IN ('open', 'in_progress', 'completed'))::BIGINT,
    (SELECT COUNT(*) FROM events WHERE is_public = true)::BIGINT,
    (
      SELECT COUNT(DISTINCT grouped.city_name)::BIGINT
      FROM (
        SELECT CASE
          WHEN p.city_key IS NOT NULL AND position('|' in p.city_key) > 0
            THEN split_part(lower(btrim(p.city_key)), '|', 1)
          ELSE public.canonical_city_name(p.city)
        END AS city_name
        FROM profiles p
      ) grouped
      WHERE grouped.city_name IS NOT NULL AND grouped.city_name <> ''
    );
END;
$fn$;

-- Fill missing keys only. Do not overwrite a key the app already stored, and
-- do not change the city text members typed.
UPDATE public.profiles
SET city_key = public.canonical_city_name(city)
WHERE city IS NOT NULL
  AND btrim(city) <> ''
  AND (city_key IS NULL OR btrim(city_key) = '')
  AND public.canonical_city_name(city) IS NOT NULL;
