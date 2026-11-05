-- NULL means not yet classified. Never assume existing products are physical.
ALTER TABLE public.store_items ADD COLUMN IF NOT EXISTS is_digital boolean;
COMMENT ON COLUMN public.store_items.is_digital IS 'true: digital content; false: physical goods or real-world services; null: unclassified (no iOS checkout)';
GRANT SELECT (is_digital) ON public.store_items TO anon;
