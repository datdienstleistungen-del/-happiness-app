# NEXUS_CODEBASE_MAP.md — Forensische Bestandsaufnahme

> **Erstellt:** 2026-09-25
> **Ziel:** Vollständige Dokumentation des tatsächlichen NeXus-Codepfads für GPT-Analyse
> **Status:** READ-ONLY — Keine Änderungen vorgenommen

---

## 1. EXECUTIVE SUMMARY

NeXus hat **zwei parallele Pipeline-Systeme**, die unabhängig voneinander laufen:

### Pipeline A: Offering-Dependent Radar (B1/B2) — PRODUCTION
- **Status:** Automatisiert (Cron alle 15 Min), aber **defekt** seit ~23.09.2026
- **Ursache:** LLM-Provider (Mistral 429, DeepSeek 402) nicht erreichbar, kein Groq-Fallback
- **Output:** Leads im Sales Workspace (`nexus_opportunities`)
- **6 aktive DB-Tabellen:** radar_hits, trigger_events, opportunities, research, companies, offerings

### Pipeline B: Offering-Independent Event Discovery (Phase 0) — MANUAL
- **Status:** Nur manuell auslösbar (Button-Klick), KEIN Cron konfiguriert
- **Output:** Events + Lead Packages (`nexus_events`, `nexus_lead_packages`)
- **4 aktive DB-Tabellen:** raw_events, events, lead_packages, event_type_definitions

### Kritisches Qualitätsproblem
Das von dir beschriebene Problem — unzuverlässige Leads, halluzinierte Namen, veraltete Events — lässt sich auf **5 systemische Schwachstellen** im Code zurückführen:

1. **LLM-Output wird direkt in die DB geschrieben** ohne Cross-Validierung gegen Quellen
2. **Original-Quellen werden nicht gelesen** — Entscheidungen basieren auf Such-Snippets
3. **Keine Personen-Verifizierung** — halluzinierte Namen landen in `nexus_contacts`
4. **Falsche Groq-Modellnamen** in extraktion-kritischen Dateien
5. **Fehlende Validierung** bei JSON.parse — kein Schema-Check

---

## 2. AKTIVER LEAD-/TRIGGER-PFAD

### 2.1 Pipeline A: B1/B2 (Automatisiert)

```
[nexus_offerings]
       │
       ▼
[cron-search.mjs] ◄── CRON */15 * * * *
  │ Lädt signal_strategies pro Offering
  │ Tavily Search (5 Queries/Offering)
  │ Speichert in: nexus_radar_hits (status: 'pending')
  │
  ▼
[cron-evaluate.mjs] ◄── CRON */15 * * * *
  │ Liest: nexus_radar_hits (status: 'pending')
  │ LLM-Bewertung: Mistral → DeepSeek → Groq (NEU)
  │ Speichert: relevance_score, trigger_type, firmenname
  │
  ├─ status: 'irrelevant' →Hit wird markiert
  │
  └─ status: 'relevant' + firmenname + domain
       │
       ▼
     createOpportunityFromHit()
       │ Erstellt: nexus_companies (falls neu)
       │ Erstellt: nexus_opportunities
       │ Erstellt: nexus_trigger_events
       │ Erstellt: nexus_research
       │ Verknüpft: nexus_opportunity_triggers
       │
       ▼
     [SalesWorkspacePage.jsx]
       │ Lädt: opportunity_context (5 Queries)
       │ Auto: nexus-contact-intelligence (Personensuche)
       │
       ▼
     [Fertiger Lead im Workspace]
```

**Status:** CONFIRMED im Code, aber Pipeline steht seit ~23.09.2026 (LLM-Ausfall)

### 2.2 Pipeline B: Phase 0 (Manuell)

```
[EventExplorerPage.jsx]
  │ User klickt "Events suchen"
  │
  ▼
[cron-event-search.mjs] ◄── HTTP POST (KEIN CRON!)
  │ 1. LLM generiert Suchstrategien (Groq)
  │ 2. Tavily Search (max 10 Queries)
  │ 3. Speichert in: nexus_raw_events
  │ 4. LLM-Extraktion pro Raw Event
  │    → nexus-event-extraction.mjs
  │ 5. Entity Resolution
  │    → nexus-entity-resolution.mjs
  │    → Speichert in: nexus_events
  │
  ▼
[EventExplorerPage.jsx]
  │ Zeigt Events an
  │ User klickt "Elite Package"
  │
  ▼
[nexus-elite-enrichment.mjs]
  │ Email Pattern Crawler
  │ SMTP Verification
  │ Speichert in: nexus_lead_packages
  │
  ▼
[Fertiges Lead Package]
```

**Status:** Code vorhanden, aber NICHT automatisiert. Nur manuell auslösbar.

---

## 3. DATEIÜBERSICHT P0/P1/P2

