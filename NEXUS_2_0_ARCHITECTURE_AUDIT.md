# NEXUS 2.0 — ARCHITECTURE AUDIT & MIGRATION PLAN

**Status:** READ-ONLY ANALYSE — Noch kein Code geändert.
**Datum:** 2026-09-23
**Basis:** Tatsächlicher Codebestand auf `main` (Commit `f46fe4a`)

---

## A. IST-ARCHITEKTUR

### A.1 Gesamtübersicht

NeXus ist ein B2B Sales Intelligence System innerhalb der Happiness-Plattform.

**Tech-Stack:**
- Frontend: React 19 + Vite 6 + React Router
- Backend: Netlify Functions (14 Dateien, ~7.500 Zeilen)
- DB: Supabase (PostgreSQL) mit 19 NeXus-Tabellen
- AI: Multi-Provider Fallback (Groq → Mistral → OpenRouter → OpenAI → DeepSeek)
- Search: Tavily (Multi-Key) → DuckDuckGo → Brave → SearXNG
- Hosting: Netlify (Auto-Deploy von `main`)

### A.2 Architektur-Flow (Ist)

```
USER DEFINIERT OFFERING
        ↓
  Angebotsanalyse (AI)
        ↓
  Signal Strategies generieren (AI)
        ↓
  ┌─── B1 Search Cron (nexus-research / cron-search) ───┐
  │  Sucht Web nach Trigger-Events basierend auf         │
  │  Signal-Strategies + Offering-Keywords                │
  │  Speichert Rohdaten in nexus_radar_hits               │
  └──────────────────────────────────────────────────────┘
        ↓
  ┌─── B2 Evaluate Cron (cron-evaluate) ────────────────┐
  │  Bewertet Radar-Hits mit AI auf Relevanz             │
  │  Erstellt: Companies, Triggers, Research,            │
  │            Opportunities, Activities                  │
  └──────────────────────────────────────────────────────┘
        ↓
  OPPORTUNITY PIPELINE (Sales Workspace)
        ↓
  ┌─── Contact Intelligence ────────────────────────────┐
  │  Findet Ansprechpartner via Website-Crawl + AI       │
  │  Email-Pattern-Crawler + SMTP-Verification           │
  └──────────────────────────────────────────────────────┘
        ↓
  ┌─── Message Generation ─────────────────────────────┐
  │  Generiert personalisierte Erstansprache             │
  └──────────────────────────────────────────────────────┘
        ↓
  ┌─── Social Intelligence ────────────────────────────┐
  │  Findet YouTube/LinkedIn Activities                  │
  │  Generiert Kommentare + DMs                          │
  └──────────────────────────────────────────────────────┘
```

### A.3 AI-Provider-Reihenfolge

| Pfad | Provider-Reihenfolge |
|------|---------------------|
| Text (nexus-llm) | Groq → Mistral → OpenRouter → DeepSeek → OpenAI |
| Vision (nexus-llm) | OpenAI → Groq (Vision) → OpenRouter → Mistral → DeepSeek |
| Research (nexus-research) | Groq → Mistral → OpenRouter → OpenAI |
| Contact Intelligence | DeepSeek → Mistral |
| Cron Evaluate | DeepSeek (preferiert) oder Mistral |

### A.4 Such-Infrastruktur

| Komponente | Funktion | Fallback |
|------------|----------|----------|
| Tavily (4 Keys) | Primäre Web-Suche | DuckDuckGo |
| DuckDuckGo (HTML Scrape) | Sekundäre Suche | Brave Search |
| Brave Search | Tertiäre Suche | SearXNG (3 Instanzen) |
| Google CSE | Domain-Discovery (Stage 2) | Keiner |
| Direct HTTP | Website-Crawl | Tavily `site:` Search |

---

## B. VORHANDENE NEXUS-KOMPONENTEN

### B.1 Datenbank-Tabellen (19 Stück)

| # | Tabelle | Zweck | RLS | DDL in Repo? |
|---|---------|-------|-----|-------------|
| 1 | `nexus_analyses` | Angebot-Analysen (JSON) | ✅ | ✅ |
| 2 | `nexus_offerings` | Nutzer-Angebote | ❌ (deaktiviert) | ✅ |
| 3 | `nexus_signal_strategies` | AI-Generierte Suchstrategien | ✅ | ❌ (extern erstellt) |
| 4 | `nexus_companies` | B2B-Unternehmen | ✅ | ✅ |
| 5 | `nexus_company_offerings` | M:N Company↔Offering | ✅ | ✅ |
| 6 | `nexus_contacts` | Ansprechpartner | ✅ (teilweise) | ✅ |
| 7 | `nexus_trigger_events` | Kaufsignal-Events | ✅ | ✅ |
| 8 | `nexus_radar_hits` | Rohdaten aus Web-Suche | ✅ | ❌ (extern erstellt) |
| 9 | `nexus_research` | AI-Analyse von Triggern | ✅ | ✅ |
| 10 | `nexus_opportunities` | Verkaufschancen (Pipeline) | ❌ (nicht aktiviert) | ✅ |
| 11 | `nexus_opportunity_contacts` | M:N Opportunity↔Contact | ❌ | ✅ |
| 12 | `nexus_opportunity_triggers` | M:N Opportunity↔Trigger | ❌ | ✅ |
| 13 | `nexus_generated_content` | Generierte Pitches/Mails | ❌ | ✅ |
| 14 | `nexus_activities` | Activity-Log (polymorph) | ❌ | ✅ |
| 15 | `nexus_api_usage` | Rate-Limiting | ❌ | ✅ |
| 16 | `nexus_free_passes` | IP-basierte Free Trials | ❌ | ❌ (extern) |
| 17 | `nexus_filter_profiles` | V3 Suchfilter | ✅ | ✅ |
| 18 | `nexus_qualified_triggers` | V3 Qualifizierte Leads | ✅ | ✅ |
| 19 | `nexus_raw_events` | V3 Neutraler Rohdaten-Pool | ✅ | ✅ |

