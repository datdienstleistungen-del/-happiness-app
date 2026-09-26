# NeXus 2.0 — Codebase Document (Stand: 26.09.2026)

**Projekt:** Happiness App → NeXus operatives Kernprodukt
**Repo:** `C:\Projekte\happiness-app-react` → GitHub `datdienstleistungen-del/-happiness-app`
**Live:** `https://nexus-hit.netlify.app`
**Supabase:** `https://irumowvmhvrofezwvnop.supabase.co`

---

## 1. Architektur-Überblick

```
Frontend (React 19 + Vite 6)
  ├── NexusLandingPage          — Public Landing, Free Pass
  ├── NexusDashboard            — Hauptübersicht
  ├── NexusLeadRadarPage        — Chunked Radar-Scan UI
  ├── NexusLeadIntelligencePage — Lead-Analyse + Firmenprofil-Scan
  ├── SalesWorkspacePage        — Nachricht generieren + senden
  └── CoachChatPage             — AI Sales Coach

Netlify Functions (48 .mjs Dateien)
  ├── CRM Pipeline
  │   ├── nexus-research.mjs           — Research Pipeline
  │   ├── nexus-contact-intelligence.mjs — Contact Enrichment
  │   ├── nexus-email-crawler.mjs      — Email Discovery
  │   ├── nexus-domain-discovery.mjs   — Website-Findung
  │   ├── nexus-social-intelligence.mjs — Social Intel
  │   ├── nexus-message-generation.mjs — Nachricht generieren
  │   ├── nexus-company-profile-start.mjs — Firmenprofil-Scan starten
  │   ├── nexus-company-profile-step.mjs  — Firmenprofil-Scan Step
  │   ├── nexus-elite-enrichment.mjs   — Premium Deep Enrichment
  │   └── nexus-event-extraction.mjs   — Event-Extraktion
  │
  ├── Infrastructure
  │   ├── nexus-llm.mjs               — Zentraler LLM-Dispatcher
  │   ├── nexus-models.mjs            — Modell-Katalog
  │   ├── grounding-helpers.mjs       — Anti-Halluzination
  │   └── _shared/html-fetch.mjs      — Cheerio HTML-Fetch
  │
  ├── Scan & Radar
  │   ├── nexus-radar-scan-start.mjs  — Scan starten
  │   ├── nexus-radar-scan-step.mjs   — Scan Step (1 URL/Call)
  │   ├── nexus-radar-feeder.mjs      — 24/7 Trigger Radar
  │   └── cron-evaluate.mjs           — Cron-Job Evaluator
  │
  └── Coach & Chat
      ├── coach-chat.mjs              — Sales Coach Chat
      └── chat.mjs                    — Allgemeiner Chat

Supabase (27+ nexus_* Tabellen)
  ├── nexus_companies        — Firmen
  ├── nexus_company_profiles — Webseiten-Profile (NEU)
  ├── nexus_lead_packages    — Lead Packages
  ├── nexus_events           — Business Events
  ├── nexus_contacts         — Kontakte
  ├── nexus_scan_jobs        — Chunked Radar Scans
  ├── nexus_trigger_events   — Kaufsignale
  ├── nexus_opportunities    — Opportunities
  ├── nexus_radar_hits       — Radar Treffer
  └── ... (weitere siehe §5)
```

---

## 2. Netlify Functions — Detail

### 2.1 CRM Pipeline

#### `nexus-company-profile-start.mjs` (108 Zeilen)
**Zweck:** Startet Firmenprofil-Scan. Ermittelt Ziel-URLs (Startseite, Impressum, Über-uns, Leistungen).
**Input:** `{ company_id, domain }`
**Output:** `{ profile_id, total_steps }`
**Duplikatschutz:** Prüft auf laufenden Job mit `status: 'running'`
**Importiert:** `getProfileUrls` aus `_shared/html-fetch.mjs`

#### `nexus-company-profile-step.mjs` (391 Zeilen)
**Zweck:** Verarbeitet 1 URL pro Call (Chunked-Pattern, 8.5s Budget).
**Pipeline:**
1. `fetchAndExtractText()` — Cheerio-Text-Extraktion (aus `_shared/html-fetch.mjs`)
2. LLM-Extraktion mit `GROQ_JSON_HEAVY` — Struktur + Competitor-Check
3. `checkTextGroundedInSource()` — jedes Zitat muss wörtlich im Text vorkommen
4. DB-Update: `nexus_company_profiles` + bei `is_competitor: true` → `nexus_lead_packages` Downgrade
**Hard Cap:** `current_step > 8` → `status: 'error'`
**Competitor-Gate:** Setzt `status: 'excluded'`, `quality_score: 0` in `nexus_lead_packages`