### P0 = Zwingend erforderlich

| Datei | Funktion | Pfad |
|-------|----------|------|
| `nexus-ai.js` | Zentraler LLM-Client, alle AI-Aufrufe | `src/lib/nexus-ai.js` |
| `nexus-db.js` | Alle Supabase-DB-Operationen | `src/lib/nexus-db.js` |
| `nexus-llm.mjs` | Server-side LLM-Router (Groq/OpenRouter/Mistral) | `netlify/functions/nexus-llm.mjs` |
| `cron-search.mjs` | B1 Search Cron (Signal-Suche) | `netlify/functions/cron-search.mjs` |
| `cron-evaluate.mjs` | B2 Eval Cron (KI-Bewertung) | `netlify/functions/cron-evaluate.mjs` |
| `nexus-research.mjs` | On-demand B2B Trigger Research | `netlify/functions/nexus-research.mjs` |
| `nexus-contact-intelligence.mjs` | Personenrecherche + -extraktion | `netlify/functions/nexus-contact-intelligence.mjs` |
| `nexus-email-crawler.mjs` | Email-Pattern-Crawling | `netlify/functions/nexus-email-crawler.mjs` |
| `SalesWorkspacePage.jsx` | CRM-Workspace (Lead-Anzeige) | `src/pages/SalesWorkspacePage.jsx` |
| `NexusLeadRadarPage.jsx` | Signal-Radar (Live-Suche) | `src/pages/NexusLeadRadarPage.jsx` |
| `AngebotsanalysePage.jsx` | Angebotseingabe + Analyse | `src/pages/AngebotsanalysePage.jsx` |

### P1 = Sehr wichtig

| Datei | Funktion | Pfad |
|-------|----------|------|
| `nexus-entity-resolution.mjs` | Company + Event Dedup | `netlify/functions/nexus-entity-resolution.mjs` |
| `nexus-event-extraction.mjs` | LLM-Event-Extraktion | `netlify/functions/nexus-event-extraction.mjs` |
| `cron-event-search.mjs` | Phase 0 Such-Orchestrierung | `netlify/functions/cron-event-search.mjs` |
| `nexus-elite-enrichment.mjs` | Elite Contact Enrichment | `netlify/functions/nexus-elite-enrichment.mjs` |
| `nexus-domain-discovery.mjs` | Unternehmenswebseite finden | `netlify/functions/nexus-domain-discovery.mjs` |
| `nexus-generate-strategies.mjs` | Signal-Strategien generieren | `netlify/functions/nexus-generate-strategies.mjs` |
| `nexus-smtp-utils.mjs` | Shared SMTP-Verifikation | `netlify/functions/nexus-smtp-utils.mjs` |
| `nexus-email-verify.mjs` | Email-Verifikation | `netlify/functions/nexus-email-verify.mjs` |
| `CoachChatPage.jsx` | Coach Chat UI | `src/pages/CoachChatPage.jsx` |
| `EventExplorerPage.jsx` | Phase 0 Event-Explorer | `src/pages/EventExplorerPage.jsx` |
| `nexus-coach.js` | Coach Context Builder | `src/lib/nexus-coach.js` |
| `netlify.toml` | Cron-Konfiguration | `netlify.toml` |

### P2 = Ergänzend

| Datei | Funktion | Pfad |
|-------|----------|------|
| `nexus-social-intelligence.mjs` | Social Media Intelligence | `netlify/functions/nexus-social-intelligence.mjs` |
| `nexus-message-generation.mjs` | Outreach-Nachricht generieren | `netlify/functions/nexus-message-generation.mjs` |
| `nexus-free-pass.mjs` | 24h Free Pass | `netlify/functions/nexus-free-pass.mjs` |
| `nexus-polish-text.mjs` | Textkorrektur | `netlify/functions/nexus-polish-text.mjs` |
| `nexus-radar-feeder.mjs` | Demo-Stubs (stündlich) | `netlify/functions/nexus-radar-feeder.mjs` |
| `nexus-email-research.mjs` | Email Research | `netlify/functions/nexus-email-research.mjs` |
| `NexusDashboard.jsx` | Dashboard | `src/pages/NexusDashboard.jsx` |
| `NexusLandingPage.jsx` | Landing Page | `src/pages/NexusLandingPage.jsx` |
| `supabase.js` | Supabase Client Init | `src/lib/supabase.js` |

---

## 4. DATENFLUSS

### 4.1 Pipeline A: B1/B2