**Hinweis:** 3 Tabellen (`nexus_radar_hits`, `nexus_signal_strategies`, `nexus_free_passes`) haben keinen CREATE TABLE in Repo-Migrations.

### B.2 Netlify Functions (14 Dateien)

| # | Datei | Zeilen | Funktion |
|---|-------|--------|----------|
| 1 | `nexus-llm.mjs` | 679 | Haupt-AI-Gateway, Chat, Rate-Limiting |
| 2 | `nexus-research.mjs` | 608 | Web-Recherche → Trigger Events |
| 3 | `nexus-contact-intelligence.mjs` | 1848 | Ansprechpartner-Findung (Flaggschiff) |
| 4 | `nexus-domain-discovery.mjs` | 463 | Firmen-Domain finden (2-Stage) |
| 5 | `nexus-email-crawler.mjs` | 1013 | Email-Muster von Websites ableiten |
| 6 | `nexus-email-research.mjs` | 154 | Email-Pattern-Generierung |
| 7 | `nexus-email-verify.mjs` | 258 | SMTP-Handshake Email-Verifikation |
| 8 | `nexus-message-generation.mjs` | 235 | Personalisierte Erstansprache |
| 9 | `nexus-social-intelligence.mjs` | 767 | YouTube/LinkedIn Recherche + Outreach |
| 10 | `nexus-generate-strategies.mjs` | 244 | Signal-Strategien generieren |
| 11 | `nexus-polish-text.mjs` | 189 | KI-Textkorrektur (STT) |
| 12 | `nexus-free-pass.mjs` | 102 | IP-basierte Free Trials |
| 13 | `nexus-radar-feeder.mjs` | 98 | Demo/Mock-Radar (nicht produktiv) |
| 14 | `cron-search.mjs` | 243 | B1 Search Cron (Hintergrund) |
| 15 | `cron-evaluate.mjs` | 366 | B2 Intelligence Cron (Hintergrund) |

**Hinweis:** `hit-router.mjs` (332 Zeilen) ist der H.I.T.-Router (Layer 1), gehört aber nicht direkt zur NeXus-Pipeline.

### B.3 Frontend-Pages

| # | Datei | Zeilen | Zweck |
|---|-------|--------|-------|
| 1 | `NexusLandingPage.jsx` | ~1500 | Value-First-Onboarding, Angebotsanalyse |
| 2 | `NexusDashboard.jsx` | ~800 | Pipeline-Übersicht, Stats |
| 3 | `AngebotsanalysePage.jsx` | ~500 | Angebotsanalyse + Strategien |
| 4 | `NexusLeadRadarPage.jsx` | ~700 | Radar-Ansicht, Auto-Trigger |
| 5 | `NexusLeadIntelligencePage.jsx` | ~600 | Lead-Intelligence Detail |
| 6 | `SalesWorkspacePage.jsx` | 2103 | Zentrales CRM-Cockpit |
| 7 | `CoachChatPage.jsx` | 869 | NeXus Sales Coach |

### B.4 Lib-Module

| # | Datei | Zeilen | Zweck |
|---|-------|--------|-------|
| 1 | `nexus-db.js` | 605 | DB-CRUD (38 Funktionen) |
| 2 | `nexus-ai.js` | 752 | AI-Client (14 Modi) |
| 3 | `nexus-coach.js` | 539 | Coach System-Prompt Builder |
| 4 | `nexus-analytics.js` | 118 | Event-Tracking (GA4 + Supabase) |
| 5 | `nexus-free-pass.js` | 61 | Free-Pass Client |
| 6 | `nexus-polish.js` | 24 | Text-Polish Client |

### B.5 Context

| Datei | Zweck |
|-------|-------|
| `LeadContext.jsx` (234 Zeilen) | Pipeline-State: Opportunities, Triggers, Offerings, Radar Hits |

### B.6 Komponenten

| Datei | Zweck |
|-------|-------|
| `NexusAnalysisResult.jsx` (376) | JSON → UI Rendering |
| `NexusLiveProgressBar.jsx` (181) | Animierte Fortschrittsanzeige |
| `SignalStrategiesManager.jsx` | Signal-Strategien verwalten |
| `NexusIntroModal.jsx` (193) | Video-Intro für Erstbesucher |
| `NexusVideoHubModal.jsx` (312) | Multi-Video Hub |
| `NexusVideoBubble.jsx` (38) | Floating Video-Button |

---

## C. WAS WIEDERVERWENDET WERDEN KANN

### C.1 Direkt wiederverwendbar (ohne Änderung)

| Komponente | Warum |
|------------|-------|
| `nexus_companies` Tabelle | universell — Unternehmen sind zentral |
| `nexus_contacts` Tabelle | universell — Kontakte bleiben relevant |
| `nexus-domain-discovery.mjs` | Domain-Findung braucht kein Offering |
| `nexus-email-crawler.mjs` | Email-Muster unabhängig von Offering |
| `nexus-email-verify.mjs` | SMTP-Check unabhängig von Offering |
| `nexus-email-research.mjs` | Pattern-Generierung unabhängig |
| AI-Provider-Chain (in allen Functions) | Multi-Provider-Fallback bleibt identisch |
| Tavily/DuckDuckGo/Brave/SearXNG Such-Stack | Search-Infrastruktur bleibt identisch |
| `nexus-api-usage` Rate-Limiting | universell |
| `nexus-free-passes` + `nexus-free-pass.mjs` | universell |
| `nexus-polish-text.mjs` + `nexus-polish.js` | universell |
| `NexusLiveProgressBar.jsx` | universell |
| `nexus-analytics.js` | universell |
| RPC-Funktionen | `claim_*`, `save_hit_evaluation`, `reset_*` |

