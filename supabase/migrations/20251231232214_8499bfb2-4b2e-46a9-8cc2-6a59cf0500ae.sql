-- Add external_url column to portfolio_items for linking external work
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Add thumbnail_url for external links that don't have media
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;