```
nexus_offerings
  │ offering_name, target_audience, positioning, icp_data, trigger_model
  │
  ▼ (cron-search.mjs lädt Strategies)
nexus_signal_strategies
  │ signal_category, trigger_name, search_queries[], source_hints[]
  │
  ▼ (Tavily Search)
nexus_radar_hits
  │ user_id, offering_id, url, url_hash, source, title, raw_content
  │ published_at, status ('pending'), verification_status
  │
  ▼ (cron-evaluate.mjs → LLM)
nexus_radar_hits (UPDATE)
  │ status → 'relevant'/'irrelevant'
  │ relevance_score, relevance_reason, trigger_type
  │ intelligence_dossier (JSONB)
  │
  ▼ (createOpportunityFromHit)
nexus_companies          ← company_name, domain, industry
nexus_opportunities     ← company_id, offering_id, pipeline_stage, source
nexus_trigger_events    ← company_id, signal_type, content, source, confidence_score
nexus_research          ← trigger_id, summary, raw_data, provenance, evidence_gate_passed
nexus_opportunity_triggers ← opportunity_id, trigger_id
nexus_opportunity_contacts ← (leer, Contact Intelligence läuft danach)
```

### 4.2 Pipeline B: Phase 0

```
[User Input: event_type + region]
  │
  ▼ (cron-event-search.mjs)
nexus_raw_events
  │ source_platform, source_url (UNIQUE), title, raw_content
  │ content_hash (UNIQUE), published_at
  │
  ▼ (nexus-event-extraction.mjs → LLM)
  │ Input: raw_content
  │ Output: event_type, title, description, company_name, company_domain
  │         country, region, city, event_date, confidence, evidence
  │
  ▼ (nexus-entity-resolution.mjs)
nexus_companies ← company_name, domain (Match via domain oder Name)
nexus_events    ← user_id, event_type, title, description, company_id,
                   company_name, company_domain, country, region, city,
                   event_date, confidence, verification_status ('unverified'),
                   status ('new'), source_count, raw_event_ids[]
  │
  ▼ (User klickt "Elite Package")
nexus_lead_packages
  │ user_id, event_id, company_id, headline, summary, why_relevant
  │ quality_score, completeness, has_contact
  │ evidence (JSONB), contacts (JSONB), company_data (JSONB)
  │ status ('draft'), package_tier ('standard'/'elite')
  │
  ▼ (nexus-elite-enrichment.mjs)
nexus_lead_packages (UPDATE)
  │ contacts → [{ name, email, email_status, role }]
  │ package_tier → 'elite'
```

### 4.3 Kritische Felder — werden sie tatsächlich weitergereicht?

| Feld | Wird generiert? | Wird verifiziert? | Wird in DB geschrieben? | Risiko |
|------|----------------|-------------------|------------------------|--------|
| `offering_id` | Manuell vom User | — | JA (nexus_offerings) | NIEDRIG |
| `search_query` | LLM-generiert | NEIN | JA (nexus_signal_strategies) | MODERAT |
| `trigger_event` | LLM-generiert aus Snippets | NEIN | JA (nexus_trigger_events) | HOCH |
| `company_name` | LLM-generiert | NEIN (nur Snippet) | JA (nexus_companies, nexus_events) | HOCH |
| `company_domain` | LLM-generiert oder heuristic | TEILWEISE (HTTP-Check) | JA | MODERAT |
| `event_date` | LLM-generiert aus Snippet | NEIN | JA (nexus_events) | HOCH |
| `person_name` | LLM-generiert aus Website-Text | **NEIN** (nur Format-Check) | **JA** (nexus_contacts) | **KRITISCH** |
| `contact_email` | Email-Pattern-Crawler | JA (SMTP-Check) | JA (nexus_contacts) | NIEDRIG |
| `relevance` | LLM-generiert | NEIN | JA (nexus_radar_hits) | HOCH |
| `confidence` | LLM-generiert | NEIN | JA (nexus_events, radar_hits) | HOCH |

---

## 5. LLM/AI-FLUSS

### 5.1 Alle LLM-Aufrufe mit Halluzinations-Risiko

