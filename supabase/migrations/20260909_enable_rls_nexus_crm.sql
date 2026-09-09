-- =============================================================================
-- NeXus CRM RLS Activation – nexus_companies, nexus_contacts, nexus_company_offerings
-- Datum: 2026-09-09
--
-- SCHUTZ: Realnamen, Kontaktdaten und Offerings dürfen nur vom eigenen User
--         gelesen werden. Service-Role (sb_secret_*) bypassed RLS automatisch.
--
-- TECHNIK:
--   - Policies IF NOT EXISTS → idempotent
--   - ENABLE ROW LEVEL SECURITY am Ende → kein Zwischenzustand
--   - nexus_company_offerings: M:N-Tabelle ohne eigene user_id → EXISTS-Join
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. nexus_companies – user_id existiert → einfaches Pattern
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_companies' AND policyname='nexus_companies: user can select own') THEN
    CREATE POLICY "nexus_companies: user can select own" ON nexus_companies FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_companies' AND policyname='nexus_companies: user can insert own') THEN
    CREATE POLICY "nexus_companies: user can insert own" ON nexus_companies FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_companies' AND policyname='nexus_companies: user can update own') THEN
    CREATE POLICY "nexus_companies: user can update own" ON nexus_companies FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_companies' AND policyname='nexus_companies: user can delete own') THEN
    CREATE POLICY "nexus_companies: user can delete own" ON nexus_companies FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE nexus_companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. nexus_contacts – user_id existiert → einfaches Pattern
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_contacts' AND policyname='nexus_contacts: user can select own') THEN
    CREATE POLICY "nexus_contacts: user can select own" ON nexus_contacts FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_contacts' AND policyname='nexus_contacts: user can insert own') THEN
    CREATE POLICY "nexus_contacts: user can insert own" ON nexus_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_contacts' AND policyname='nexus_contacts: user can update own') THEN
    CREATE POLICY "nexus_contacts: user can update own" ON nexus_contacts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_contacts' AND policyname='nexus_contacts: user can delete own') THEN
    CREATE POLICY "nexus_contacts: user can delete own" ON nexus_contacts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE nexus_contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. nexus_company_offerings – M:N-Tabelle, KEINE eigene user_id
--    → EXISTS-Join über nexus_companies.user_id
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_company_offerings' AND policyname='nexus_company_offerings: user can select via company') THEN
    CREATE POLICY "nexus_company_offerings: user can select via company" ON nexus_company_offerings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM nexus_companies
          WHERE nexus_companies.id = nexus_company_offerings.company_id
            AND nexus_companies.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_company_offerings' AND policyname='nexus_company_offerings: user can insert via company') THEN
    CREATE POLICY "nexus_company_offerings: user can insert via company" ON nexus_company_offerings
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM nexus_companies
          WHERE nexus_companies.id = nexus_company_offerings.company_id
            AND nexus_companies.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_company_offerings' AND policyname='nexus_company_offerings: user can update via company') THEN
    CREATE POLICY "nexus_company_offerings: user can update via company" ON nexus_company_offerings
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM nexus_companies
          WHERE nexus_companies.id = nexus_company_offerings.company_id
            AND nexus_companies.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nexus_company_offerings' AND policyname='nexus_company_offerings: user can delete via company') THEN
    CREATE POLICY "nexus_company_offerings: user can delete via company" ON nexus_company_offerings
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM nexus_companies
          WHERE nexus_companies.id = nexus_company_offerings.company_id
            AND nexus_companies.user_id = auth.uid()
        )
      );
  END IF;
END $$;

ALTER TABLE nexus_company_offerings ENABLE ROW LEVEL SECURITY;

-- PostgREST Schema Cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
