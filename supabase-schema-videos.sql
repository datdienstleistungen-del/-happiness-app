-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  caption TEXT,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Video likes table
CREATE TABLE IF NOT EXISTS video_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(video_id, user_id)
);

-- Video comments table
CREATE TABLE IF NOT EXISTS video_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS policies
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

-- Videos policies
CREATE POLICY "Videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Users can insert their own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own videos" ON videos FOR DELETE USING (auth.uid() = user_id);

-- Video likes policies
CREATE POLICY "Video likes are viewable by everyone" ON video_likes FOR SELECT USING (true);
CREATE POLICY "Users can like videos" ON video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike videos" ON video_likes FOR DELETE USING (auth.uid() = user_id);

-- Video comments policies
CREATE POLICY "Video comments are viewable by everyone" ON video_comments FOR SELECT USING (true);
CREATE POLICY "Users can comment on videos" ON video_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON video_comments FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for videos
-- Go to Supabase Dashboard > Storage > New bucket
-- Bucket name: videos
-- Public: Yes
-- File size limit: 50 MB
-- Allowed MIME types: video/mp4, video/quicktime, video/x-msvideo, video/webm