| # | Datei | Funktion | Provider | Prompt-Ziel | Output → DB? | Halluzinations-Risiko |
|---|-------|----------|----------|-------------|-------------|----------------------|
| 1 | `nexus-contact-intelligence.mjs` | Personenextraktion | DeepSeek/Mistral | "Extrahiere Personennamen von Website" | **JA** → nexus_contacts | **KRITISCH** |
| 2 | `cron-evaluate.mjs` | Hit-Bewertung | Groq/Mistral/DeepSeek | "Bewerte Relevanz, nenne Firmennamen" | **JA** → radar_hits + opportunities | **HOCH** |
| 3 | `nexus-research.mjs` | Trigger-Research | Groq/OpenRouter/Mistral | "Identifiziere B2B-Trigger" | **JA** → radar_hits | **HOCH** |
| 4 | `nexus-event-extraction.mjs` | Event-Extraktion | Groq/DeepSeek/Mistral | "Extrahiere Business Event" | **JA** → nexus_events | **HOCH** |
| 5 | `nexus-generate-strategies.mjs` | Strategien | Groq/OpenRouter/Mistral | "Generiere Suchstrategien" | **JA** → nexus_signal_strategies | MODERAT |
| 6 | `nexus-llm.mjs` | Main AI Hub | Groq/OpenRouter/Mistral | Dynamisch (12+ Modi) | NEIN (Return to Caller) | HOCH |
| 7 | `nexus-message-generation.mjs` | Outreach | Groq/OpenRouter/Mistral | "Erstelle Nachricht" | NEIN | MODERAT |
| 8 | `coach-chat.mjs` | Coach | OpenAI/Groq/Mistral | "Vertriebscoaching" | **JA** → coach_messages | MODERAT |
| 9 | `nexus-social-intelligence.mjs` | Social Intel | Groq/DeepSeek/Gemini | "Bewerte Social Activity" | NEIN | MODERAT |
| 10 | `nexus-polish-text.mjs` | Textkorrektur | Groq/Mistral | "Korrigiere Text" | NEIN | NIEDRIG |

### 5.2 Wo kann ein LLM einen PERSONENNAMEN erzeugen?

**KRITISCHSTER PFAD: `nexus-contact-intelligence.mjs` Zeilen 1135-1195 + 1749-1764**

```
Input: Website-Text (max 2500 chars)
  ↓
LLM-Prompt: "Extrahiere PERSONEN von der Firmenwebsite"
  ↓
LLM Output: [{ name: "Vorname Nachname", role: "...", evidence: "..." }]
  ↓
Validierung: NUR Format-Check (2+ Wörter, je 2+ Chars)
  ↓
KEINE Cross-Validierung gegen Quelltext
  ↓
Write: nexus_contacts (first_name, last_name, role, email)
```

**Problem:** Der LLM wird gebeten, "plausible Personennamen" zu extrahieren. Wenn der Website-Text unklar oder unvollständig ist, kann der LLM einen **falschen Namen erfinden**, der wie eine Extraktion aussieht. Die Validierung prüft nur Format, nicht Inhalt.

### 5.3 Validierungslücken

| Stelle | Was wird validiert? | Was fehlt? |
|--------|--------------------|--------------------|
| `nexus-contact-intelligence.mjs:1172-1188` | Format: 2+ Wörter, 2+ Chars, keine generischen Rollen | **Cross-Validierung gegen Quelltext** |
| `nexus-event-extraction.mjs:169-180` | JSON.parse + company_name nicht null | **Kein Schema-Check** |
| `cron-evaluate.mjs` | JSON.parse | **Kein Schema-Check** |
| `nexus-research.mjs:615-636` | JSON.parse + "z.B." Filter | **Keine Firmen-Verifizierung** |
| `nexus-llm.mjs:886-891` | JSON.parse | **Kein Schema-Check** |
| `nexus-generate-strategies.mjs:206-228` | JSON.parse + Array-Check | **Kein Schema-Check** |

---

## 6. SEARCH/WEB-FLUSS

### 6.1 Such-APIs nach Datei

| Datei | Primär | Fallback 1 | Fallback 2 | Fallback 3 |
|-------|--------|-----------|-----------|-----------|
| `nexus-research.mjs` | Tavily (3 Keys) | DuckDuckGo | — | — |
| `nexus-llm.mjs` | Tavily (4 Keys) | DuckDuckGo | Brave | SearXNG |
| `cron-search.mjs` | Tavily (3 Keys) | DuckDuckGo | — | — |
| `cron-event-search.mjs` | Tavily (3 Keys) | DuckDuckGo | — | — |
| `nexus-contact-intelligence.mjs` | Tavily (1 Key) | DuckDuckGo | SearXNG | — |
| `coach-chat.mjs` | Tavily (1 Key) | — | — | — |
| `nexus-email-crawler.mjs` | Direkt-Crawl | Tavily (Fallback) | — | — |
| `nexus-social-intelligence.mjs` | Tavily (1 Key) | — | — | — |
| `nexus-domain-discovery.mjs` | Heuristic + HTTP | Google CSE | — | — |

### 6.2 Kritische Such-Findings

1. **Original-Quellen werden NICHT gelesen** in den Hauptpipelines (`nexus-research.mjs`, `cron-search.mjs`, `cron-event-search.mjs`). Alle Entscheidungen basieren auf **Such-Snippets**.

2. **Event-Datum stammt NICHT aus der Originalquelle.** Es wird von Tavily (`published_date`) oder vom LLM aus dem Snippet extrahiert.

3. **Unternehmens-Domain wird NICHT** in der Haupt-Research-Pipeline (`nexus-research.mjs`) extrahiert.

4. **DuckDuckGo wird via HTML-Scraping** gescrapt (kein API) — fragil und anfällig für Strukturänderungen.