### C.2 Wiederverwendbar mit Anpassung

| Komponente | Was muss sich ändern |
|------------|---------------------|
| `nexus-analyses` Tabelle | Wird zu `nexus_event_analyses` (oder: wird überflüssig wenn Event-Direkterkennung) |
| `nexus_offerings` Tabelle | Bleibt, aber wird zu optionaler 2. Ebene |
| `nexus_signal_strategies` Tabelle | Muss universeller werden (nicht an Offering gebunden) |
| `nexus_radar_hits` Tabelle | Wird zu `nexus_event_candidates` (ähnliche Struktur) |
| `nexus_trigger_events` Tabelle | Wird zu `nexus_events` (erweitert) |
| `nexus_research` Tabelle | Wird zu `nexus_event_evidence` (erweitert) |
| `nexus_filter_profiles` Tabelle | Perfekt für V3 — 1:1 wiederverwendbar |
| `nexus_qualified_triggers` Tabelle | Wird zu `nexus_lead_packages` (erweitert) |
| `nexus-research.mjs` | Muss Offering-unabhängig werden |
| `nexus-generate-strategies.mjs` | Muss Offering-unabhängig werden |
| `nexus-contact-intelligence.mjs` | Muss Event-basiert werden (nicht Opportunity-basiert) |
| `nexus-message-generation.mjs` | Muss Event+LeadPackage-basiert werden |
| `nexus-social-intelligence.mjs` | Muss Event-basiert werden |
| `cron-search.mjs` | Muss universelle Event-Suche können |
| `cron-evaluate.mjs` | Muss Event-Evaluation können (nicht Offering-spezifisch) |
| `nexus-db.js` | Erweitern um Event/LeadPackage CRUD |
| `nexus-ai.js` | Neue Modi für Event-Erkennung |
| `LeadContext.jsx` | Muss Events + LeadPackages verwalten |
| `SalesWorkspacePage.jsx` | Muss Event-basiert werden |
| `NexusLeadRadarPage.jsx` | Muss Event-Ansicht werden |
| `NexusDashboard.jsx` | Muss Event-Stats zeigen |

### C.3 Vollständig neu

| Komponente | Zweck |
|------------|-------|
| `nexus_events` Tabelle | Zentrale Event-Entität |
| `nexus_lead_packages` Tabelle | Verkaufsfähige Lead-Zusammenstellung |
| `nexus_evidence` Tabelle (oder JSONB in Events) | Quellenbelege |
| Event-Discovery-Engine | Universelle Event-Suche ohne Offering |
| Event-Extraction-Pipeline | Strukturierung: Suchergebnis → Event |
| Entity-Resolution-Logik | Duplikaterkennung für Events/Companies |
| Verification-Engine | UNVERIFIED/VERIFIED/REJECTED Status |
| Enrichment-Pipeline | Anreicherung nach Event-Erkennung |
| Lead-Package-Builder | Zusammenstellung: Event → verkaufsfähiges Package |
| Offering-Match-Engine | Event + Offering → Opportunity |
| Frontend: Event Explorer | "Welche Leads möchtest du finden?" |
| Frontend: Lead Package View | Verkaufsfähige Darstellung |

---

## D. WAS ANGEPASST WERDEN MUSS

### D.1 Datenbank-Tabellen

| Tabelle | Änderung | Priorität |
|---------|----------|-----------|
| `nexus_trigger_events` | Erweitern zu `nexus_events`: `event_type`, `event_subtype`, `location`, `country`, `region`, `city`, `event_date`, `verification_status` | Hoch |
| `nexus_radar_hits` | Umbenennen/Erweitern zu `nexus_event_candidates`: Offering-Unabhängigkeit | Hoch |
| `nexus_research` | Erweitern zu `nexus_event_evidence`: `evidence_type`, `source_url`, `source_type`, `publication_date` | Hoch |
| `nexus_signal_strategies` | Offering-Unabhängig machen: `user_id` + `event_type` statt `offering_id` | Mittel |
| `nexus_companies` | Erweitern: `country`, `region`, `city`, `employee_count`, `founded_year`, `website_verified` | Mittel |
| `nexus_contacts` | Bereits gut — nur `email_confidence`/`email_source` prüfen | Niedrig |
| `nexus_opportunities` | Erweitern: `event_id` statt `trigger_id`, `fit_score`, `timing_score` | Mittel |

### D.2 Backend-Functions

| Datei | Änderung | Priorität |
|-------|----------|-----------|
| `nexus-research.mjs` | Offering-Optionality: Search auch ohne `offeringId` möglich | Hoch |
| `cron-search.mjs` | Universelle Event-Suche: Auch ohne Offering-Strategien suchen | Hoch |
| `cron-evaluate.mjs` | Event-basierte Evaluation: Kein Offering-Check nötig | Hoch |
| `nexus-generate-strategies.mjs` | Universelle Strategien: Pro Event-Type, nicht pro Offering | Mittel |
| `nexus-contact-intelligence.mjs` | Event-basiert: `eventId` statt `opportunityId` als primärer Input | Mittel |
| `nexus-message-generation.mjs` | Event+LeadPackage Input | Mittel |
| `nexus-social-intelligence.mjs` | Event-basiert | Niedrig |

### D.3 Frontend

| Datei | Änderung | Priorität |
|-------|----------|-----------|
| `SalesWorkspacePage.jsx` | Event-basierte Ansicht, Offering als optional | Hoch |
| `NexusLeadRadarPage.jsx` | Event Explorer UI | Hoch |
| `NexusDashboard.jsx` | Event-Stats, LeadPackage-Counter | Mittel |
| `NexusLandingPage.jsx` | Neuer Einstieg: "Welche Events suchst du?" | Mittel |
| `AngebotsanalysePage.jsx` | Offering bleibt — aber als optionaler Fit-Filter | Niedrig |

