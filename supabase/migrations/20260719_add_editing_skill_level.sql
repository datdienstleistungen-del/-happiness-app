-- Add editing_skill_level to profiles
-- Idempotent: safe to run multiple times

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS editing_skill_level TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'editing_skill_level_check'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT editing_skill_level_check
    CHECK (editing_skill_level IN ('beginner', 'intermediate', 'pro'));
  END IF;
END $$;