5. **SearXNG nutzt 3 öffentliche Instanzen** ohne API-Key — potenziell instabil.

### 6.3 Original-URL-Fetching

| Datei | Liest Original-URLs? | Was wird gefetcht? |
|-------|----------------------|-------------------|
| `nexus-research.mjs` | **NEIN** | Nur Snippets |
| `nexus-llm.mjs` | **NEIN** | Nur Snippets |
| `cron-search.mjs` | **NEIN** | Nur Snippets |
| `cron-event-search.mjs` | **NEIN** | Nur Snippets |
| `nexus-contact-intelligence.mjs` | **JA** | Homepage + Hub-Pages + Child-Pages |
| `nexus-email-crawler.mjs` | **JA** | 15 Subpages (impressum, kontakt, team...) |
| `nexus-domain-discovery.mjs` | **JA** | HTTP-Check der Domain |
| `nexus-social-intelligence.mjs` | **JA** | Homepage für Social-Links |
| `coach-chat.mjs` | **JA** | Homepage + Impressum + About + Team + Contact |

---

## 7. DATENBANK-FLUSS

### 7.1 Alle NeXus-Tabellen

| Tabelle | Erstellt in | Aktiv? | Writer | Reader |
|---------|------------|--------|--------|--------|
| `nexus_offerings` | V2 Migration | **JA** | AngebotsanalysePage | cron-search, cron-evaluate, nexus-research |
| `nexus_companies` | V2 Migration | **JA** | cron-evaluate, entity-resolution | SalesWorkspace, nexus-db.js |
| `nexus_company_offerings` | V2 Migration | **JA** | AngebotsanalysePage | cron-evaluate |
| `nexus_contacts` | V2 Migration | **JA** | **nexus-contact-intelligence** | SalesWorkspace, nexus-db.js |
| `nexus_trigger_events` | V2 Migration | **JA** | cron-evaluate | SalesWorkspace, nexus-db.js |
| `nexus_research` | V2 Migration | **JA** | cron-evaluate | SalesWorkspace, nexus-db.js |
| `nexus_opportunities` | V2 Migration | **JA** | cron-evaluate | SalesWorkspace, nexus-db.js |
| `nexus_opportunity_contacts` | V2 Migration | **JA** | nexus-contact-intelligence | nexus-db.js |
| `nexus_opportunity_triggers` | V2 Migration | **JA** | cron-evaluate | nexus-db.js |
| `nexus_generated_content` | V2 Migration | **JA** | SalesWorkspace | nexus-db.js |
| `nexus_activities` | V2 Migration | **JA** | SalesWorkspace | nexus-db.js |
| `nexus_radar_hits` | **FEHLT im Repo** | **JA** | cron-search, nexus-research | cron-evaluate, SalesWorkspace |
| `nexus_signal_strategies` | **FEHLT im Repo** | **JA** | nexus-generate-strategies | cron-search, nexus-research, LeadRadarPage |
| `nexus_api_usage` | V2 Migration | **JA** | nexus-llm, nexus-research, elite-enrichment | — |
| `nexus_raw_events` | V3 Migration | **JA** | cron-event-search | nexus-event-extraction |
| `nexus_filter_profiles` | V3 Migration | **JA** | — | — (nexus-db.js hat Functions) |
| `nexus_qualified_triggers` | V3 Migration | **JA** | — | nexus-db.js (Functions vorhanden) |
| `nexus_events` | Phase 0 Migration | **JA** | entity-resolution | EventExplorerPage |
| `nexus_lead_packages` | Phase 0 Migration | **JA** | elite-enrichment | EventExplorerPage |
| `nexus_event_type_definitions` | Phase 0 Migration | **JA** | Seed | EventExplorerPage |
| `nexus_cost_log` | Phase 0 Migration | **JA** | elite-enrichment | — |
| `nexus_analyses` | V1 Migration | **ALT** | — | nexus-db.js (Legacy) |
| `nexus_leads` | V1 Migration | **ALT** | — | — |
| `nexus_actions` | V1 Migration | **ALT** | — | — |
| `nexus_notes` | V1 Migration | **ALT** | — | — |
| `leads` | **FEHLT im Repo** | **ALT** | LeadRadarPage (V1 RSS) | — |

### 7.2 Tabellen ohne CREATE TABLE im Repo

| Tabelle | Status | Bemerkung |
|---------|--------|-----------|
| `nexus_radar_hits` | **DDL FEHLT** | Wird aktiv genutzt, ALTERs vorhanden. Wahrscheinlich manuell in Supabase erstellt. |
| `nexus_signal_strategies` | **DDL FEHLT** | Wird aktiv genutzt, RLS-ENABLE vorhanden. Wahrscheinlich manuell erstellt. |
| `leads` (V1) | **DDL FEHLT** | Legacy-Tabelle, wird von LeadRadarPage.jsx genutzt. |