---

## E. WAS NEU ENTSTEHEN MUSS

### E.1 Datenbank

| Tabelle | Beschreibung |
|---------|-------------|
| `nexus_events` | Zentrale Event-Entität (typ, subtype, title, description, company_id, location, event_date, confidence, verification_status) |
| `nexus_event_sources` | Quellenbelege pro Event (source_url, source_type, publication_date, evidence_text, crawl_date) |
| `nexus_lead_packages` | Verkaufsfähige Zusammenstellung (event_id, company_id, contacts, evidence, quality_score, completeness) |
| `nexus_event_type_definitions` | Erweiterbare Event-Typ-Definitionen (key, label_de, label_en, search_hints, example_queries) |

### E.2 Backend

| Funktion | Beschreibung |
|----------|-------------|
| `nexus-event-discovery.mjs` | Universelle Event-Suche: Nimmt Event-Type + Filter → generiert Suchstrategien → führt Suche durch |
| `nexus-event-extraction.mjs` | Nimmt Suchergebnis → extrahiert strukturiertes Event (Was, Wer, Wann, Wo, Wie groß) |
| `nexus-entity-resolution.mjs` | Erkennt Duplikate: Gleiche Firma + gleicher Event aus verschiedenen Quellen → normalisiert |
| `nexus-event-verification.mjs` | Prüft: Quelle vorhanden? Daten konsistent? Status: UNVERIFIED → VERIFIED/REJECTED |
| `nexus-event-enrichment.mjs` | Anreicherung: Company-Daten, Contact-Finding, Größenordnung, Zeitplan |
| `nexus-lead-package-builder.mjs` | Baut aus Event + Enrichment das verkaufsfähige Lead Package |
| `nexus-offering-match.mjs` | Prüft: Welches Offering passt zu diesem Event? Erstellt Opportunity. |

### E.3 Frontend

| Seite/Komponente | Beschreibung |
|------------------|-------------|
| `EventExplorerPage.jsx` | Neuer Einstieg: "Welche Business Events suchst du?" mit Type-Auswahl, Region, Zeitraum |
| `EventDetailPage.jsx` | Event-Ansicht mit Evidence, Company, Contacts, Lead Package |
| `LeadPackageView.jsx` | Verkaufsfähige Darstellung eines Lead Packages |
| `EventTypeSelector.jsx` | Dynamische Event-Typ-Auswahl (aus DB, nicht hart codiert) |

---

## F. WAS NICHT MEHR ZENTRAL SEIN SOLLTE

| Komponente | Bisher | Zukünftig |
|------------|--------|-----------|
| Offering | Zentraler Startpunkt | Optionale 2. Ebene |
| Angebotsanalyse | Erste Seite im Flow | Optional, nach Event-Erkennung |
| Signal-Strategien | Pro Offering | Pro Event-Type ( universell ) |
| Pipeline-Stage | Offering-centric | Event-centric |
| Opportunity | Primäres Datenobjekt | Abgeleitet aus Event + Offering |
| Sales Workspace | Offering-Kontext | Event-Kontext |

---

## G. DATENMODELL V2

### G.1 Neue Entitäten

```
nexus_events (NEU)
├── id: UUID PK
├── event_type: TEXT NOT NULL (z.B. 'expansion', 'investment', 'hiring', 'founding', ...)
├── event_subtype: TEXT (z.B. 'office_expansion', 'production_expansion')
├── title: TEXT NOT NULL
├── description: TEXT
├── company_id: UUID FK → nexus_companies
├── location: TEXT
├── country: TEXT
├── region: TEXT
├── city: TEXT
├── event_date: TIMESTAMPTZ
├── detected_at: TIMESTAMPTZ DEFAULT NOW()
├── confidence: NUMERIC (0-1)
├── verification_status: TEXT DEFAULT 'unverified'
│   CHECK IN ('unverified', 'verifying', 'verified', 'rejected', 'insufficient_data')
├── user_id: UUID FK → auth.users
├── created_at: TIMESTAMPTZ
├── updated_at: TIMESTAMPTZ
└── deleted_at: TIMESTAMPTZ (Soft Delete)

nexus_event_sources (NEU)
├── id: UUID PK
├── event_id: UUID FK → nexus_events
├── source_url: TEXT NOT NULL
├── source_type: TEXT (z.B. 'press_release', 'news_article', 'company_website', 'registry')
├── publication_date: TIMESTAMPTZ
├── evidence_text: TEXT (Auszug)
├── crawl_date: TIMESTAMPTZ DEFAULT NOW()
└── created_at: TIMESTAMPTZ

nexus_lead_packages (NEU)
├── id: UUID PK
├── event_id: UUID FK → nexus_events
├── company_id: UUID FK → nexus_companies
├── user_id: UUID FK → auth.users
├── offering_id: UUID FK → nexus_offerings (NULLABLE — optional)
├── contacts: JSONB (Array von Contacts)
├── evidence: JSONB (Array von Sources)
├── company_data: JSONB (angereicherte Firmendaten)
├── project_data: JSONB (Projekt-Volumen, Zeitplan, etc.)
├── quality_score: INTEGER (0-100)
├── completeness: NUMERIC (0-1)
├── status: TEXT DEFAULT 'draft'
│   CHECK IN ('draft', 'ready', 'exported', 'sold')
├── created_at: TIMESTAMPTZ
├── updated_at: TIMESTAMPTZ
└── deleted_at: TIMESTAMPTZ

nexus_event_type_definitions (NEU)
├── id: UUID PK
├── event_key: TEXT UNIQUE NOT NULL
├── label_de: TEXT NOT NULL
├── label_en: TEXT NOT NULL
├── description_de: TEXT
├── description_en: TEXT
├── search_hints: JSONB (Array von Such-Hint-Strings)
├── example_queries: JSONB (Array von Beispiel-Suchanfragen)
├── icon: TEXT (Lucide Icon Name)
├── is_active: BOOLEAN DEFAULT TRUE
├── sort_order: INTEGER DEFAULT 0
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ
```

