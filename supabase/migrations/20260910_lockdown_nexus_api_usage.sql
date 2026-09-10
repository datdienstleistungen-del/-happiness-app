-- =============================================================================
-- NeXus API Usage RLS – Rate-Limit-Sicherung
-- Datum: 2026-09-10
--
-- SCHUTZ: Nutzer dürfen eigene Usage-Zeile NUR lesen (SELECT).
--         Schreibvorgänge (INSERT/UPDATE) nur über Service-Key (Backend).
--         Verhinderung: Nutzer setzt requests_today manuell auf 0.
--
-- ADMIN-BYPASS: Harro Goerndt (harro@happiness.de) darf alles.
-- =============================================================================

BEGIN;

-- Alte Policies entfernen (falls vorhanden)
DROP POLICY IF EXISTS "nexus_api_usage: user can select own" ON nexus_api_usage;
DROP POLICY IF EXISTS "nexus_api_usage: user can insert own" ON nexus_api_usage;
DROP POLICY IF EXISTS "nexus_api_usage: user can update own" ON nexus_api_usage;
DROP POLICY IF EXISTS "nexus_api_usage: user can delete own" ON nexus_api_usage;

-- 1. SELECT: Nutzer darf eigene Zeile lesen
CREATE POLICY "nexus_api_usage: user can select own" 
  ON nexus_api_usage 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 2. INSERT: Nur Service-Key (kein INSERT-Policy = verboten für User)
-- Keine Policy erstellen → Service-Key bypassed RLS automatisch

-- 3. UPDATE: Nur Service-Key (kein UPDATE-Policy = verboten für User)
-- Keine Policy erstellen → Service-Key bypassed RLS automatisch

-- 4. DELETE: Keine Policy → verboten

ALTER TABLE nexus_api_usage ENABLE ROW LEVEL SECURITY;

-- PostgREST Schema Cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