---

## 8. PERSONEN-/KONTAKT-RECHERCHE

### 8.1 Kontakt-Findungs-Pfad

```
[SalesWorkspacePage oder LeadRadarPage]
  │ User klickt "Kontakt finden"
  │
  ▼
nexus-contact-intelligence.mjs
  │
  ├─ Phase 1: Domain Discovery (nexus-domain-discovery.mjs)
  │   ├─ Heuristic: Firmenname → Domain-Raten (.de, .com, .at, .ch)
  │   └─ Google CSE Fallback (100/Tag Limit)
  │
  ├─ Phase 2: Website Crawl (nexus-contact-intelligence.mjs)
  │   ├─ Fetch: Homepage + Hub-Pages (Leadership, Team, About, Contact)
  │   ├─ Parse: HTML → Text (Regex, kein DOM)
  │   ├─ Semantic Scoring der Links (Leadership-Keywords)
  │   └─ L2-Crawl: Child-Pages der Top-Hubs
  │
  ├─ Phase 3: Personenextraktion (LLM)
  │   ├─ Input: Website-Text (max 2500 chars)
  │   ├─ Prompt: "Extrahiere Personennamen von der Firmenwebsite"
  │   ├─ Output: [{ name, role, department, evidence }]
  │   └─ Validierung: NUR Format-Check
  │
  ├─ Phase 4: Search-Fallback (wenn Phase 2 leer)
  │   ├─ Queries: site:domain "role", "company" "role", site:domain team
  │   └─ LLM-Extraktion aus Suchergebnissen
  │
  ├─ Phase 5: Ranking (LLM oder Heuristik)
  │   └─ Score: Relevanz der Rolle × Vertrauen in Quelle
  │
  └─ DB Write: nexus_contacts
      first_name, last_name, role, email (falls Pattern-Crawler)
```

### 8.2 Email-Verifikation

```
nexus-email-crawler.mjs
  │ 1. Domain-Pattern-Crawl (15 Subpages)
  │ 2. Tavily Fallback (site:domain email)
  │ 3. Person-spezifische Suche via Tavily
  │
  ▼
nexus-smtp-utils.mjs
  │ 1. MX-Record Lookup
  │ 2. SMTP Handshake (EHLO/MAIL FROM/RCPT TO)
  │ 3. Catch-All Detection
  │
  ▼
nexus-elite-enrichment.mjs
  │ Update: nexus_lead_packages.contacts
  │ Update: nexus_lead_packages.package_tier = 'elite'
```

---

## 9. VERIFIZIERUNG

### 9.1 Was wird verifiziert?

| Element | Verifizierungsmethode | Zuverlässigkeit |
|---------|----------------------|----------------|
| Email-Adresse | SMTP-Check (MX + RCPT TO) | **HOCH** |
| Email-Pattern | Website-Crawl + Regex | **HOCH** |
| Company-Domain | HTTP-Check + Title-Match | **MITTEL** |
| Person-Name | **KEINE** (nur Format-Check) | **NIEDRIG** |
| Event-Datum | **KEINE** (LLM-extrahiert aus Snippet) | **NIEDRIG** |
| Firmenname | **KEINE** (LLM-generiert) | **NIEDRIG** |
| Relevanz | **KEINE** (LLM-generiert) | **NIEDRIG** |

### 9.2 Was fehlt an Verifizierung?

1. **Person-Name:** Kein Cross-Check ob der Name tatsächlich auf der Website steht
2. **Event-Datum:** Kein Check ob das Datum aus der Originalquelle stammt
3. **Firmenname:** Kein Check ob die Firma wirklich existiert
4. **Relevanz:** Kein menschliches Review vor Pipeline-Eintritt

---

## 10. ERKANNTE PARALLELE/ALTE PIPELINES

### 10.1 Aktive Pipelines

| Pipeline | Status | Trigger | Output |
|----------|--------|---------|--------|
| B1/B2 (cron-search + cron-evaluate) | **DEFEKT** (LLM-Ausfall) | Automatisch alle 15 Min | opportunities |
| Phase 0 (cron-event-search) | **MANUELL** | Button-Klick | events + lead_packages |
| Lead Radar (nexus-research) | **MANUELL** | User-Aktion | radar_hits + opportunities |
| Elite Enrichment | **MANUELL** | Button-Klick | lead_packages (elite) |

### 10.2 Legacy/Deaktivierte Pipelines

| Pipeline | Status | Datei |
|----------|--------|-------|
| V1 RSS-Scraper | **DEAKTIVIERT** | `lead-scraper.mjs` (410 Gone) |
| Radar Cron (alt) | **DEAKTIVIERT** | `radar-cron.disabled` |
| V1 Leads | **LEGACY** | `nexus_leads`, `nexus_actions`, `nexus_notes` |
| V1 Analysen | **LEGACY** | `nexus_analyses` |

