
-- Make foreign keys nullable so custom entries don't need a predefined item
ALTER TABLE public.user_skills ALTER COLUMN skill_id DROP NOT NULL;
ALTER TABLE public.user_passions ALTER COLUMN passion_id DROP NOT NULL;
ALTER TABLE public.user_creative_roles ALTER COLUMN role_id DROP NOT NULL;

-- Add custom_name column for user-created entries
ALTER TABLE public.user_skills ADD COLUMN custom_name TEXT;
ALTER TABLE public.user_passions ADD COLUMN custom_name TEXT;
ALTER TABLE public.user_creative_roles ADD COLUMN custom_name TEXT;