### G.2 Bestehende Tabellen — Änderungen

```
nexus_companies (ERWEITERN)
+ country: TEXT
+ region: TEXT
+ city: TEXT
+ employee_count: INTEGER
+ founded_year: INTEGER
+ website_verified: BOOLEAN DEFAULT FALSE
+ ai_confidence: INTEGER (bestehend)

nexus_events (NEU, ersetzt teilweise nexus_trigger_events)
→ nexus_trigger_events kann als "V1 Legacy" markiert werden
→ oder: nexus_trigger_events wird umbenannt/erweitert

nexus_trigger_events → nexus_events Migration:
- event_type = signal_type
- content = description
- company_id = company_id (identisch)
- confidence_score → confidence
- status → verification_status (Mapping nötig)
+ NEU: title, event_subtype, location, country, region, city, event_date
```

### G.3 Bestehende Tabellen — Abbildung

| Bestehend | Neu | Aktion |
|-----------|-----|--------|
| `nexus_analyses` | — | Behalten (Offering-Analyse bleibt) |
| `nexus_offerings` | — | Behalten (wird optionale 2. Ebene) |
| `nexus_signal_strategies` | `nexus_event_strategies` | Erweitern: event_type statt/offering_id |
| `nexus_companies` | — | Erweitern (Country, Region, etc.) |
| `nexus_company_offerings` | — | Behalten (M:N bleibt) |
| `nexus_contacts` | — | Behalten |
| `nexus_trigger_events` | `nexus_events` | Umbenennen/Erweitern |
| `nexus_radar_hits` | `nexus_event_candidates` | Umbenennen/Erweitern |
| `nexus_research` | `nexus_event_evidence` | Erweitern |
| `nexus_opportunities` | — | Behalten, aber: event_id hinzufügen |
| `nexus_opportunity_contacts` | — | Behalten |
| `nexus_opportunity_triggers` | — | Umbenennen zu `nexus_opportunity_events` |
| `nexus_generated_content` | — | Behalten |
| `nexus_activities` | — | Behalten |
| `nexus_api_usage` | — | Behalten |
| `nexus_free_passes` | — | Behalten |
| `nexus_filter_profiles` | — | Behalten (perfekt für V3) |
| `nexus_qualified_triggers` | `nexus_lead_packages` | Umbenennen/Erweitern |
| `nexus_raw_events` | — | Behalten (Rohdaten-Pool) |

---

## H. EVENT PIPELINE

### H.1 Architektur

```
DISCOVERY (Event-Definition)
    ↓
EVENT CANDIDATE (Rohdaten aus Web-Suche)
    ↓
EVENT EXTRACTION (AI: Was ist passiert?)
    ↓
EVENT NORMALIZATION (Strukturierung)
    ↓
ENTITY RESOLUTION (Duplikaterkennung)
    ↓
VERIFICATION (Quellen-Check)
    ↓
ENRICHMENT (Company, Contacts, Volumen)
    ↓
LEAD PACKAGE (Verkaufsfähig)
    ↓
PUBLISH / EXPORT / SALE
```

### H.2 Discovery Engine

**Eingabe:** Event-Type (z.B. "expansion") + Filter (Region, Zeitraum)
**Ausgabe:** Liste von Event Candidates

```
Universelle Event-Suche (KEIN Offering nötig):
1. Event-Type → LLM → generiert Suchstrategien (pro Sprache/Region)
2. Suchstrategien → Tavily/DuckDuckGo → Rohdaten
3. Rohdaten → Deduplizierung → Event Candidates
```

### H.3 Event Extraction

**Eingabe:** Suchergebnis (URL, Title, Snippet, Content)
**Ausgabe:** Strukturiertes Event

```
AI-Prompt:
"Extrahiere aus diesem Dokument ein B2B-Event:
- Was ist passiert? (event_type, title, description)
- Wer ist betroffen? (Firmenname, Branche)
- Wann? (event_date)
- Wo? (country, region, city)
- Größenordnung? (Volumen, Mitarbeiter)
- Welche Belege gibt es? (sources)
- Wie zuverlässig? (confidence 0-100)"
```

### H.4 Entity Resolution

```
1. Firma: Name + Domain → nexus_companies (fuzzy match)
2. Event: company_id + event_type + event_date → nexus_events (dedup)
3. Quelle: source_url → nexus_event_sources (dedup)
```

### H.5 Verification

```
Status-Chain:
  unverified → verifying → verified (>=2 Quellen oder hohe Confidence)
  unverified → verifying → rejected (keine belastbaren Quellen)
  unverified → verifying → insufficient_data (nicht genug Infos)

Quellen-Bewertung:
  - Offizielle Quelle (Unternehmenswebsite, Handelsregister) = hoch
  - Pressemitteilung = mittel
  - Blog/Forum = niedrig
  - Social Media = niedrig
```

### H.6 Enrichment

```
1. Company-Enrichment: Domain, Branche, Größe, Standort
2. Contact-Enrichment: Entscheider finden (bestehende Contact Intelligence)
3. Project-Enrichment: Volumen, Zeitplan, Status (wenn verfügbar)
4. Context-Enrichment: Warum relevant? (AI-basiert)
```

---

## I. LEAD PACKAGE PIPELINE

### I.1 Struktur

```
LEAD PACKAGE = {
  company: { name, domain, industry, size, location },
  event: { type, title, description, date, confidence },
  business_context: { why_relevant, timing, urgency },
  contacts: [{ name, role, email, phone, linkedin }],
  evidence: [{ url, type, date, excerpt }],
  sources: [{ url, title, snippet }],
  quality: { score, completeness, verification_status },
  metadata: { detected_at, enriched_at, packaged_at }
}
```

