-- Public event links: /e/{slug}
--
-- Not applied automatically. Run this in the Supabase SQL editor for
-- ether-prod (and the preview project, if that database should share links).
-- Old /event/{uuid} URLs keep working. The Pages function redirects them
-- once this function returns a public card.
--
-- A slug is chosen from the event name when the row is inserted and then
-- left alone, so a shared link does not change when the title is edited.
-- private, draft, and cancelled rows are not returned to anon or to crawlers.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug text;

COMMENT ON COLUMN public.events.slug IS
  'Stable public path segment for /e/{slug}. Set on insert. Private, draft, and cancelled events still have one, but public_event_share does not reveal it.';

CREATE OR REPLACE FUNCTION public.slugify_event_name(p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(
      left(trim(both '-' from regexp_replace(lower(COALESCE(p_title, '')), '[^a-z0-9]+', '-', 'g')), 60),
      ''
    ),
    'event'
  );
$$;

REVOKE ALL ON FUNCTION public.slugify_event_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slugify_event_name(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 2;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND btrim(OLD.slug) <> '' THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    base := public.slugify_event_name(NEW.slug);
  ELSE
    base := public.slugify_event_name(NEW.title);
  END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.events
    WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
  ) LOOP
    IF n > 100 THEN
      candidate := base || '-' || substr(replace(COALESCE(NEW.id::text, ''), '-', ''), 1, 8);
      EXIT;
    END IF;
    candidate := base || '-' || n;
    n := n + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_assign_slug ON public.events;
CREATE TRIGGER events_assign_slug
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_event_slug();

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id
    FROM public.events
    WHERE slug IS NULL OR btrim(slug) = ''
    ORDER BY created_at, id
  LOOP
    UPDATE public.events
    SET slug = NULL
    WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.events
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_unique ON public.events (slug);

GRANT SELECT (slug) ON public.events TO anon;

CREATE OR REPLACE FUNCTION public.public_event_share(p_ref text)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  host_name text,
  start_date timestamptz,
  timezone text,
  venue text,
  city text,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.slug,
    e.title,
    COALESCE(NULLIF(btrim(b.organizer_name), ''), NULLIF(btrim(p.display_name), ''), 'Host') AS host_name,
    e.start_date,
    e.timezone,
    e.venue,
    e.city,
    e.image_url
  FROM public.events e
  LEFT JOIN public.event_email_branding b ON b.event_id = e.id
  LEFT JOIN public.profiles p ON p.user_id = e.creator_id
  WHERE e.is_public IS TRUE
    AND e.status IS DISTINCT FROM 'draft'
    AND e.status IS DISTINCT FROM 'cancelled'
    AND e.slug IS NOT NULL
    AND (
      e.slug = p_ref
      OR (
        p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND e.id = p_ref::uuid
      )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_event_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_share(text) TO anon, authenticated;

COMMENT ON FUNCTION public.public_event_share(text) IS
  'Crawler card for a public event that is not a draft or cancelled. Returns no row otherwise, so the Pages function cannot leak the name, date, venue, or flyer.';
