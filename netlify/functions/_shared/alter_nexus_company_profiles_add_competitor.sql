-- ALTER TABLE: Competitor-Check Columns für nexus_company_profiles
-- Führen Sie dies im Supabase Dashboard SQL Editor aus.

ALTER TABLE nexus_company_profiles
  ADD COLUMN IF NOT EXISTS is_competitor boolean not null default false,
  ADD COLUMN IF NOT EXISTS competitor_reason text,
  ADD COLUMN IF NOT EXISTS competitor_category text;
