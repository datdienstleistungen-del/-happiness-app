-- Schritt 10: Storage Policy — Pfad-Prefix einschraenken
-- Alte weite INSERT-Policy entfernen
DROP POLICY IF EXISTS "community-images-insert" ON storage.objects;

-- Sichere INSERT-Policy: Nur eigener Ordner + marketplace/ community/ prefix
CREATE POLICY "community-images-insert-secure" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN ('marketplace', 'community')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
