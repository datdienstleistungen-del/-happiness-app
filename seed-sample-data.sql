-- ============================================
-- SAMPLE DATA FÜR HAPPINESS APP
-- Im Supabase SQL Editor ausführen (als admin)
-- ============================================

-- 0. Fehlende Tabellen erstellen (falls nicht vorhanden)
CREATE TABLE IF NOT EXISTS housing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  location TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE housing ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Housing: Alle lesen') THEN
    CREATE POLICY "Housing: Alle lesen" ON housing FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Housing: Erstellen') THEN
    CREATE POLICY "Housing: Erstellen" ON housing FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Housing: Eigene bearbeiten') THEN
    CREATE POLICY "Housing: Eigene bearbeiten" ON housing FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Housing: Eigene löschen') THEN
    CREATE POLICY "Housing: Eigene löschen" ON housing FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 1. Demo-User erstellen (Passwort: Demo1234!)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'demo@happiness-app.de',
  crypt('Demo1234!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '', ''
) ON CONFLICT (id) DO NOTHING;

-- 2. Demo-Profil erstellen
INSERT INTO profiles (id, name, username, email, bio, role) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Happiness Demo',
  'happiness_demo',
  'demo@happiness-app.de',
  'Dies ist ein Demo-Account der Happiness App. Willkommen!',
  'admin'
) ON CONFLICT (id) DO NOTHING;

-- 3. Beispiel-Marketplace-Anzeigen
INSERT INTO marketplace (user_id, title, description, price, category) VALUES
('a0000000-0000-0000-0000-000000000001', 'Beispiel: iPhone 14 Pro — Top Zustand', 'Das iPhone 14 Pro ist in einem einwandfreien Zustand. Keine Kratzer, original Verpackung dabei.', 450.00, 'Elektronik'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: IKEA Couch — Weiß, 3-Sitzer', 'Schöne weiße Couch von IKEA. Wurde nur wenig benutzt, sieht aus wie neu.', 280.00, 'Möbel'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Fahrrad — Mountainbike 28 Zoll', 'Gutes Mountainbike mit 28 Zoll. Perfekt für die Stadt und leichtes Gelände.', 180.00, 'Fahrzeuge'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Playstation 5 + 2 Controller', 'PS5 mit zwei Original-Controllern. Konsole läuft einwandfrei. Dazu 3 Spiele gratis.', 380.00, 'Elektronik'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Bücher-Sammlung — 20 Romane', 'Verschiedene Romane von Bestsellerautoren. Alle Bücher in gutem Zustand.', 25.00, 'Sonstiges');

-- 4. Beispiel-Jobs
INSERT INTO jobs (user_id, title, description, location, job_type, contact) VALUES
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Tischler/in gesucht', 'Wir suchen eine/n Tischler/in für unsere Werkstatt in Wilhelmshaven. Erfahrung erwünscht.', 'Wilhelmshaven', 'Vollzeit', 'jobs@happiness-app.de'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Homeoffice — Webentwickler', 'Wir suchen eine/n Webentwickler/in für Remote-Arbeit. React und Node.js Kenntnisse sind von Vorteil.', 'Remote', 'Teilzeit', 'jobs@happiness-app.de'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Praktikum im Marketing', 'Interessiert an Social Media? Wir bieten ein Praktikum in unserem Marketing-Team.', 'Hamburg', 'Praktikum', 'praktikum@happiness-app.de'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Reinigungskraft gesucht', 'Suchen Sie eine Arbeit als Reinigungskraft? Büroreinigung, 20 Std./Woche.', 'Bremen', 'Teilzeit', 'reinigung@happiness-app.de');

-- 5. Beispiel-Kurse
INSERT INTO courses (user_id, title, description, category, duration, price, max_participants) VALUES
('a0000000-0000-0000-0000-000000000001', 'Beispiel: HTML & CSS Grundkurs', 'Lernen Sie die Grundlagen von HTML und CSS. Perfekt für Einsteiger. 8 Wochen, 2x pro Woche.', 'IT & Technik', '8 Wochen', 49.99, 20),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Yoga für Anfänger', 'Entspannen und fit werden mit Yoga. Ideal für Einsteiger. Kleine Gruppen.', 'Gesundheit', '6 Wochen', 39.99, 12),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Kochkurs — Italienische Küche', 'Lernen Sie die besten italienischen Rezepte. Pasta, Pizza und mehr.', 'Kochen', '4 Wochen', 59.99, 10),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Englisch A2 Kurs', 'Verbessern Sie Ihre Englischkenntnisse. Interaktiver Unterricht mit Native Speakers.', 'Sprachen', '10 Wochen', 69.99, 15);

-- 6. Beispiel-Wohnungen
INSERT INTO housing (user_id, title, description, price, location) VALUES
('a0000000-0000-0000-0000-000000000001', 'Beispiel: 2-Zimmer-Wohnung in Berlin Mitte', 'Schöne 2-Zimmer-Wohnung im Herzen Berlins. 65 qm, modern saniert, EBK vorhanden.', 850.00, 'Berlin'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: WG-Zimmer in Hamburg', 'Cooles WG-Zimmer in einer 3er-WG. 18 qm, gemütlich eingerichtet.', 420.00, 'Hamburg'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: 3-Zimmer-Wohnung in München', 'Geräumige 3-Zimmer-Wohnung für Familien. 95 qm, Balkon, Keller.', 1200.00, 'München'),
('a0000000-0000-0000-0000-000000000001', 'Beispiel: Tiny House auf dem Land', 'Ihr eigenes Tiny House! 30 qm, komplett eingerichtet, nachhaltig gebaut.', 650.00, 'Schleswig-Holstein');

-- 7. Beispiel-Posts (Community)
INSERT INTO posts (user_id, content) VALUES
('a0000000-0000-0000-0000-000000000001', 'Willkommen bei der Happiness App! Ich freue mich, dass Sie hier sind. Stöbern Sie durch die Angebote und vernetzen Sie sich mit anderen Nutzern.'),
('a0000000-0000-0000-0000-000000000001', 'Tipp: Nutzen Sie die KI-Assistentin, um Antworten auf Ihre Fragen zu erhalten. Nach 20 kostenlosen Fragen können Sie Premium für nur 4,99Euro/Monat freischalten.');

-- Fertig!
SELECT 'Erfolgreich! Demo-Daten eingefuegt.' AS status;
