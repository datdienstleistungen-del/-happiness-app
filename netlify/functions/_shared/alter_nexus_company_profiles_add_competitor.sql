-- ALTER TABLE: Competitor-Check + Lead-Exclusion
-- Führen Sie dies im Supabase Dashboard SQL Editor aus.

-- 1. Competitor-Spalten für nexus_company_profiles
ALTER TABLE nexus_company_profiles
  ADD COLUMN IF NOT EXISTS is_competitor boolean not null default false,
  ADD COLUMN IF NOT EXISTS competitor_reason text,
  ADD COLUMN IF NOT EXISTS competitor_category text;

-- 2. Lead-Exclusion: 'excluded' zum CHECK constraint hinzufügen
ALTER TABLE nexus_lead_packages DROP CONSTRAINT IF EXISTS nexus_lead_packages_status_check;
ALTER TABLE nexus_lead_packages ADD CONSTRAINT nexus_lead_packages_status_check
  CHECK (status IN ('draft','ready','exported','sold','excluded'));

-- 3. exclusion_reason Spalte für Lead-Packages
ALTER TABLE nexus_lead_packages
  ADD COLUMN IF NOT EXISTS exclusion_reason text;