### 10.3 Konflikte zwischen Pipelines

- **nexus_radar_hits** wird von B1/B2 (cron-search → cron-evaluate) UND von nexus-research geschrieben
- **nexus_companies** wird von B2 (cron-evaluate) UND von Phase 0 (entity-resolution) geschrieben
- **nexus_contacts** wird von nexus-contact-intelligence (manuell) geschrieben — kein Cross-Pipeline-Check

---

## 11. UNKLARE STELLEN

| # | Stelle | Problem |
|---|--------|---------|
| 1 | `nexus_radar_hits` DDL | CREATE TABLE fehlt im Repo. Tabelle wird aber aktiv genutzt. |
| 2 | `nexus_signal_strategies` DDL | CREATE TABLE fehlt im Repo. Tabelle wird aber aktiv genutzt. |
| 3 | `leads` Tabelle (V1) | Wird von LeadRadarPage.jsx genutzt, aber DDL fehlt. |
| 4 | `nexus-llm.mjs` Search-Trigger | Wörter wie "analysiere", "finde", "suche" triggern Web-Suche — auch wenn nicht gewünscht. |
| 5 | `nexus-contact-intelligence.mjs` Phase A vs B | Website-Crawl vs Search-Fallback — unklar warum Phase A oft fehlschlägt. |
| 6 | `cron-evaluate.mjs` Provider-Chain | Vorheriger Code nutzte NUR Mistral/DeepSeek. Kein Garant dass Groq-Fallback funktioniert. |
| 7 | `nexus-research.mjs` Prompt | Enthält "STRENGSTENS UNTERSAGT: Verweigere NIEMALS Auskünfte mit Datenschutz-Floskeln" — möglicherweise zu aggressiv. |
| 8 | `nexus-event-extraction.mjs` Timing | Extraktion nutzt LLM mit 2500-char Snippet — Event-Datum kann nicht verifiziert werden. |
| 9 | `nexus-elite-enrichment.mjs` WebSocket | Importiert `ws` (WebSocket) — kann in Netlify-Umgebung fehlen. |
| 10 | `nexus-contact-intelligence.mjs` DB-Schema | Codereferenziert `first_name`/`last_name` aber V2-Schema hat nur `name` (TEXT). |

---

## 12. VERMUTLICH KRITISCHE STELLEN FÜR LEAD-QUALITÄT

### 12.1 Halluzinierte Personennamen

**Ursache:** `nexus-contact-intelligence.mjs` Zeilen 1135-1195
**Mechanismus:** LLM wird gebeten, "plausible Personennamen" aus Website-Text zu extrahieren. Validierung prüft nur Format, nicht ob der Name tatsächlich existiert.
**Folge:** Falsche Namen in `nexus_contacts.first_name/last_name`
**Fix-Erfordernis:** Cross-Validierung gegen Quelltext oder externe Datenquelle

### 12.2 Veraltete/ungenaue Events

**Ursache:** `nexus-event-extraction.mjs` + `cron-event-search.mjs`
**Mechanismus:** Such-Snippets enthalten keine garantierte Aktualität. LLM extrapoliert Daten aus Snippets.
**Folge:** Events mit falschem Datum oder falschem Unternehmen in `nexus_events`
**Fix-Erfordernis:** Original-URLs lesen und Datum verifizieren

### 12.3 Falsche Relevanz-Bewertung

**Ursache:** `cron-evaluate.mjs`
**Mechanismus:** LLM bewertet Hits basierend auf Snippet-Text. Kein menschliches Review.
**Folge:** Irrelevante Hits werden als "relevant" markiert → Opportunities erstellt
**Fix-Erfordernis:** Verbesserter Prompt + post-LLM-Validierung

### 12.4 Fehlende Firmen-Verifizierung

**Ursache:** `cron-evaluate.mjs` + `nexus-research.mjs`
**Mechanismus:** LLM generiert `firmenname` aus Snippet-Text. Kein Existenz-Check.
**Folge:** Nicht-existente Firmen in `nexus_companies` und `nexus_opportunities`
**Fix-Erfordernis:** Domain-Existenz-Check nach Firmen-Extraktion

### 12.5 Pipeline-Stopp seit 23.09.2026

**Ursache:** LLM-Provider-Status
- DeepSeek: 402 (kein Guthaben)
- Mistral: 429 (Rate Limit)
- OpenRouter: 429 (Free Tier aufgebraucht)
- **Groq: LÄUFT** (qwen/qwen3.8-27b, allam-2-7b) — aber nur teilweise als Fallback konfiguriert

