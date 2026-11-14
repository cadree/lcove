-- Store catalog import status, and link cards for sites that are not Shopify.
-- Apply this in the Supabase SQL editor. Do not run it from the app.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS import_status text,
  ADD COLUMN IF NOT EXISTS import_error text,
  ADD COLUMN IF NOT EXISTS import_count integer,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_import_status_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_import_status_check
  CHECK (
    import_status IS NULL
    OR import_status IN ('importing', 'imported', 'link', 'failed')
  );

ALTER TABLE public.store_items
  DROP CONSTRAINT IF EXISTS store_items_external_source_check;

ALTER TABLE public.store_items
  ADD CONSTRAINT store_items_external_source_check
  CHECK (
    external_source IS NULL
    OR external_source IN ('shopify', 'link')
  );

COMMENT ON COLUMN public.stores.import_status IS
  'Catalog import result: importing, imported, link, or failed.';
COMMENT ON COLUMN public.stores.website_url IS
  'Store website entered at setup. Shopify catalogs also keep shopify_store_url.';
