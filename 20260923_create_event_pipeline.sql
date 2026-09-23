-- ====================================
-- NEXUS 2.0: Business Event Pipeline
-- Offering-unabhängige Event-Schicht
-- Created: 2026-09-23
-- Status: Phase 0 Implementation
-- ====================================

-- 1. Business Events (zentrale Entität)
CREATE TABLE IF NOT EXISTS nexus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_subtype TEXT,
    title TEXT NOT NULL,
    description TEXT,

    company_id UUID REFERENCES nexus_companies(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    company_domain TEXT,

    country TEXT,
    region TEXT,
    city TEXT,

    event_date TIMESTAMPTZ,
    detected_at TIMESTAMPTZ DEFAULT NOW(),

    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    verification_status TEXT DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified','verifying','verified','rejected','insufficient_data')),

    status TEXT DEFAULT 'new' CHECK (status IN ('new','enriched','packaged','exported')),

    source_count INTEGER DEFAULT 0,
    raw_event_ids UUID[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_events_user ON nexus_events(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_events_type ON nexus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_nexus_events_company ON nexus_events(company_id);
CREATE INDEX IF NOT EXISTS idx_nexus_events_status ON nexus_events(verification_status);
CREATE INDEX IF NOT EXISTS idx_nexus_events_date ON nexus_events(event_date DESC);

ALTER TABLE nexus_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON nexus_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON nexus_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON nexus_events
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON nexus_events
    FOR DELETE USING (auth.uid() = user_id);

-- 2. Lead Packages (verkaufsfähige Zusammenstellung)
CREATE TABLE IF NOT EXISTS nexus_lead_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    event_id UUID REFERENCES nexus_events(id) ON DELETE CASCADE,
    company_id UUID REFERENCES nexus_companies(id) ON DELETE SET NULL,

    headline TEXT NOT NULL,
    summary TEXT,
    why_relevant TEXT,

    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    completeness NUMERIC(3,2) CHECK (completeness >= 0 AND completeness <= 1),
    source_count INTEGER DEFAULT 0,
    has_contact BOOLEAN DEFAULT FALSE,

    evidence JSONB DEFAULT '[]',
    contacts JSONB DEFAULT '[]',
    company_data JSONB,

    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','ready','exported','sold')),

    offering_id UUID REFERENCES nexus_offerings(id) ON DELETE SET NULL,
    offering_fit_score INTEGER,
    opportunity_id UUID REFERENCES nexus_opportunities(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_user ON nexus_lead_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_event ON nexus_lead_packages(event_id);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_status ON nexus_lead_packages(status);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_quality ON nexus_lead_packages(quality_score DESC);

ALTER TABLE nexus_lead_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lead packages" ON nexus_lead_packages
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lead packages" ON nexus_lead_packages
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lead packages" ON nexus_lead_packages
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lead packages" ON nexus_lead_packages
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Kosten-Tracking
CREATE TABLE IF NOT EXISTS nexus_cost_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES nexus_events(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nexus_cost_log_user ON nexus_cost_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_cost_log_date ON nexus_cost_log(created_at DESC);

-- 4. Event-Type-Definitionen (Seed Data)
CREATE TABLE IF NOT EXISTS nexus_event_type_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT UNIQUE NOT NULL,
    label_de TEXT NOT NULL,
    label_en TEXT NOT NULL,
    description_de TEXT,
    description_en TEXT,
    search_hints JSONB DEFAULT '[]',
    example_queries JSONB DEFAULT '[]',
    icon TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO nexus_event_type_definitions (event_key, label_de, label_en, description_de, description_en, icon, sort_order) VALUES
('expansion', 'Expansion', 'Expansion', 'Unternehmen erweitert Standorte, Produktion oder Kapazitäten', 'Company expands locations, production or capacity', 'Building2', 1),
('hiring', 'Große Einstellungen', 'Major Hiring', 'Unternehmen stellt signifikant mehr Mitarbeiter ein', 'Company significantly increases headcount', 'Users', 2),
('investment', 'Investition', 'Investment', 'Unternehmen erhält Finanzierung oder investiert selbst', 'Company receives funding or makes investments', 'TrendingUp', 3),
('founding', 'Gründung', 'Founding', 'Neues Unternehmen wird gegründet oder Tochtergesellschaft etabliert', 'New company founded or subsidiary established', 'Rocket', 4),
('merger_acquisition', 'Fusion / Übernahme', 'Merger / Acquisition', 'Unternehmen fusioniert oder wird übernommen', 'Companies merge or acquisition occurs', 'GitMerge', 5),
('product_launch', 'Produktstart', 'Product Launch', 'Unternehmen launcht neues Produkt oder Dienstleistung', 'Company launches new product or service', 'Package', 6),
('partnership', 'Partnerschaft', 'Partnerschaft', 'Unternehmen geht strategische Partnerschaft ein', 'Company forms strategic partnership', 'Handshake', 7),
('leadership_change', 'Führungswechsel', 'Leadership Change', 'Wechsel in der Geschäftsführung oder Führungsebene', 'Change in executive management or leadership', 'Crown', 8),
('sustainability', 'Nachhaltigkeit', 'Sustainability', 'Unternehmen investiert in Nachhaltigkeit oder ESG', 'Company invests in sustainability or ESG', 'Leaf', 9),
('regulatory', 'Regulatorisch', 'Regulatory', 'Behördliche Genehmigungen, Ausschreibungen, Regulierung', 'Government approvals, tenders, regulation', 'Shield', 10)
ON CONFLICT (event_key) DO NOTHING;

-- 5. V2 filter_profiles: offering_id NULLABLE machen
ALTER TABLE nexus_filter_profiles
    DROP CONSTRAINT IF EXISTS nexus_filter_profiles_offering_id_fkey;

ALTER TABLE nexus_filter_profiles
    ADD CONSTRAINT nexus_filter_profiles_offering_id_fkey
    FOREIGN KEY (offering_id) REFERENCES nexus_offerings(id) ON DELETE SET NULL;
