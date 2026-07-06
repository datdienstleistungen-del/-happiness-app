-- ============================================
-- REACTIONS TABELLE
-- ============================================

CREATE TABLE reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text DEFAULT 'like' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer koennen alle Reaktionen sehen"
  ON reactions FOR SELECT
  USING (true);

CREATE POLICY "Nutzer koennen eigene Reaktion erstellen"
  ON reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer koennen eigene Reaktion loeschen"
  ON reactions FOR DELETE
  USING (auth.uid() = user_id);