#### `nexus-contact-intelligence.mjs` (1860 Zeilen)
**Zweck:** Kontakt-Anreicherung (E-Mails, Rollen, LinkedIn, Telefon).
**Pipeline:** Domain-Findung → Seiten-Crawl → E-Mail-Extraktion → Personen-Extraktion → SMTP-Verifikation
**Importiert:** `runEmailPatternCrawler` aus `nexus-email-crawler.mjs`
**RLS:** `checkTextGroundedInSource()` für Personen-Namen

#### `nexus-email-crawler.mjs` (1025 Zeilen)
**Zweck:** Website-basierte E-Mail-Entdeckung (kostenlos, kein Hunter/Clearbit).
**Pipeline:** Domain → Cheerio-Crawl (15 Seiten) → E-Mail-Regex + mailto: → Muster-Ableitung → Personen-Extraktion
**Fallback:** Tavily Search wenn Direct-Crawl geblockt
**Exportiert:** `resolveDomain`, `cleanPersonName`, `extractPersonsFromHtml`, `crawlDomainPages`

#### `nexus-domain-discovery.mjs` (463 Zeilen)
**Zweck:** Offizielle Website einer Firma finden.
**Architektur:** 2-Stufen: Heuristik → Google CSE Fallback
**Validierung:** Parked-Domain-Check, Official-Signals (Impressum, etc.), Company-Name-Match

#### `nexus-social-intelligence.mjs` (802 Zeilen)
**Zweck:** Social-Media-Intelligence (LinkedIn, Twitter, etc.)
**Competitor-Gate:** 403 wenn `is_competitor: true` (via `nexus_companies` → `nexus_company_profiles` Lookup)

#### `nexus-message-generation.mjs` (295 Zeilen)
**Zweck:** Personalisierte Erstansprache generieren.
**Input:** `{ contact, offering, company, trigger, research }`
**Competitor-Gate:** Early 403 vor LLM-Logik (via `company.id` → `nexus_company_profiles`)
**Grounding:** `checkTextGroundedInSource()` + `checkMessageGroundedMechanical()` + `detectConcreteNumbers()`

#### `nexus-research.mjs` (683 Zeilen)
**Zweck:** Research Pipeline — Tavily-Suche → URL-Analyse → LLM-Extraktion → Radar-Hits
**Output:** Strukturierte Kaufsignale mit Quellen

#### `nexus-elite-enrichment.mjs` (277 Zeilen)
**Zweck:** Premium Deep Enrichment (E-Mail-Crawler + SMTP-Check)
**Gate:** `premiumTier != 'free'` + Rate-Limit pro User
**Input:** `{ leadPackageId }`

#### `nexus-event-extraction.mjs` (230 Zeilen)
**Zweck:** Strukturierte Event-Extraktion aus Text
**Modell:** `GROQ_JSON_HEAVY` mit DeepSeek-Skip

#### `nexus-generate-strategies.mjs` (278 Zeilen)
**Zweck:** AI-generierte Outreach-Strategien

#### `nexus-entity-resolution.mjs` (181 Zeilen)
**Zweck:** Entity-Deduplizierung

#### `nexus-email-research.mjs` (154 Zeilen)
**Zweck:** E-Mail-Discovery

#### `nexus-email-verify.mjs` (138 Zeilen)
**Zweck:** E-Mail-Verifikation via SMTP

#### `nexus-polish-text.mjs` (186 Zeilen)
**Zweck:** Text-Polieren

### 2.2 Scan & Radar

#### `nexus-radar-scan-start.mjs` (196 Zeilen)
**Zweck:** Chunked Radar-Scan starten.
**Duplikatschutz:** Prüft auf laufenden Job
**Output:** `{ job_id, total_steps }`

