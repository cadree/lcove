-- Create storage bucket for board uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('board-uploads', 'board-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload board media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'board-uploads' AND auth.uid() IS NOT NULL);

-- Allow public read access for board media
CREATE POLICY "Public read access for board media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'board-uploads');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own board media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'board-uploads' AND auth.uid() IS NOT NULL);