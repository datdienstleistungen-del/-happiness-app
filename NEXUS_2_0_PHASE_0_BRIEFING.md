# PHASE 0 IMPLEMENTIERUNGS-BRIEFING

**Status:** BRIEFING — Noch keine Implementierung
**Datum:** 2026-09-23
**Vorlage:** Adversarial Review + Decision Report + Korrigierte Aufwandsschätzung
**Ziel:** Business Events von Offering-Abhängigkeit lösen

---

## KERN-INVARIANTE

> **Ein Business Event muss vollständig existieren können, ohne dass in NeXus irgendein Offering, Filter Profile oder User Offering erforderlich ist.**

Diese Invariante muss technisch durchgesetzt werden. Alles andere ist nachgelagert.

---

## 1. WELCHE BESTEHENDE TABELLE REPRÄSENTIERT "BUSINESS EVENT"?

### Antwort: KEINE. Es muss eine NEUE Tabelle entstehen.

**Begründung:**

| Tabelle | Problem |
|---------|---------|
| `nexus_trigger_events` | Enthält kein `event_date`, kein `event_subtype`, kein `location`. Status = 'neu' (hardcodiert). Keine Evidence-Spalte. |
| `nexus_raw_events` | Nur Rohdaten (URL, Content, Hash). Kein strukturiertes Event. Kein Firmenname. Kein Event-Typ. |
| `nexus_qualified_triggers` | Offering-gebunden über `filter_profile_id`. Kein `event_id`. Keine Evidence. |
| `nexus_radar_hits` | Nur Suchergebnis-Metadaten (URL, Title, Score). Kein Business Event. |

**Entscheidung:** NEUE Tabelle `nexus_events` erstellen.

### Schema: `nexus_events`

```sql
CREATE TABLE IF NOT EXISTS nexus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Was ist passiert?
    event_type TEXT NOT NULL,           -- z.B. 'expansion', 'hiring', 'investment', 'founding'
    event_subtype TEXT,                 -- z.B. 'office_expansion', 'production_expansion'
    title TEXT NOT NULL,                -- Kurzbeschreibung
    description TEXT,                   -- Ausführliche Beschreibung

    -- Wer ist betroffen?
    company_id UUID REFERENCES nexus_companies(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,         -- Fallback wenn company_id fehlt
    company_domain TEXT,

    -- Wo?
    country TEXT,
    region TEXT,
    city TEXT,

    -- Wann?
    event_date TIMESTAMPTZ,            -- Wann ist das Event passiert?
    detected_at TIMESTAMPTZ DEFAULT NOW(), -- Wann wurde es von NeXus entdeckt?

    -- Wie zuverlässig?
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    verification_status TEXT DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified', 'verifying', 'verified', 'rejected', 'insufficient_data')),

    -- Pipeline-State
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'packaged', 'exported')),

    -- Metadaten
    source_count INTEGER DEFAULT 0,    -- Anzahl Quellen
    raw_event_ids UUID[],              -- Referenzen zu nexus_raw_events

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_nexus_events_user ON nexus_events(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_events_type ON nexus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_nexus_events_company ON nexus_events(company_id);
CREATE INDEX IF NOT EXISTS idx_nexus_events_status ON nexus_events(verification_status);
CREATE INDEX IF NOT EXISTS idx_nexus_events_date ON nexus_events(event_date DESC);

-- RLS
ALTER TABLE nexus_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON nexus_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON nexus_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON nexus_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON nexus_events FOR DELETE USING (auth.uid() = user_id);
```

**Vorteil gegenuber `nexus_trigger_events`:**
- `event_date` für Temporalität
- `verification_status` für Quality Gate
- `source_count` für Multi-Source Tracking
- `raw_event_ids` für Rohdaten-Referenz
- KEINE Offering-Abhängigkeit
- KEINE Filter-Profile Abhängigkeit

---

## 2. WELCHE TABELLE REPRÄSENTIERT "LEAD PACKAGE"?

### Antwort: NEUE Tabelle `nexus_lead_packages`.

**Warum nicht `nexus_qualified_triggers`?**
- Offering-gebunden über `filter_profile_id`
- Keine Evidence-Spalte
- Kein `quality_score`
- Kein `completeness`
- Kein `verification_status`
- Status-Werte ('NEW', 'REVIEWED', 'CONTACTED', 'ARCHIVED') sind CRM-orientiert, nicht verkaufsorientiert

