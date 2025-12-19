-- Add normalized city fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS city_display text,
ADD COLUMN IF NOT EXISTS city_key text;

-- Create index on city_key for faster filtering/grouping
CREATE INDEX IF NOT EXISTS idx_profiles_city_key ON public.profiles(city_key);

-- Backfill existing data: normalize current city values
-- This creates city_key as lowercase, trimmed, with multiple spaces collapsed
-- and city_display as Title Case version
UPDATE public.profiles 
SET 
  city_display = INITCAP(TRIM(REGEXP_REPLACE(city, '\s+', ' ', 'g'))),
  city_key = LOWER(TRIM(REGEXP_REPLACE(city, '\s+', ' ', 'g')))
WHERE city IS NOT NULL AND city != '' AND city_key IS NULL;