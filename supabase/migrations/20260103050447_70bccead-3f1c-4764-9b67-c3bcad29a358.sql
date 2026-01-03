-- Create a secure function to get platform stats without RLS restrictions
-- This is safe because it only returns aggregate counts, not actual data
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
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE display_name IS NOT NULL)::BIGINT as total_creators,
    (SELECT COUNT(*) FROM projects WHERE status IN ('open', 'in_progress', 'completed'))::BIGINT as total_projects,
    (SELECT COUNT(*) FROM events WHERE is_public = true)::BIGINT as total_events,
    (SELECT COUNT(DISTINCT LOWER(TRIM(city))) FROM profiles WHERE city IS NOT NULL AND city != '')::BIGINT as total_cities;
END;
$$;