#### `nexus-radar-scan-step.mjs` (369 Zeilen)
**Zweck:** 1 URL pro Call, 8.5s Budget.
**Pipeline:** Fetch → LLM-Extraktion (`GROQ_JSON_HEAVY`) → DB-Update
**Eigener `callAI()`:** Groq → OpenRouter → Mistral Fallback
**Hard Cap:** `current_step > 12` → `status: 'error'`

#### `nexus-radar-feeder.mjs` (98 Zeilen)
**Zweck:** 24/7 B2B Trigger Radar

### 2.3 Infrastructure

#### `nexus-llm.mjs` (914 Zeilen)
**Zweck:** Zentraler LLM-Dispatcher mit Multi-Provider Fallback.
**Provider:** Groq (Free-first) → OpenRouter → Mistral → OpenAI
**Features:** Streaming, Vision, JSON-Mode, Tool-Calling

#### `nexus-models.mjs` (51 Zeilen)
**Zweck:** Zentraler Modell-Katalog.
```javascript
GROQ_FREE_FIRST = ['allam-2-7b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
GROQ_JSON_HEAVY = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'allam-2-7b']
GROQ_COACH = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b', 'openai/gpt-oss-120b']
GROQ_VISION_MODELS = ['qwen/qwen3.8-27b']
OPENROUTER_FREE_MODELS = ['nex-agi/nex-n2.5-mini:free', 'nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-26b-a4b-it:free']
MISTRAL_DEFAULT_MODEL = 'mistral-small-latest'
OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'
```

#### `grounding-helpers.mjs` (165 Zeilen)
**Zweck:** Anti-Halluzination — gemeinsame Prüf-Logik.
**Funktionen:**
- `checkTextGroundedInSource(claim, sourceText, options)` — Prüft ob Text wörtlich/sinngemäß in Quelle vorkommt
- `checkMessageGroundedMechanical(message, evidence, sourceText)` — Prüft ob Nachricht durch Evidence gedeckt ist
- `detectConcreteNumbers(text)` — Erkennt konkrete Zahlen
- `segmentSentences(text)` — Teilt Text in Sätze

#### `_shared/html-fetch.mjs` (134 Zeilen)
**Zweck:** Gemeinsamer HTML-Fetch-Helper mit Cheerio.
**Funktionen:**
- `fetchAndExtractText(url, options)` — Fetch + Cheerio-Text-Extraktion
- `extractTextFromHtml(html, pageUrl)` — Boilerplate entfernen, Fließtext
- `getProfileUrls(domain)` — Ziel-URLs ermitteln

### 2.4 Coach & Chat

#### `coach-chat.mjs` (594 Zeilen)
**Zweck:** AI Sales Coach — personalisierte Verkaufsberatung.
**Modell:** `GROQ_COACH` (qwen/qwen3.8-27b first)
**Features:** Live Context (Crawl), Evidence-Crosscheck, `isResponseGarbage()` Quality-Gate
**Competitor-Check:** Impressum-Crawl, Firmenname-Verifikation

#### `chat.mjs` (946 Zeilen)
**Zweck:** Allgemeiner Chat mit Multi-Provider-Fallback.

---

## 3. Frontend

### 3.1 Pages

#### `NexusLandingPage.jsx` (807 Zeilen)
**Zweck:** Public Landing Page mit Free-Pass-Flow.
**Features:** Hero-Section, Features, Pricing, Free-Pass-Modal

#### `NexusDashboard.jsx` (271 Zeilen)
**Zweck:** Hauptübersicht — Opportunities, Trigger, Radar Hits.
**Daten:** Via `useLead()` Context → `nexus-db.js` → Supabase

#### `NexusLeadRadarPage.jsx` (888 Zeilen)
**Zweck:** Chunked Radar-Scan UI mit Live-Progress.
**Features:** Scan starten, Progress-Tracking, Trigger-Anzeige
**Competitor-Filter:** `.eq('status', 'relevant')` in `nexus-db.js:258` filtert `'excluded'` automatisch

#### `NexusLeadIntelligencePage.jsx` (215 Zeilen)
**Zweck:** Lead-Analyse + automatischer Firmenprofil-Scan.
**Features:**
- `callNexusAI({ mode: 'lead_intelligence' })` — Lead Intelligence Analyse
- Automatischer Firmenprofil-Scan nach Analyse
- Competitor-Warnung (rot, mit ShieldAlert-Icon)
- Live-Progress für Firmenprofil-Scan

