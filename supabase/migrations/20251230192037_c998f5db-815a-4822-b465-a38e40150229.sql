-- Simplify pipeline_items to CRM-style contact schema

-- Rename title to name
ALTER TABLE public.pipeline_items RENAME COLUMN title TO name;

-- Drop subtitle (no longer needed)
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS subtitle;

-- Add new contact info fields
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS role text;

-- Add social link fields (plain URLs only)
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS twitter_url text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS website_url text;

-- Add CRM fields
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS priority text CHECK (priority IN ('low', 'medium', 'high'));
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.pipeline_items ADD COLUMN IF NOT EXISTS tags text[];

-- Remove scraping-related columns
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_handle;
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_followers;
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_posts;
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_bio;
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_profile_image_url;
ALTER TABLE public.pipeline_items DROP COLUMN IF EXISTS instagram_verified_status;

-- Notes column already exists, keep it