-- Add Instagram fields to pipeline_items
ALTER TABLE public.pipeline_items
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS instagram_followers integer,
ADD COLUMN IF NOT EXISTS instagram_posts integer,
ADD COLUMN IF NOT EXISTS instagram_bio text,
ADD COLUMN IF NOT EXISTS instagram_profile_image_url text,
ADD COLUMN IF NOT EXISTS instagram_verified_status text DEFAULT 'unverified';

-- Create storage bucket for contact avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-avatars', 'contact-avatars', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for contact-avatars bucket
CREATE POLICY "Users can upload own contact avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own contact avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own contact avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contact-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own contact avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'contact-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);