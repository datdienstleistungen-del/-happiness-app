-- ============================================
-- NeXus Elite Enrichment: Schema-Erweiterungen
-- ============================================

-- 1. Lead Packages: package_tier hinzufügen
ALTER TABLE nexus_lead_packages
    ADD COLUMN IF NOT EXISTS package_tier TEXT DEFAULT 'standard'
    CHECK (package_tier IN ('standard', 'elite'));

-- Index für schnelle Tier-Abfragen
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_tier ON nexus_lead_packages(package_tier);

-- 2. API Usage: Elite-spezifischen Zähler hinzufügen
ALTER TABLE nexus_api_usage
    ADD COLUMN IF NOT EXISTS elite_calls_today INTEGER DEFAULT 0;
