-- Onboarding: Spalten für neue Nutzer
-- Führe dieses Script in der Supabase SQL Editor aus

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_choice TEXT;