### I.2 Export-Formate (später)

| Format | Priorität |
|--------|-----------|
| UI (NeXus Dashboard) | MVP |
| JSON (API) | MVP |
| CSV | Phase 2 |
| PDF | Phase 3 |
| CRM Export (HubSpot, Salesforce) | Phase 4 |

---

## J. FRONTEND MIGRATION

### J.1 Neuer Einstieg

**Bisher:** Landing Page → Angebotsanalyse → Signal Strategies → Research
**Zukünftig:** Event Explorer → Event-Typ-Wahl → Discovery → Events → Lead Packages

### J.2 Seiten-Migration

| Bisherige Seite | Zukünftige Seite | Aktion |
|-----------------|------------------|--------|
| `NexusLandingPage.jsx` | `EventExplorerPage.jsx` | Neu: "Welche Events suchst du?" |
| `AngebotsanalysePage.jsx` | `OfferingProfilePage.jsx` | Optional: Offering als Fit-Filter |
| `NexusLeadRadarPage.jsx` | `EventRadarPage.jsx` | Umbenennen: Events statt Triggers |
| `NexusLeadIntelligencePage.jsx` | `EventDetailPage.jsx` | Erweitern: Event + Evidence + Lead Package |
| `SalesWorkspacePage.jsx` | `LeadPackageWorkspacePage.jsx` | Erweitern: Lead Package + Outreach |
| `NexusDashboard.jsx` | `NexusDashboard.jsx` | Erweitern: Event-Stats |
| `CoachChatPage.jsx` | `CoachChatPage.jsx` | Erweitern: Event-Kontext |

### J.3 Routing

```
/nexus                          → EventExplorerPage (NEU)
/nexus/events                   → EventRadarPage
/nexus/events/:eventId          → EventDetailPage
/nexus/lead-packages            → LeadPackageListPage
/nexus/lead-packages/:id        → LeadPackageWorkspacePage
/nexus/offering                 → OfferingProfilePage (optional)
/nexus/dashboard                → NexusDashboard
/nexus/workspace                → LeadPackageWorkspacePage (alias)
/coach                          → CoachChatPage
```

---

## K. API / SERVICE MIGRATION

### K.1 Bestehende Functions — Anpassungen

| Funktion | Änderung |
|----------|----------|
| `nexus-research.mjs` | `offeringId` optional machen; Search auch ohne Offering |
| `nexus-generate-strategies.mjs` | Strategien pro Event-Type generieren (nicht pro Offering) |
| `cron-search.mjs` | Universelle Suche: auch ohne Signal-Strategies |
| `cron-evaluate.mjs` | Kein Offering-Check; Event-Evaluation direkt |
| `nexus-contact-intelligence.mjs` | `eventId` als Input (neben `opportunityId`) |
| `nexus-message-generation.mjs` | `event` + `leadPackage` als Input |
| `nexus-social-intelligence.mjs` | `event` als Kontext |

### K.2 Neue Functions

| Funktion | Zweck |
|----------|-------|
| `nexus-event-discovery.mjs` | Universelle Event-Suche |
| `nexus-event-extraction.mjs` | Event-Strukturierung aus Suchergebnis |
| `nexus-entity-resolution.mjs` | Duplikaterkennung |
| `nexus-event-verification.mjs` | Quellen-Verifikation |
| `nexus-event-enrichment.mjs` | Anreicherung |
| `nexus-lead-package-builder.mjs` | Lead Package Zusammenstellung |
| `nexus-offering-match.mjs` | Event + Offering → Opportunity |

---

## L. SUPABASE MIGRATION

### L.1 Neue Tabellen

```sql
-- 1. Events (zentrale Entität)
CREATE TABLE nexus_events (...);

-- 2. Event Sources (Quellenbelege)
CREATE TABLE nexus_event_sources (...);

-- 3. Lead Packages
CREATE TABLE nexus_lead_packages (...);

-- 4. Event Type Definitions
CREATE TABLE nexus_event_type_definitions (...);
```

### L.2 Bestehende Tabellen — Änderungen

```sql
-- nexus_companies erweitern
ALTER TABLE nexus_companies ADD COLUMN country TEXT;
ALTER TABLE nexus_companies ADD COLUMN region TEXT;
ALTER TABLE nexus_companies ADD COLUMN city TEXT;
ALTER TABLE nexus_companies ADD COLUMN employee_count INTEGER;
ALTER TABLE nexus_companies ADD COLUMN founded_year INTEGER;
ALTER TABLE nexus_companies ADD COLUMN website_verified BOOLEAN DEFAULT FALSE;

-- nexus_opportunities erweitern
ALTER TABLE nexus_opportunities ADD COLUMN event_id UUID REFERENCES nexus_events(id);
ALTER TABLE nexus_opportunities ADD COLUMN fit_score INTEGER;
ALTER TABLE nexus_opportunities ADD COLUMN timing_score INTEGER;
```

### L.3 RPC-Funktionen (neu)

```sql
-- Event-Claiming für Background-Jobs
CREATE OR REPLACE FUNCTION claim_events_for_processing(...)
CREATE OR REPLACE FUNCTION save_event_evaluation(...)
CREATE OR REPLACE FUNCTION reset_crashed_events(...)
```

### L.4 RLS Policies

Alle neuen Tabellen bekommen:
- Service Role: Vollzugriff
- Authentifizierte Nutzer: SELECT/INSERT/UPDATE/DELETE eigene Daten

---

## M. RISIKEN / BREAKING CHANGES

### M.1 Kritische Risiken

