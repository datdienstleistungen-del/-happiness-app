-- Schritt 3: Videos RLS sichern
-- Erst die offenen Policies loeschen, dann sichere erstellen

-- Alte weite Policies entfernen
DROP POLICY IF EXISTS "videos_insert_all" ON videos;
DROP POLICY IF EXISTS "videos_select_all" ON videos;
DROP POLICY IF EXISTS "videos_update_all" ON videos;
DROP POLICY IF EXISTS "videos_delete_all" ON videos;

-- Sichere Policies: Nur eigene Videos
CREATE POLICY "videos_insert_own" ON videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "videos_select_public" ON videos FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "videos_update_own" ON videos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "videos_delete_own" ON videos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