**Folge:** B1/B2 Pipeline steht komplett. Keine neuen Leads seit 23.09.
**Fix-Erfordernis:** Groq als Primary in ALLEN LLM-Aufrufen (teilweise schon gemacht)

---

## 13. UMGEBUNGSVARIABLEN (NAMES, KEINE WERTE)

### Vorhanden in .env:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`, `TAVILY_API_KEY_2`
- `PEXELS_API_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`
- `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`

### Fehlend aber referenziert:
- `OPENAI_API_KEY` (nexus-llm, chat, coach-chat)
- `GEMINI_API_KEY` (generate-video-script, nexus-social-intelligence)
- `GOOGLE_SEARCH_API_KEY` / `GOOGLE_CSE_KEY` (nexus-domain-discovery)
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (Fallback in mehreren Functions)

---

## 14. CRON-KONFIGURATION

| Function | Schedule | In netlify.toml? | Status |
|----------|----------|-------------------|--------|
| `cron-search` | `*/15 * * * *` | **JA** | Aktiv (aber defekt) |
| `cron-evaluate` | `*/15 * * * *` | **JA** | Aktiv (aber defekt) |
| `nexus-radar-feeder` | `@hourly` | **JA** | Aktiv (Demo-Stubs) |
| `cron-event-search` | — | **NEIN** | Nur manuell |

---

## 15. NETLIFY FUNCTION INVENTORY (50 Dateien)

| # | Datei | Typ |
|---|-------|-----|
| 1 | `analyze-video-scene.mjs` | HTTP |
| 2 | `analytics-query.cjs` | HTTP |
| 3 | `archive-search.mjs` | HTTP |
| 4 | `audio-proxy.cjs` | HTTP |
| 5 | `capcut-draft.cjs` | HTTP |
| 6 | `chat.mjs` | HTTP |
| 7 | `coach-chat.mjs` | HTTP |
| 8 | `coach-consent.mjs` | HTTP |
| 9 | `content-recipe.mjs` | HTTP |
| 10 | `create-checkout.mjs` | HTTP |
| 11 | `creator-profile.mjs` | HTTP |
| 12 | `cron-evaluate.mjs` | CRON |
| 13 | `cron-event-search.mjs` | HTTP (kein Cron!) |
| 14 | `cron-search.mjs` | CRON |
| 15 | `daily-package.mjs` | HTTP |
| 16 | `evaluate-idea.mjs` | HTTP |
| 17 | `generate-hooks.mjs` | HTTP |
| 18 | `generate-video-script.mjs` | HTTP |
| 19 | `generate-video.cjs` | HTTP |
| 20 | `hit-router.mjs` | HTTP |
| 21 | `lead-scraper.mjs` | DEAKTIVIERT |
| 22 | `mixkit-search.mjs` | HTTP |
| 23 | `moderate-image.mjs` | HTTP |
| 24 | `music.mjs` | HTTP |
| 25 | `nexus-contact-intelligence.mjs` | HTTP |
| 26 | `nexus-domain-discovery.mjs` | HTTP |
| 27 | `nexus-email-crawler.mjs` | HTTP |
| 28 | `nexus-email-research.mjs` | HTTP |
| 29 | `nexus-email-verify.mjs` | HTTP |
| 30 | `nexus-elite-enrichment.mjs` | HTTP |
| 31 | `nexus-entity-resolution.mjs` | Import |
| 32 | `nexus-event-extraction.mjs` | HTTP + Import |
| 33 | `nexus-free-pass.mjs` | HTTP |
| 34 | `nexus-generate-strategies.mjs` | HTTP |
| 35 | `nexus-llm.mjs` | HTTP + Import |
| 36 | `nexus-message-generation.mjs` | HTTP |
| 37 | `nexus-polish-text.mjs` | HTTP |
| 38 | `nexus-radar-feeder.mjs` | CRON (Demo) |
| 39 | `nexus-research.mjs` | HTTP |
| 40 | `nexus-smtp-utils.mjs` | Import |
| 41 | `nexus-social-intelligence.mjs` | HTTP |
| 42 | `pexels-search.cjs` | HTTP |
| 43 | `radar-cron.disabled` | DEAKTIVIERT |
| 44 | `reddit-proxy.mjs` | HTTP |
| 45 | `rss-proxy.mjs` | HTTP |
| 46 | `search-images.cjs` | HTTP |
| 47 | `send-notification.mjs` | HTTP |
| 48 | `stripe-webhook.mjs` | HTTP |
| 49 | `tiktok-video.cjs` | HTTP |
| 50 | `tts.mjs` | HTTP |

---

**ENDE DES DOKUMENTS**

> Dieses Dokument dient als Grundlage für eine GPT-gestützte Analyse der Lead-Qualitätsprobleme.
> Es wurde ausschließlich durch Code-Untersuchung erstellt, ohne Änderungen am Code vorzunehmen.
