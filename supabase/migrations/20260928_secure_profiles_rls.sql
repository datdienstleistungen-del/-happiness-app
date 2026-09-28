-- ============================================================================
-- Phase 1a: profiles-Rundumschutz (Anon-Leak-Fix)
-- BEWEIS: Anon-Key gab ohne Login Name, username, role='admin', banned,
-- last_seen zurueck (Live-Probe 28.09.2026, GET /rest/v1/profiles?select=*)
-- AUSGEFUEHRT am 28.09.2026 im Supabase Dashboard SQL Editor.
-- Verifikation (Anon-Rest-API, 28.09.2026):
--   B' select=*        -> 401 permission denied for table profiles  [LEAK ZU]
--   C' select=id,username -> 200 mit Daten                         [SIGNUP-CHECK LEBT]
-- Deckt beide Ist-Zustaende ab (RLS an + undokumentierte Policy, oder RLS aus)
-- ============================================================================

-- 1. ALLE bestehenden Policies entfernen (auch unbekannte Dashboards-Policies)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Recursion-sichere Helfer (SECURITY DEFINER -> umgehen RLS im Inneren,
--    verhindert "infinite recursion" der alten Admin-Policy)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT EXISTS (SELECT 1 FROM public.profiles
                  WHERE id = auth.uid() AND role = 'admin') $$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
  LANGUAGE sql SECURITY DEFINER STABLE AS
$$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

-- 3. Eingeloggte: voller Lesezugriff (Feed, Friends, AdminPage, Username-Check
--    in ProfilePage laeuft authentifiziert)
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 4. ANON: AUSSCHLIESSLICH Username-Verfuegbarkeits-Check beim Signup
--    (AuthModal.jsx:48-52 laeuft VOR Login = Rolle anon)
--    Spaltenscharf: GRANT wirkt auf Spalten, RLS auf Zeilen -> Kombi
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, username) ON public.profiles TO anon;
CREATE POLICY "profiles_select_anon_signup" ON public.profiles
  FOR SELECT TO anon USING (true);

-- 5. Eigene Zeile anlegen/aendern; Rollen-Sperre via WITH CHECK
--    (Eskalation wie 20260715_fix_privilege_escalation gesichert:
--     eigenes UPDATE mit role='admin' -> role <> get_my_role() -> ABGELEHNT)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.get_my_role());

-- 6. Admins (AdminPage:55/60 banned/role updates auf fremde Zeilen)
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- VERIFIKATION:
-- A) Signup-Trigger:
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
-- B) Anon-Leak (ALS ANON via REST pruefen, NICHT im SQL Editor!):
--    GET /rest/v1/profiles?select=* mit anon-Key -> 401 erwartet
-- C) Signup-Check (ALS ANON via REST):
--    GET /rest/v1/profiles?select=id,username -> 200 erwartet
-- ============================================================
