-- ============================================
-- HAPPINESS APP - SUPABASE SCHEMA
-- ============================================

-- 1. Profiles (Nutzerprofile)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Posts (Community-Beiträge)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Likes
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 4. Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Friendships
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- 6. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Marketplace (Marktplatz)
CREATE TABLE marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  category TEXT DEFAULT 'Sonstiges',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Jobs (Jobbörse)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT DEFAULT '',
  job_type TEXT DEFAULT 'Vollzeit',
  contact TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Courses (Kurse)
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Sonstiges',
  duration TEXT DEFAULT '',
  price NUMERIC(10,2) DEFAULT 0,
  max_participants INTEGER DEFAULT 20,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Course Enrollments (Kursanmeldungen)
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) Aktivieren
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS RICHTLINIEN
-- ============================================

-- Profiles: Jeder kann lesen, nur eigene bearbeiten
CREATE POLICY "Profiles: Alle lesen" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: Eigene bearbeiten" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: Erstellen bei Registrierung" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts: Alle lesen, eigene löschen/erstellen
CREATE POLICY "Posts: Alle lesen" ON posts FOR SELECT USING (true);
CREATE POLICY "Posts: Erstellen" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Posts: Eigene löschen" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Likes: Alle lesen, eigene verwalten
CREATE POLICY "Likes: Alle lesen" ON likes FOR SELECT USING (true);
CREATE POLICY "Likes: Erstellen" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes: Eigene löschen" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: Alle lesen, eigene verwalten
CREATE POLICY "Comments: Alle lesen" ON comments FOR SELECT USING (true);
CREATE POLICY "Comments: Erstellen" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments: Eigene löschen" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Friendships: Beteiligte lesen, eigene verwalten
CREATE POLICY "Friendships: Beteiligte lesen" ON friendships FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Friendships: Erstellen" ON friendships FOR INSERT WITH CHECK (auth.uid() = user1_id);
CREATE POLICY "Friendships: Beteiligte aktualisieren" ON friendships FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Friendships: Beteiligte löschen" ON friendships FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Notifications: Nur eigene lesen/verwalten
CREATE POLICY "Notifications: Eigene lesen" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications: Erstellen" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications: Eigene aktualisieren" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Marketplace: Alle lesen, eigene verwalten
CREATE POLICY "Marketplace: Alle lesen" ON marketplace FOR SELECT USING (true);
CREATE POLICY "Marketplace: Erstellen" ON marketplace FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Marketplace: Eigene bearbeiten" ON marketplace FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Marketplace: Eigene löschen" ON marketplace FOR DELETE USING (auth.uid() = user_id);

-- Jobs: Alle lesen, eigene verwalten
CREATE POLICY "Jobs: Alle lesen" ON jobs FOR SELECT USING (true);
CREATE POLICY "Jobs: Erstellen" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Jobs: Eigene bearbeiten" ON jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Jobs: Eigene löschen" ON jobs FOR DELETE USING (auth.uid() = user_id);

-- Courses: Alle lesen, eigene verwalten
CREATE POLICY "Courses: Alle lesen" ON courses FOR SELECT USING (true);
CREATE POLICY "Courses: Erstellen" ON courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Courses: Eigene bearbeiten" ON courses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Courses: Eigene löschen" ON courses FOR DELETE USING (auth.uid() = user_id);

-- Course Enrollments: Alle lesen, eigene verwalten
CREATE POLICY "Enrollments: Alle lesen" ON course_enrollments FOR SELECT USING (true);
CREATE POLICY "Enrollments: Erstellen" ON course_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enrollments: Eigene löschen" ON course_enrollments FOR DELETE USING (auth.uid() = user_id);