| Risiko | Schwere | Wahrscheinlichkeit | Gegenmaßnahme |
|--------|---------|-------------------|---------------|
| Bestehende Opportunities gehen verloren | Hoch | Niedrig | Migration: `trigger_id` → `event_id` Mapping |
| Cron-Jobs stoppen nach Schema-Änderung | Hoch | Mittel | Phasenweise Migration, Cron-Zwischentest |
| Frontend-Routen brechen | Mittel | Hoch | Aliase für alte Routen, Redirects |
| AI-Prompts verhalten sich anders | Mittel | Mittel | A/B-Testing, schrittweiser Rollout |
| Datenbank-Migration fehlschlägt | Hoch | Niedrig | Backup vor Migration, Rollback-Skript |
| Rate-Limiting durch neue Functions | Niedrig | Niedrig | Bestehende `nexus_api_usage` weiter nutzen |

### M.2 Breaking Changes

| Änderung | Betroffen | Gegenmaßnahme |
|----------|-----------|---------------|
| `nexus_trigger_events` → `nexus_events` | Alle Queries, Cron-Jobs, Frontend | View oder Migration mit altem Tabellen-Namen |
| `nexus_radar_hits` → `nexus_event_candidates` | Cron-Jobs, nexus-research.mjs | View oder Alias |
| Offering wird optional | LeadContext, SalesWorkspace, alle Pages | Offering-Check in UI als "optional" markieren |
| Neue Tabellen | Erstmal nichts | Kein Breaking Change |

### M.3 Nicht-Breaking Changes

- Neue Tabellen (`nexus_events`, `nexus_event_sources`, `nexus_lead_packages`, `nexus_event_type_definitions`)
- Neue Functions
- Erweiterung bestehender Tabellen (ADD COLUMN)
- Neue Frontend-Seiten
- Neue Routes

---

## N. MIGRATIONSREIHENFOLGE

### Phase 0: Vorbereitung (Keine Breaking Changes)

1. ✅ Architecture Audit (dieses Dokument)
2. Backup der Supabase-DB
3. `nexus_event_type_definitions` Tabelle anlegen + seeden
4. `nexus_events` Tabelle anlegen (NEU, keine Konflikte)
5. `nexus_event_sources` Tabelle anlegen (NEU)
6. `nexus_lead_packages` Tabelle anlegen (NEU)
7. `nexus_companies` erweitern (ADD COLUMN, kein Breaking)
8. `nexus_opportunities` erweitern (ADD COLUMN, kein Breaking)

### Phase 1: Event-Pipeline (Backend)

9. `nexus-event-discovery.mjs` implementieren
10. `nexus-event-extraction.mjs` implementieren
11. `nexus-entity-resolution.mjs` implementieren
12. `nexus-event-verification.mjs` implementieren
13. `nexus-event-enrichment.mjs` implementieren
14. `nexus-lead-package-builder.mjs` implementieren
15. `nexus-offering-match.mjs` implementieren
16. `nexus-db.js` erweitern (Event + LeadPackage CRUD)

### Phase 2: Cron-Jobs anpassen

17. `cron-search.mjs` universell machen
18. `cron-evaluate.mjs` Event-basiert machen
19. RPC-Funktionen anpassen
20. Test: Cron-Jobs laufen gegen neue Tabellen

### Phase 3: Frontend

21. `EventExplorerPage.jsx` implementieren
22. `EventDetailPage.jsx` implementieren
23. `LeadPackageView.jsx` implementieren
24. `EventTypeSelector.jsx` implementieren
25. `SalesWorkspacePage.jsx` Event-basiert umstellen
26. `NexusLeadRadarPage.jsx` Event-basiert umstellen
27. `NexusDashboard.jsx` erweitern
28. Routing aktualisieren

### Phase 4: Offering-Optionalität

29. `nexus-research.mjs` Offering-Optional
30. `nexus-generate-strategies.mjs` universell
31. `LeadContext.jsx` Event-Logik
32. `NexusLandingPage.jsx` Neuer Einstieg

### Phase 5: Migration + Cleanup

33. Bestehende Daten migrieren (trigger_events → events)
34. Alte Tabellen als Views markieren (nicht löschen!)
35. Alte Routes auf neue umleiten
36. Integration Tests
37. Deploy

---

## O. KONKRETE DATEIEN, DIE GEÄNDERT WERDEN MÜSSEN

### O.1 Backend (Netlify Functions)

| Datei | Änderungsumfang |
|-------|----------------|
| `netlify/functions/nexus-research.mjs` | Offering-Optionalität |
| `netlify/functions/nexus-generate-strategies.mjs` | Universelle Strategien |
| `netlify/functions/nexus-contact-intelligence.mjs` | Event-basiert |
| `netlify/functions/nexus-message-generation.mjs` | Event+LeadPackage Input |
| `netlify/functions/nexus-social-intelligence.mjs` | Event-basiert |
| `netlify/functions/cron-search.mjs` | Universelle Suche |
| `netlify/functions/cron-evaluate.mjs` | Event-Evaluation |
| `netlify/functions/nexus-llm.mjs` | Event-Kontext in Prompts |

### O.2 Frontend

| Datei | Änderungsumfang |
|-------|----------------|
| `src/pages/SalesWorkspacePage.jsx` | Event-basiert (2103 Zeilen — größte Änderung) |
| `src/pages/NexusLeadRadarPage.jsx` | Event-Radar |
| `src/pages/NexusDashboard.jsx` | Event-Stats |
| `src/pages/NexusLandingPage.jsx` | Neuer Einstieg |
| `src/pages/AngebotsanalysePage.jsx` | Optional |
| `src/context/LeadContext.jsx` | Event-Logik |
| `src/routes/AppRoutes.jsx` | Neue Routen |

### O.3 Lib

| Datei | Änderungsumfang |
|-------|----------------|
| `src/lib/nexus-db.js` | Event + LeadPackage CRUD (605→~900 Zeilen) |
| `src/lib/nexus-ai.js` | Neue Modi (752→~900 Zeilen) |
| `src/lib/nexus-coach.js` | Event-Kontext |

### O.4 SQL