### Schema: `nexus_lead_packages`

```sql
CREATE TABLE IF NOT EXISTS nexus_lead_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Kern-Referenzen
    event_id UUID REFERENCES nexus_events(id) ON DELETE CASCADE,
    company_id UUID REFERENCES nexus_companies(id) ON DELETE SET NULL,

    -- Verkaufsfelder
    headline TEXT NOT NULL,             -- "Unternehmen X baut Werk Y aus"
    summary TEXT,                       -- Zusammenfassung für Käufer
    why_relevant TEXT,                  -- Warum ist das wirtschaftlich interessant?

    -- Qualitäts-Metriken
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    completeness NUMERIC(3,2) CHECK (completeness >= 0 AND completeness <= 1),
    source_count INTEGER DEFAULT 0,
    has_contact BOOLEAN DEFAULT FALSE,

    -- Evidence (JSONB für Flexibilität)
    evidence JSONB DEFAULT '[]',
    -- Struktur: [{ url, source_type, excerpt, publication_date }]

    -- Kontakt (optional)
    contacts JSONB DEFAULT '[]',
    -- Struktur: [{ name, role, email, linkedin, email_confidence }]

    -- Company Data (angereichert)
    company_data JSONB,
    -- Struktur: { name, domain, industry, country, region, city, employee_count }

    -- Pipeline-State
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'exported', 'sold')),

    -- Offering-Match (optional, nachgelagert)
    offering_id UUID REFERENCES nexus_offerings(id) ON DELETE SET NULL,
    offering_fit_score INTEGER,
    opportunity_id UUID REFERENCES nexus_opportunities(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_user ON nexus_lead_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_event ON nexus_lead_packages(event_id);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_status ON nexus_lead_packages(status);
CREATE INDEX IF NOT EXISTS idx_nexus_lead_packages_quality ON nexus_lead_packages(quality_score DESC);

-- RLS
ALTER TABLE nexus_lead_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lead packages" ON nexus_lead_packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lead packages" ON nexus_lead_packages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lead packages" ON nexus_lead_packages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lead packages" ON nexus_lead_packages FOR DELETE USING (auth.uid() = user_id);
```

**Kern-Design-Prinzip:**
- `event_id` → Pflichtfeld (jedes Lead Package basiert auf einem Event)
- `offering_id` → NULLABLE (nachgelagert, optional)
- `opportunity_id` → NULLABLE (nachgelagert, optional)
- Ein Event kann mehrere Lead Packages erzeugen (für verschiedene Käufer/Use Cases)

---

## 3. WELCHE OFFERING-FELDER WERDEN ENTFERNT/OPTIONAL?

### Keine Felder werden entfernt. Offering wird optional.

**Begründung:** Bestehende Daten müssen erhalten bleiben. Die V2-Pipeline läuft weiter.

**Änderungen:**

| Tabelle | Änderung | Priorität |
|---------|----------|-----------|
| `nexus_filter_profiles` | `offering_id` NULLABLE machen (ON DELETE CASCADE entfernen) | Hoch |
| `nexus_qualified_triggers` | NICHT ÄNDERN (V2 Legacy, bleibt wie es ist) | Keine |
| `nexus_trigger_events` | NICHT ÄNDERN (V2 Legacy) | Keine |
| `nexus_radar_hits` | NICHT ÄNDERN (V2 Legacy) | Keine |

**SQL für filter_profiles:**

```sql
-- Bestehende ON DELETE CASCADE entfernen
ALTER TABLE nexus_filter_profiles
    DROP CONSTRAINT IF EXISTS nexus_filter_profiles_offering_id_fkey;

-- Neue Referenz ohne CASCADE
ALTER TABLE nexus_filter_profiles
    ADD CONSTRAINT nexus_filter_profiles_offering_id_fkey
    FOREIGN KEY (offering_id) REFERENCES nexus_offerings(id) ON DELETE SET NULL;
```

**WICHTIG:** Die V2-Pipeline (B1/B2 Cron) bleibt UNVERÄNDERT. Sie arbeitet weiter mit Offering-gebundenen Radar Hits. Die neue Event-Pipeline ist ein PARALLELER Weg.

---

## 4. WIE ARBEITET CRON-SEARCH OHNE OFFERING?

### Antwort: NEUE Function `cron-event-search.mjs`

**Konzept:**