#### `SalesWorkspacePage.jsx`
**Zweck:** Nachricht generieren, personalisieren, senden.
**Features:** Contact Intelligence, Message Generation, Outreach-Tracking

### 3.2 Components

#### `NexusAnalysisResult.jsx` (466 Zeilen)
**Zweck:** Zentrale Anzeige-Komponente für NeXus KI-Ausgaben.
**Modes:** `angebotsanalyse`, `trigger_detection`, `lead_intelligence`, `sales_pitch`, etc.
**LeadIntelligenceView:** Rendert Angebotsanalyse + Firmenprofil-Section mit:
- Competitor-Warnung (rot, ShieldAlert-Icon)
- Leistungen (Chips)
- Zielgruppe
- Rechtsform/Sitz
- Belege mit Quellen-Links

### 3.3 Libraries

#### `nexus-ai.js` (815 Zeilen)
**Zweck:** Frontend AI Client.
**Funktionen:**
- `callNexusAI(params)` — Zentraler API-Call
- `runResearchPipeline(params)` — Research Pipeline
- **Provider:** Primary → Client-Side Groq Fallback

#### `nexus-db.js` (693 Zeilen)
**Zweck:** Supabase CRUD für alle nexus_* Tabellen.
**Funktionen:**
- `getRadarHits(userId, offeringId, limit)` — Filtert `.eq('status', 'relevant')`
- `getOpportunities(userId)`
- `getTriggerEvents(userId)`
- `getOfferings(userId)`
- `getDashboardStats(userId)`

#### `nexus-coach.js` (539 Zeilen)
**Zweck:** Sales Coach Context Builder + System Prompt.

---

## 4. Competitor Hard Gate (NeXus Session-Arbeit)

### Architektur

```
Company Profile Step (is_competitor: true)
  │
  ├──→ nexus_company_profiles: is_competitor = true
  │
  ├──→ nexus_lead_packages: status = 'excluded', quality_score = 0
  │
  ├──→ nexus-message-generation.mjs: 403 (vor LLM-Logik)
  │
  └──→ nexus-social-intelligence.mjs: 403 (vor任何 Verarbeitung)
```

### Dateien

| Datei | Änderung |
|-------|----------|
| `nexus-company-profile-step.mjs` | Competitor-Check im LLM-Prompt + DB-Downgrade |
| `nexus-message-generation.mjs` | Early 403 Guard nach Auth-Check |
| `nexus-social-intelligence.mjs` | 403 Guard via nexus_companies Lookup |
| `NexusAnalysisResult.jsx` | Rote Competitor-Warnung |
| `NexusLeadIntelligencePage.jsx` | Firmenprofil-Scan Integration |

### DB-Schema (ALTER TABLE)

```sql
-- nexus_company_profiles
is_competitor boolean not null default false
competitor_reason text
competitor_category text

-- nexus_lead_packages
status: 'excluded' zum CHECK constraint hinzugefügt
exclusion_reason text
```

### Verifikation (Chatarmin)

```
LLM-Output: is_competitor: true
competitor_reason: "Chatarmin verkauft eine Customer Experience Platform 
  mit WhatsApp Marketing und KI-Chatbot, also Software für CRM und Marketing."
competitor_category: "Customer Experience Platform / WhatsApp Marketing & AI Customer Service"
```

---

## 5. Datenbank-Schema (27 nexus_* Tabellen)

### Tier 1 — Keine NeXus-Abhängigkeiten
| Tabelle | Spalten (Hauptkolumnen) |
|---------|------------------------|
| `nexus_companies` | id, user_id, name, domain, ... |
| `nexus_offerings` | id, user_id, name, description, ... |
| `nexus_analyses` | id, user_id, analysis_type, result, ... |
| `nexus_raw_events` | id, url, url_hash, tsv_content, ... |
| `nexus_api_usage` | id, user_id, api_calls_today, ... |
| `nexus_event_type_definitions` | id, event_type, label, ... |
| `nexus_scan_jobs` | id, user_id, offering_id, status, ... |

### Tier 2 — Hängt von Tier 1 ab
| Tabelle | FK-Abhängigkeiten |
|---------|-------------------|
| `nexus_company_profiles` | → nexus_companies(id) |
| `nexus_contacts` | → nexus_companies(id) |
| `nexus_trigger_events` | → nexus_companies(id) |
| `nexus_company_offerings` | → nexus_companies(id), nexus_offerings(id) |
| `nexus_opportunities` | → nexus_companies(id), nexus_offerings(id) |
| `nexus_events` | → nexus_companies(id) |
| `nexus_filter_profiles` | → nexus_offerings(id) |

