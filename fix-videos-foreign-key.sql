-- Fix videos table foreign key
-- Fuehre dies im Supabase SQL Editor aus

-- 1. Alten Foreign Key entfernen
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_user_id_fkey;

-- 2. Neuen Foreign Key auf auth.users setzen
ALTER TABLE videos ADD CONSTRAINT videos_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Fehlende Profiles erstellen
INSERT INTO profiles (id, name, username, email)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  split_part(au.email, '@', 1),
  au.email
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. RLS Policies fuer videos (falls nicht vorhanden)
-- Videos policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Videos: Alle lesen' AND tablename = 'videos') THEN
    CREATE POLICY "Videos: Alle lesen" ON videos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Videos: Erstellen' AND tablename = 'videos') THEN
    CREATE POLICY "Videos: Erstellen" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Videos: Eigene loeschen' AND tablename = 'videos') THEN
    CREATE POLICY "Videos: Eigene loeschen" ON videos FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
