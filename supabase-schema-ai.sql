-- AI Profiles Table
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

-- AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- AI Chat Settings Table
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  language TEXT DEFAULT 'de',
  ai_personality TEXT DEFAULT 'freundlich',
  data_consent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_profiles
CREATE POLICY "Users can view own ai profile" ON ai_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai profile" ON ai_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai profile" ON ai_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai profile" ON ai_profiles FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_conversations
CREATE POLICY "Users can view own conversations" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_settings
CREATE POLICY "Users can view own ai settings" ON ai_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai settings" ON ai_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai settings" ON ai_settings FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_ai_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_profiles
CREATE TRIGGER update_ai_profiles_updated_at
  BEFORE UPDATE ON ai_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_profiles_updated_at();