CREATE TABLE IF NOT EXISTS daily_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hook TEXT NOT NULL,
  script TEXT NOT NULL,
  hashtags TEXT[] NOT NULL,
  best_time TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'tiktok',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, package_date)
);

ALTER TABLE daily_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily packages"
  ON daily_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily packages"
  ON daily_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily packages"
  ON daily_packages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_daily_packages_user_date ON daily_packages(user_id, package_date DESC);
