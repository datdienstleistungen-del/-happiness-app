-- ============================================
-- COMPLETE FIX: All AI tables + missing columns
-- ============================================

-- 1. AI Profiles (create if not exists)
CREATE TABLE IF NOT EXISTS ai_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  family_info JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  location JSONB DEFAULT '{}',
  occupation JSONB DEFAULT '{}',
  interests JSONB DEFAULT '{}',
  health_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. AI Conversations (create if not exists)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. AI Settings (create if not exists)
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  language TEXT DEFAULT 'de',
  ai_personality TEXT DEFAULT 'freundlich',
  data_consent BOOLEAN DEFAULT false,
  questions_used INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  premium_since TIMESTAMPTZ,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Add missing columns to existing tables
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS questions_used INTEGER DEFAULT 0;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ;
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS data_consent BOOLEAN DEFAULT false;

-- 5. Enable RLS
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (drop old ones first to avoid duplicates)
DROP POLICY IF EXISTS "Users can view own ai profile" ON ai_profiles;
DROP POLICY IF EXISTS "Users can insert own ai profile" ON ai_profiles;
DROP POLICY IF EXISTS "Users can update own ai profile" ON ai_profiles;
DROP POLICY IF EXISTS "Users can delete own ai profile" ON ai_profiles;

CREATE POLICY "Users can view own ai profile" ON ai_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai profile" ON ai_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai profile" ON ai_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai profile" ON ai_profiles FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON ai_conversations;

CREATE POLICY "Users can view own conversations" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON ai_conversations FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own ai settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can insert own ai settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can update own ai settings" ON ai_settings;
DROP POLICY IF EXISTS "Users can delete own ai settings" ON ai_settings;

CREATE POLICY "Users can view own ai settings" ON ai_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai settings" ON ai_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai settings" ON ai_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai settings" ON ai_settings FOR DELETE USING (auth.uid() = user_id);