| Datei | Änderung |
|-------|----------|
| `20260923_create_nexus_events.sql` (NEU) | nexus_events, nexus_event_sources, nexus_lead_packages, nexus_event_type_definitions |
| `20260923_extend_nexus_companies.sql` (NEU) | ADD COLUMNs |
| `20260923_extend_nexus_opportunities.sql` (NEU) | ADD COLUMNs |
| `20260923_create_event_rpcs.sql` (NEU) | RPC-Funktionen |

### O.5 Neue Dateien

| Datei | Beschreibung |
|-------|-------------|
| `netlify/functions/nexus-event-discovery.mjs` | Universelle Event-Suche |
| `netlify/functions/nexus-event-extraction.mjs` | Event-Strukturierung |
| `netlify/functions/nexus-entity-resolution.mjs` | Duplikaterkennung |
| `netlify/functions/nexus-event-verification.mjs` | Quellen-Check |
| `netlify/functions/nexus-event-enrichment.mjs` | Anreicherung |
| `netlify/functions/nexus-lead-package-builder.mjs` | Lead Package |
| `netlify/functions/nexus-offering-match.mjs` | Offering-Match |
| `src/pages/EventExplorerPage.jsx` | Event Explorer |
| `src/pages/EventDetailPage.jsx` | Event Detail |
| `src/pages/LeadPackageView.jsx` | Lead Package View |
| `src/components/EventTypeSelector.jsx` | Event-Typ-Auswahl |

---

## P. KONKRETE DATEIEN, DIE NICHT ANGEFASST WERDEN SOLLTEN

| Datei | Warum |
|-------|-------|
| `netlify/functions/nexus-email-crawler.mjs` | Funktioniert unabhängig, keine Änderung nötig |
| `netlify/functions/nexus-email-verify.mjs` | Funktioniert unabhängig |
| `netlify/functions/nexus-email-research.mjs` | Funktioniert unabhängig |
| `netlify/functions/nexus-domain-discovery.mjs` | Funktioniert unabhängig |
| `netlify/functions/nexus-polish-text.mjs` | Universell, keine Änderung nötig |
| `netlify/functions/nexus-free-pass.mjs` | Universell |
| `netlify/functions/nexus-radar-feeder.mjs` | Demo/Mock — nicht produktiv |
| `src/lib/nexus-analytics.js` | Universell |
| `src/lib/nexus-polish.js` | Universell |
| `src/lib/nexus-free-pass.js` | Universell |
| `src/components/NexusLiveProgressBar.jsx` | Universell |
| `src/components/NexusIntroModal.jsx` | Universell |
| `src/components/NexusVideoHubModal.jsx` | Universell |
| `src/components/NexusVideoBubble.jsx` | Universell |
| `src/i18n/nexusLandingTranslations.js` | Universell |
| `src/pages/CoachChatPage.jsx` | Coach braucht keine fundamentale Änderung |
| `netlify/functions/coach-chat.mjs` | Happiness Coach — separiert |
| `netlify/functions/chat.mjs` | Genereller Chat — separiert |
| `netlify/functions/hit-router.mjs` | H.I.T. Router — separiert |
| `supabase-schema.sql` (Happiness-Tabellen) | Nicht NeXus-bezogen |
| Alle `supabase/migrations/202607*` | Happiness-Migrations |

---

## Q. MVP-SCOPE

### Q.1 MVP = Phase 0 + Phase 1 + Phase 3 (Teil)

**Umfang:**
- Event-Typ-Definitionen in DB
- `nexus_events` Tabelle + Basic CRUD
- `nexus_event_sources` Tabelle
- `nexus_lead_packages` Tabelle
- Event-Discovery-Engine (eine Function)
- Event-Extraction (eine Function)
- Event Explorer UI (eine Seite)
- Event Detail UI (eine Seite)
- Lead Package View (eine Komponente)

**NICHT im MVP:**
- Entity Resolution (kann manuell erfolgen)
- Verification-Engine (kann später automatisiert werden)
- Enrichment (kann später automatisiert werden)
- Cron-Jobs universell machen (Phase 2)
- Offering-Optionalität (Phase 4)
- Alte Daten migrieren (Phase 5)

### Q.2 Geschätzter Aufwand

| Phase | Aufwand |
|-------|---------|
| Phase 0 (Vorbereitung) | 1-2 Stunden |
| Phase 1 (Backend) | 4-6 Stunden |
| Phase 2 (Cron) | 2-3 Stunden |
| Phase 3 (Frontend) | 4-6 Stunden |
| Phase 4 (Offering-Optional) | 2-3 Stunden |
| Phase 5 (Migration + Cleanup) | 2-3 Stunden |
| **Gesamt** | **15-23 Stunden** |

---

## R. SPÄTERE FEATURES

| Feature | Phase | Beschreibung |
|---------|-------|-------------|
| CSV-Export | Phase 6 | Lead Packages als CSV exportieren |
| JSON-API | Phase 6 | REST-API für Lead Packages |
| PDF-Export | Phase 7 | Lead Packages als PDF |
| CRM-Integration | Phase 8 | HubSpot/Salesforce Export |
| Multi-Tenant Events | Phase 8 | Events für mehrere Nutzer sichtbar |
| Event-Subscription | Phase 9 | Nutzer abonnieren Event-Typen |
| Real-Time Events | Phase 9 | WebSocket-Updates für neue Events |
| Event-Clustering | Phase 10 | Mehrere Quellen → ein Event |
| NLP-Verbesserung | Phase 10 | Bessere Event-Extraktion |
| Custom Event-Types | Phase 10 | Nutzer definieren eigene Event-Typen |

---

*Dieses Dokument ist eine READ-ONLY Analyse. Es wurden keine Code-Änderungen vorgenommen, keine Datenbankmigrationen ausgeführt und keine bestehenden Funktionen gelöscht.*