```
EINGABE:
  event_type: "expansion"
  region: "Deutschland"
  time_range: "30d"
  max_queries: 10

SCHritt 1: Event-Type → Suchstrategien (LLM)
  "Was sind typische Suchbegriffe für Expansions-Events in Deutschland?"
  → ["Firmenerweiterung Standort", "neues Werk Eröffnung", "Expansion Deutschland"]

SCHRITT 2: Suchstrategien → Tavily Search (pro Query)
  → Rohdaten (URLs, Titles, Snippets)

SCHRITT 3: Rohdaten → Deduplizierung (URL-Hash + Content-Hash)
  → nexus_raw_events ( Offering-unabhängig!)

SCHRITT 4: nexus_raw_events → Event Extraction (LLM)
  → nexus_events (strukturiertes Business Event)

SCHRITT 5: nexus_events → Entity Resolution
  → Company-Matching (Domain + Name)
  → Event-Matching (company + type + date)

AUSGABE:
  nexus_events (verifizierbare Business Events)
```

**Unterschied zu B1 Cron:**

| Eigenschaft | B1 Cron (V2) | Event Search (Phase 0) |
|-------------|--------------|----------------------|
| Input | offering_id | event_type |
| Output | nexus_radar_hits | nexus_raw_events + nexus_events |
| Offering | Pflicht | Kein |
| Dedup | URL pro Offering | URL global + Content-Hash |
| LLM | Nur in B2 | Bereits in Extraction |

**Implementierungsumfang:** ~150-200 Zeilen

---

## 5. WIE ENTSCHEIDET CRON-EVALUATE OHNE OFFERING?

### Antwort: Die ursprüngliche Frage ist obsolet.

**Begründung:**
- B2 Cron (`cron-evaluate.mjs`) bewertet Radar Hits im Offering-Kontext
- Die neue Event-Pipeline hat KEINE Radar Hits, sondern `nexus_raw_events`
- Die Bewertung passiert in der Event Extraction (Schritt 4 oben), NICHT in B2

**Neuer Flow:**

```
nexus_raw_events (rohe Suchergebnisse)
    ↓
Event Extraction (LLM): "Ist das ein Business Event?"
    ↓
    Ja → nexus_events (strukturiertes Event)
    Nein → verworfen
    ↓
Entity Resolution: "Gleiche Firma + gleicher Event?"
    ↓
    Duplikat → aktualisiere bestehendes nexus_events
    Neu → neuer Eintrag in nexus_events
    ↓
Verification: "Ist die Quelle belastbar?"
    ↓
    verified / rejected / insufficient_data
```

**Kein Offering-Kontext nötig.** Die Entscheidung "Ist das ein Business Event?" ist offering-unabhängig.

---

## 6. WIE ENTSTEHEN MEHRERE LEAD PACKAGES AUS EINEM EVENT?

### Durch die Trennung: Event ≠ Lead Package.

**Beispiel:**

```
EVENT: "Firma Müller baut neues Logistikzentrum in Hamburg"
  → nexus_events (1 Eintrag)

LEAD PACKAGE 1 (für Bauunternehmen):
  headline: "Müller baut Logistikzentrum — Bauaufträge zu vergeben"
  offering_id: NULL (kein Offering zugeordnet)
  quality_score: 85
  contacts: []

LEAD PACKAGE 2 (für IT-Dienstleister):
  headline: "Müller baut Logistikzentrum — IT-Infrastruktur nötig"
  offering_id: NULL
  quality_score: 70
  contacts: []

LEAD PACKAGE 3 (für Personalvermittlung):
  headline: "Müller baut Logistikzentrum — 50 neue Stellen"
  offering_id: NULL
  quality_score: 90
  contacts: []
```

**Technisch:**
- `nexus_events` hat 1 Eintrag
- `nexus_lead_packages` hat 3 Einträge mit `event_id` → gleicher Event
- Jedes Lead Package kann später einem Offering zugeordnet werden (`offering_id` NULLABLE)

**ABER:** Im MVP erzeugen wir 1 Lead Package pro Event. Multi-Packaging kommt in Phase 2.

---

## 7. WO STEIGT OFFERING MATCH WIEDER IN DIE PIPELINE EIN?

### Nach der Lead Package Erstellung.

```
EVENT DISCOVERY → EXTRACTION → DEDUP → VERIFICATION → LEAD PACKAGE
                                                                ↓
                                                    ┌──────────┴──────────┐
                                                    ▼                     ▼
                                              Verkauf / Export       OFFERING MATCH
                                                                      (Phase 2)
                                                                           │
                                                                           ▼
                                                                      OPPORTUNITY
```

