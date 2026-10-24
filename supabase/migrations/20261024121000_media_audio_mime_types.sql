-- iPhone Files uploads arrive as audio/mp4, audio/flac, audio/aac, or audio/x-m4a.
-- Append those types when the media bucket already has an allow-list.
-- A null allow-list already accepts every type, so this does not create one.

UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT ARRAY(
    SELECT DISTINCT mime
    FROM unnest(
      allowed_mime_types || ARRAY[
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/flac',
        'audio/x-flac',
        'audio/mp4',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'audio/aacp',
        'audio/x-aac'
      ]
    ) AS mime
  )
)
WHERE id = 'media'
  AND allowed_mime_types IS NOT NULL;
