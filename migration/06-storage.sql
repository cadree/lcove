-- ============================================
-- ETHER Migration: Storage Buckets
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- ============================================
-- CREATE STORAGE BUCKETS
-- ============================================

-- Media bucket (public) - for user uploads, posts, stories, etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav']
) ON CONFLICT (id) DO NOTHING;

-- Contact avatars bucket (private) - for pipeline contact avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-avatars',
  'contact-avatars',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Contact media bucket (public) - for pipeline media attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-media',
  'contact-media',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Board uploads bucket (public) - for board item attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-uploads',
  'board-uploads',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Media bucket policies
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "Anyone can view media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Contact avatars bucket policies (private)
CREATE POLICY "Users can upload contact avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contact-avatars');

CREATE POLICY "Users can view own contact avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contact-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own contact avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contact-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own contact avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contact-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Contact media bucket policies
CREATE POLICY "Users can upload contact media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contact-media');

CREATE POLICY "Anyone can view contact media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contact-media');

CREATE POLICY "Users can update own contact media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contact-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own contact media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contact-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Board uploads bucket policies
CREATE POLICY "Board members can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'board-uploads');

CREATE POLICY "Anyone can view board uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'board-uploads');

CREATE POLICY "Users can update own board uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'board-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own board uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'board-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