**Phase 0 (MVP):** Kein Offering Match. Lead Packages werden direkt verkauft/exportiert.

**Phase 2 (später):** `nexus-offering-match.mjs` prüft:
- Lead Package + Offering → Fit Score
- Wenn Score > Schwellenwert → Opportunity erstellen
- `opportunity_id` in Lead Package setzen

**Begründung:** Das MVP muss erst beweisen, dass Events zuverlässig gefunden und zu Lead Packages verarbeitet werden können. Offering Match ist eine Optimierung.

---

## 8. WELCHE BESTEHENDEN FUNKTIONEN DÜRFEN NICHT ANGEFASST WERDEN?

### ABSOLUT UNVERÄNDERT LASSEN:

| Datei | Grund |
|-------|-------|
| `nexus-email-crawler.mjs` | Funktioniert unabhängig, keine Änderung nötig |
| `nexus-email-verify.mjs` | Funktioniert unabhängig |
| `nexus-email-research.mjs` | Funktioniert unabhängig |
| `nexus-domain-discovery.mjs` | Funktioniert unabhängig |
| `nexus-contact-intelligence.mjs` | Funktioniert unabhängig (wird erst Phase 1 erweitert) |
| `nexus-polish-text.mjs` | Universell |
| `nexus-free-pass.mjs` | Universell |
| `coach-chat.mjs` | Happiness Coach — separiert |
| `chat.mjs` | Genereller Chat — separiert |
| `hit-router.mjs` | H.I.T. Router — separiert |

### V2 PIPELINE (WEITERLAUFEN LASSEN):

| Datei | Status |
|-------|--------|
| `cron-search.mjs` | LÄUFT WEITER (V2, Offering-gebunden) |
| `cron-evaluate.mjs` | LÄUFT WEITER (V2, Offering-gebunden) |
| `nexus-research.mjs` | LÄUFT WEITER (V2, Offering-gebunden) |
| `nexus-generate-strategies.mjs` | LÄUFT WEITER (V2) |

**Die V2-Pipeline bleibt produktiv.** Die neue Event-Pipeline ist ein zusätzlicher Weg.

---

## 9. WIE WERDEN TAVILY/LLM-KOSTEN BEGRENZT?

### Kostenkontroll-Mechanismen:

**A) Tavily Budget Cap:**

```javascript
// In cron-event-search.mjs
const TAVILY_DAILY_LIMIT = 100; // Max 100 Queries pro Tag
const tavilyCount = await getTavilyCountToday(); // aus nexus_api_usage
if (tavilyCount >= TAVILY_DAILY_LIMIT) {
  console.log('Tavily daily limit reached, skipping search.');
  return { statusCode: 200, body: 'Budget limit reached' };
}
```

**B) LLM Budget Cap:**

```javascript
// In event-extraction
const LLM_DAILY_LIMIT = 200; // Max 200 LLM-Calls pro Tag
const llmCount = await getLlmCountToday();
if (llmCount >= LLM_DAILY_LIMIT) {
  return { skipped: true, reason: 'LLM budget limit' };
}
```

**C) Pro-Event Kosten Tracking:**

