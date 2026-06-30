-- Add image_url column to posts and marketplace
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE marketplace ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- Create storage bucket for community/marketplace images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-images', 'community-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "community-images-insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'community-images' AND auth.role() = 'authenticated');

CREATE POLICY "community-images-select" ON storage.objects FOR SELECT
  USING (bucket_id = 'community-images');