### Tier 3 — Hängt von Tier 2 ab
| Tabelle | FK-Abhängigkeiten |
|---------|-------------------|
| `nexus_leads` | → nexus_analyses(id) |
| `nexus_actions` | → nexus_leads(id) |
| `nexus_notes` | → nexus_leads(id) |
| `nexus_research` | → nexus_trigger_events(id) |
| `nexus_opportunity_contacts` | → nexus_opportunities(id), nexus_contacts(id) |
| `nexus_opportunity_triggers` | → nexus_opportunities(id), nexus_trigger_events(id) |
| `nexus_generated_content` | → nexus_opportunities(id) |
| `nexus_qualified_triggers` | → nexus_raw_events(id), nexus_filter_profiles(id) |
| `nexus_lead_packages` | → nexus_events(id), nexus_companies(id), nexus_offerings(id) |
| `nexus_cost_log` | → nexus_events(id) |

### RLS-Policies (ALLE Tabellen)
- User-Policy: `auth.uid() = user_id` (SELECT/INSERT/UPDATE/DELETE)
- Service-Role-Policy: `TO service_role` (ALL)

---

## 6. Konfiguration

### `netlify.toml`
- Functions-Verzeichnis: `netlify/functions`
- Per-Function Timeouts (variiert)
- Cron-Schedules für Radar-Scans
- SPA-Redirects

### Provider-Budget
- **Aktive Provider:** Groq (Free), Mistral (Key vorhanden, unverifiziert)
- **Deaktiviert:** DeepSeek (402 no balance), OpenAI (429 rate-limited), OpenRouter (429 Free Tier 50/50)
- **Free Plan Limit:** 10s Hard Timeout (Netlify Free)

---

## 7. Session-Commits (diese Sitzung)

```
b787612 feat(nexus): competitor hard gate — block message gen + social intel + downgrade leads
31f47ce add competitor ALTER TABLE SQL (force-add ignored file)
719caca feat(nexus): add competitor check to company profile pipeline
c0ef398 feat(nexus): add company profile pipeline (Firmenprofil aus Webseite)
edbb61d refactor: coach uses GROQ_COACH from nexus-models.mjs
```

### Dateien die in dieser Session erstellt/verändert wurden
| Datei | Status |
|-------|--------|
| `netlify/functions/_shared/html-fetch.mjs` | NEU — Shared Cheerio-Helper |
| `netlify/functions/nexus-company-profile-start.mjs` | NEU — Scan-Start |
| `netlify/functions/nexus-company-profile-step.mjs` | NEU — Chunked Step + Competitor-Check |
| `netlify/functions/_shared/create_nexus_company_profiles.sql` | NEU — DDL |
| `netlify/functions/_shared/alter_nexus_company_profiles_add_competitor.sql` | NEU — ALTER TABLE |
| `netlify/functions/nexus-message-generation.mjs` | GEÄNDERT — Competitor Guard |
| `netlify/functions/nexus-social-intelligence.mjs` | GEÄNDERT — Competitor Guard + Supabase Import |
| `netlify/functions/nexus-models.mjs` | GEÄNDERT — GROQ_COACH hinzugefügt |
| `src/components/NexusAnalysisResult.jsx` | GEÄNDERT — Competitor-Warnung + Globe/ShieldAlert Icons |
| `src/pages/NexusLeadIntelligencePage.jsx` | GEÄNDERT — Firmenprofil-Scan + Competitor-Anzeige |

---

## 8. Bekannte Einschränkungen

1. **Netlify Free Plan 10s Timeout** — `timeout = 26` in `netlify.toml` funktioniert nicht ohne Pro
2. **Provider-Budget** — Nur Groq Free verfügbar bis Oktober 2026
3. **nexus_radar_hits** — Kein `company_id`, Competitor-Downgrade erfolgt in `nexus_lead_packages`
4. **Test-User** — `goerndt5@hotmail.com` hat unbestätigte E-Mail
5. **nexus_company_profiles** — Kein `company_name` Feld, Social Intel muss über `nexus_companies` joins
