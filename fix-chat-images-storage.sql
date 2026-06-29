-- Fix chat-images storage bucket and RLS policies
-- Run this in Supabase Dashboard > SQL Editor

-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-images', 'chat-images', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Upload own chat-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat-images" ON storage.objects;

-- Simple policies: any logged-in user can upload, anyone can read
CREATE POLICY "chat-images-insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');

CREATE POLICY "chat-images-select" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');