```sql
CREATE TABLE IF NOT EXISTS nexus_cost_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES nexus_events(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,          -- 'tavily', 'groq', 'deepseek', 'mistral'
    operation TEXT NOT NULL,         -- 'search', 'extraction', 'classification'
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**D) Kosten-Schätzung pro Discovery-Run:**

| Schritt | Provider | Max Calls | Geschätzte Kosten |
|---------|----------|-----------|-------------------|
| Suchstrategien (LLM) | Groq (Free) | 1 | $0.00 |
| Tavily Search | Tavily | 10 | $0.05 |
| Event Extraction (LLM) | Groq (Free) | 10 | $0.00 |
| Classification (LLM) | Groq (Free) | 10 | $0.00 |
| **Gesamt pro Run** | | | **~$0.05** |
| **Pro Tag (1 Run)** | | | **~$0.05** |
| **Pro Monat** | | | **~$1.50** |

**Vergleich mit V2:** V2 B1 Cron: ~$90/Monat (nur Tavily). Warum? Weil V2 3 Offerings × 5 Queries × 96 Läufe/Tag = 1.440 Calls/Tag macht. Die neue Event-Pipeline macht max 10 Queries pro Run = 10 Calls/Tag.

---

## 10. WELCHE TESTMENGE IST ALS REAL-DATA VERIFICATION ERFORDERLICH?

### 50 reale Events aus Deutschland.

**Test-Design:**

| Event-Type | Anzahl | Quellen |
|------------|--------|---------|
| Expansion (neue Standorte) | 8 | Pressemitteilungen, Handelsregister |
| Hiring (große Einstellungen) | 8 | LinkedIn, Job-Börsen, Unternehmensnews |
| Investment (Finanzierungsrunden) | 5 | Pressemitteilungen, Crunchbase |
| M&A (Übernahmen) | 5 | Handelsregister, Wirtschaftszeitungen |
| New Product / Marktstart | 5 | Pressemitteilungen, Branchenportale |
| Office Opening | 4 | Lokalzeitungen, Unternehmensnews |
| Partnership | 4 | Pressemitteilungen |
| Leadership Change | 4 | LinkedIn, Unternehmensnews |
| Sustainability | 4 | ESG-Reports, Pressemitteilungen |
| Regulatory | 3 | Amtsblatt, Behörden |

**Qualitätsmetriken (pro Event):**

| # | Metrik | Ziel |
|---|--------|------|
| 1 | Tatsächlich ein Business Event? | > 80% |
| 2 | Aktuell (< 30 Tage)? | > 90% |
| 3 | Unternehmen korrekt zugeordnet? | > 85% |
| 4 | Event eindeutig (kein Dublikat)? | > 90% |
| 5 | Mindestens 1 belastbare Quelle? | > 95% |
| 6 | Wirtschaftlich relevant? | > 70% |
| 7 | Als Lead Package verwendbar? | > 60% |

**Durchführung:**
1. Für jeden Event-Type: 5 Suchanfragen auf Deutsch
2. Tavily Search → ~50 Rohdaten
3. Event Extraction → ~20 strukturierte Events
4. Dedup → ~15 unique Events
5. Verification → ~10 verified Events
6. Lead Package → ~8 Lead Packages

**Erwartete Conversion-Rate:** ~16% (50 Suchanfragen → 8 Lead Packages)

---

## ZUSAMMENFASSUNG: PHASE 0 LIEFERT

### Neue Dateien:

| Datei | Beschreibung | Zeilen |
|-------|-------------|--------|
| `20260923_create_nexus_events_and_lead_packages.sql` | DB Migration: nexus_events, nexus_lead_packages, nexus_cost_log | ~120 |
| `netlify/functions/cron-event-search.mjs` | Offering-unabhängige Event Discovery | ~200 |
| `netlify/functions/nexus-event-extraction.mjs` | LLM-basierte Event Extraktion | ~150 |
| `netlify/functions/nexus-entity-resolution.mjs` | Company + Event Dedup | ~100 |
| `src/lib/nexus-db.js` | Erweitern: Event + LeadPackage CRUD | +80 |
| `src/pages/EventExplorerPage.jsx` | Event Explorer UI | ~300 |

### Geänderte Dateien:

| Datei | Änderung |
|-------|----------|
| `nexus_filter_profiles` (SQL) | offering_id NULLABLE machen |

### NICHT geändert:

Alle V2 Funktionen, alle bestehenden Tabellen, alle Frontend-Seiten.

---

## ÄNDERUNGEN AM DECISION REPORT

Folgende Aussagen im Decision Report werden durch dieses Briefing KORRIGIERT:

| Aussage | Korrektur |
|---------|-----------|
| "V3 Tabellen aktivieren" | Filter-Profile haben Offering-Abhängigkeit → muss geändert werden |
| "qualified_triggers als Lead-Package-Vorlage" | Offering-gebunden → NEUE Tabelle nötig |
| "V2 Pipeline erweitern" | V2 bleibt V2, neue Pipeline ist PARALLEL |
| Kosten $0.60-3.00/100 Events | Tatsächlich ~$0.05/Run, ~$1.50/Monat (neue Pipeline) |
| Code Complete 8-11h | Korrekt: **10-14h** (weniger als vorher, weil V2 nicht umgebaut wird) |
| Production Ready 18-23h | Korrekt: **16-22h** (weniger als vorher) |

---

*Dieses Briefing ist eine READ-ONLY Analyse. Es wurden keine Code-Änderungen vorgenommen.*
