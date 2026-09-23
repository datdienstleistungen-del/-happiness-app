# NEXUS 2.0 PRE-PHASE-0 DECISION REPORT

**Status:** READ-ONLY ANALYSE — Keine Implementierung, keine Migration, keine DB-Änderungen.
**Datum:** 2026-09-23
**Basis:** Tatsächlicher Codebestand auf `main` (Commit `f46fe4a`)
**Audit-Prompt:** Basierend auf dem 21-Sektionen-Pre-Phase-0-Validierungs-Prompt

---

## 1. Executive Summary

**KERNERGEBNIS: Ein erheblicher Teil der geplanten NEXUS-2.0-Architektur existiert bereits in V2 — aber in Offering-gebundener Form. Die V3-Pipeline (nexus_raw_events, nexus_filter_profiles, nexus_qualified_triggers) existiert als Schema, wird aber von NULL Anwendungscode verwendet.**

### Feststellungen:

1. **19 NeXus-Tabellen** existieren in der Datenbank. Davon 3 ohne DDL im Repo (radar_hits, signal_strategies, free_passes).
2. **Die V3-Pipeline-Tabellen existieren als Schema, werden aber von NULL Anwendungscode verwendet.** Keine Function, kein Frontend, kein Cron-Job greift auf nexus_raw_events, nexus_filter_profiles oder nexus_qualified_triggers zu.
3. **Die aktuelle V2-Pipeline ist funktional und produktiv:** B1 (Tavily Search) → B2 (DeepSeek Evaluate) → Companies → Trigger Events → Opportunities. Dieser Flow funktioniert Ende-zu-Ende.
4. **Das grundsätzliche Problem ist NICHT fehlnde Infrastruktur, sondern Offering-Abhängigkeit:** Die gesamte Pipeline ist an `nexus_offerings` gebunden. Jeder Search, jede Evaluation, jedes Ergebnis braucht ein offering_id.
5. **Kosten:** Die aktuelle Pipeline nutzt Groq (Free Tier) als primären LLM-Provider. Tavily (4 Keys) ist die primäre Such-API. DeepSeek/Mistral/OpenRouter sind Fallbacks. **Es gibt NULL Kosten-Tracking.**
6. **Lead Package:** Ein verkaufsfähiges Lead Package existiert als Konzept noch NICHT. Die aktuelle Pipeline erzeugt Trigger Events + Opportunities, aber KEINE strukturierten, exportierbaren Lead Packages.
7. **Deduplizierung:** URL-basiert (MD5) ist produktiv. Firmen-Dedup (Domain + Name) ist funktional. **Fehlend:** Event-Dedup über Quellen hinweg, fuzzy Name Matching, Content-basierte Dedup.
8. **Entity Resolution:** Domain-Discovery und Firmen-Normalisierung sind sehr reif. **Fehlend:** Cross-User Entity Resolution, Event-Matching über Quellen hinweg.

### EMPFEHLUNG: **V3 MIGRIEREN / UMBAUEN**

Die V3-Pipeline-Tabellen (raw_events, filter_profiles, qualified_triggers) bieten eine solide Architektur für den Rohdaten-Pool und die Filterlogik. Sie werden aber nie verwendet. Die Entscheidung ist:

- **nexus_raw_events** → Übernehmen als zentraler Rohdaten-Pool (bereits Offering-unabhängig!)
- **nexus_filter_profiles** → Übernehmen als Event-Type-basierte Suchprofile
- **nexus_qualified_triggers** → Erweitern zu Lead Packages (ist bereits Offering-unabhängig!)
- **nexus_trigger_events** → Behalten als V2-Legacy, parallel dazu nexus_events neu aufbauen

Die beste Strategie ist ein Hybrid: Bestehende V2-Pipeline (die funktioniert) um eine Offering-unabhängige Event-Ebene erweitern, V3-Tabellen aktivieren, und die beste Infrastruktur aus beiden Welten nutzen.

---

## 2. Aktueller technischer Zustand

### 2.1 Tech-Stack

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Frontend | React + Vite | 19 / 6 |
| Backend | Netlify Functions | 15 Dateien, ~7.500 Zeilen |
| Database | Supabase (PostgreSQL) | 19 NeXus-Tabellen |
| AI (primär) | Groq | Free Tier (5 Modelle cascade) |
| AI (Fallback) | Mistral → OpenRouter → DeepSeek → OpenAI | |
| Search (primär) | Tavily | 4 API-Keys |
| Search (Fallback) | DuckDuckGo → Brave → SearXNG | |
| Hosting | Netlify | Auto-Deploy von main |
| Auth | Supabase Auth | Email/Password |

### 2.2 Pipeline-Status (produktiv)

```
STATUS: B1+B2 CRON PIPELINE FUNKTIONIERT E2E
Schedule: Alle 15 Minuten (*/15 * * * *)
```

| Phase | Status | Datei |
|-------|--------|-------|
| B1: Tavily Search | ✅ Produktiv | `cron-search.mjs` |
| B2: DeepSeek Evaluate | ✅ Produktiv | `cron-evaluate.mjs` |
| Company-Erstellung | ✅ Automatisch | (cron-evaluate) |
| Trigger Event-Erstellung | ✅ Automatisch | (cron-evaluate) |
| Opportunity-Erstellung | ✅ Automatisch | (cron-evaluate) |
| Contact Intelligence | ✅ Manuell auslösbar | `nexus-contact-intelligence.mjs` |
| Message Generation | ✅ Manuell auslösbar | `nexus-message-generation.mjs` |

### 2.3 Bekannte Probleme

1. **B1-Suchrauschen:** Viele irrelevante Treffer (Job-Börsen, Instagram, FAZ-Artikel). Qualitätsfrage der Suchstrategie.
2. **Offering-Abhängigkeit:** Pipeline funktioniert NUR wenn der User ein Offering definiert hat.
3. **39 alte Trigger Events** ohne `radar_hit_id` (historisch).
4. **RLS deaktiviert** auf: nexus_opportunities, nexus_opportunity_contacts, nexus_opportunity_triggers, nexus_generated_content, nexus_activities.

### 2.4 Schema Drift

| Tabelle | Problem |
|---------|---------|
| `nexus_contacts` | DDL: `name TEXT NOT NULL`. Code: `first_name`/`last_name` (manuelle Migration erfasst) |
| `nexus_offerings` | `is_scanning`, `last_scanned_at` in Code aber nicht in DDL |
| `nexus_activities` | `opportunity_id`, `metadata` in Code aber nicht in DDL |
| `nexus_radar_hits` | Komplettes Schema nur aus Code rekonstruierbar (kein DDL im Repo) |

---

## 3. V3-Pipeline Analyse

### 3.1 nexus_raw_events

**Status: SCHEMA EXISTIERT, WIRD NICHT VERWENDET**

| Eigenschaft | Wert |
|-------------|------|
| DDL | ✅ `20260916_create_nexus_v3_crawler_pipeline.sql` |
| RLS | ✅ Authenticated can read |
| Application Code | **NULL** — Keine Function, kein Frontend greift darauf zu |
| Daten | Vermutlich leer (kein INSERT-Code vorhanden) |
| Dedup | `content_hash` (SHA256) UNIQUE + `source_url` UNIQUE |
| Full-Text Search | ✅ `tsv_content` (German + English) mit GIN-Index |
| Trigger | ✅ `trg_nexus_raw_events_tsv` (auto-generiert tsv_content) |

**Spalten:**
```
id: UUID PK
source_platform: TEXT NOT NULL (z.B. 'rss_news', 'handelsregister', 'reddit')
source_url: TEXT UNIQUE NOT NULL
title: TEXT
raw_content: TEXT NOT NULL
content_hash: TEXT UNIQUE NOT NULL (SHA256)
author: TEXT
published_at: TIMESTAMPTZ
crawled_at: TIMESTAMPTZ DEFAULT NOW()
tsv_content: TSVECTOR (auto-generated)
```

**Bewertung:** Exzellentes Design. `content_hash` für 0ms-Dedup, Full-Text Search für schnelle Queries, Offering-unabhängig. **Aber: Wird nie verwendet.**

### 3.2 nexus_filter_profiles

**Status: SCHEMA EXISTIERT, WIRD NICHT VERWENDET**

| Eigenschaft | Wert |
|-------------|------|
| DDL | ✅ `20260916_create_nexus_v3_crawler_pipeline.sql` |
| RLS | ✅ Full CRUD per user_id |
| Application Code | **NULL** — Keine Function, kein Frontend greift darauf zu |
| Daten | Vermutlich leer |

**Spalten:**
```
id: UUID PK
user_id: UUID FK → auth.users
offering_id: UUID FK → nexus_offerings
target_keywords: TEXT[]
negative_keywords: TEXT[]
industry: TEXT
is_active: BOOLEAN DEFAULT TRUE
created_at/updated_at: TIMESTAMPTZ
```

**Bewertung:** Solides Design für Suchprofile. **ABER: Noch an offering_id gebunden!** Für die universelle Event-Architektur müsste `offering_id` NULLABLE werden oder durch `event_type` ersetzt werden.

### 3.3 nexus_qualified_triggers

**Status: SCHEMA EXISTIERT, WIRD NICHT VERWENDET**

| Eigenschaft | Wert |
|-------------|------|
| DDL | ✅ `20260916_create_nexus_v3_crawler_pipeline.sql` |
| RLS | ✅ Full CRUD per user_id |
| Application Code | **NULL** — Keine Function, kein Frontend greift darauf zu |
| Daten | Vermutlich leer |

**Spalten:**
```
id: UUID PK
raw_event_id: UUID FK → nexus_raw_events
filter_profile_id: UUID FK → nexus_filter_profiles
user_id: UUID FK → auth.users
company_name: TEXT NOT NULL
contact_person: TEXT
contact_role: TEXT
contact_email: TEXT
trigger_signal: TEXT NOT NULL
intent_score: INTEGER DEFAULT 85
ai_reasoning: TEXT
pitch_hook: TEXT
status: TEXT DEFAULT 'NEW' (CHECK: NEW/REVIEWED/CONTACTED/ARCHIVED)
created_at/updated_at: TIMESTAMPTZ
```

**Bewertung:** Dies ist im Grunde bereits ein Lead Package! Enthält: Unternehmen, Kontext, Score, Status, AI-Reasoning. **Könnte zur Basis für nexus_lead_packages werden.**

### 3.4 V3 vs. Zielarchitektur — Matrix

| Zielkomponente | V3 vorhanden? | Vollständig? | Wo im Code? | Was fehlt? | Wiederverwendbar? |
|---|---|---|---|---|---|
| **Discovery** | MISSING | — | Kein Code | Event-Type-basierte Suche | Nicht wiederverwendbar |
| **Extraction** | MISSING | — | Kein Code | Strukturierung von Suchergebnissen | Nicht wiederverwendbar |
| **Normalization** | PARTIAL | — | `tsv_content` Trigger | Strukturierung, Standardisierung | Teilweise |
| **Entity Resolution** | MISSING | — | Kein Code | Firmen-Matching, Event-Matching | Nicht wiederverwendbar |
| **Verification** | MISSING | — | Kein Code | Quellen-Check, Status-Chain | Nicht wiederverwendbar |
| **Enrichment** | MISSING | — | Kein Code | Contact-Finding, Größenordnung | Nicht wiederverwendbar |
| **Lead Package** | PARTIAL | — | `nexus_qualified_triggers` Schema | Verkaufsfähigkeit, Evidence, Export | Schema ja, Logik nein |
| **Rohdaten-Pool** | EXISTS | VOLLSTÄNDIG | `nexus_raw_events` Schema | Application Code | Schema ja, Logik nein |
| **Suchfilter** | EXISTS | TEILWEISE | `nexus_filter_profiles` Schema | Offering-Unabhängigkeit | Schema ja, Logik nein |

### 3.5 Fazit V3

**Die V3-Pipeline ist ein gut designtes, aber nie implementiertes Schema.** Die Tabellen existieren, sind korrekt strukturiert, haben RLS und Indizes — aber NULL Anwendungscode nutzt sie. Die Frage ist nicht "V3 weiterbauen oder neu?", sondern "V3 aktivieren und bestehende V2-Logik integrieren."

---

## 4. V3 vs. neue Architektur

### 4.1 Bewertung der drei Strategien

#### Option A: V3 WEITERBAUEN
- **Bewertung:** NICHT MÖGLICH. V3 hat keinen Code zum Weiterbauen.
- **Grund:** Die V3-Tabellen sind Schema-only. Es gibt null Funktionen, null Frontend, null Cron-Jobs.

#### Option B: V3 MIGRIEREN / UMBAUEN (EMPFOHLEN)
- **Bewertung:** BESTE OPTION
- **Grund:** V3 bietet solide Schema-Designs (content_hash, tsv_content, qualified_triggers als Lead-Package-Vorlage). Die V2-Pipeline bietet produktive Logik (B1/B2 Cron, Contact Intelligence). Die Kombination ist stärker als beides einzeln.

#### Option C: NEUE PIPELINE
- **Bewertung:** ÜBERFLÜSSIG
- **Grund:** Die meiste gesuchte Infrastruktur existiert bereits. Eine komplett neue Pipeline würde bestehende funktionierende Logik duplizieren.

### 4.2 Empfohlene Strategie: HYBRID

```
BESTEHENDE V2-PIPELINE (funktional, Offering-gebunden)
    ↓
    ┌─── NEU: Offering-unabhängige Event-Discovery ───┐
    │  Nutzt: Tavily (bereits vorhanden)              │
    │  Nutzt: Groq/DeepSeek (bereits vorhanden)       │
    │  Nutzt: nexus_raw_events (V3, neu aktiviert)    │
    │  NEU: Event-Type-Definitionen                   │
    │  NEU: Event-Extraktion (AI-Prompt)              │
    └─────────────────────────────────────────────────┘
    ↓
    ┌─── NEU: Entity Resolution ──────────────────────┐
    │  Nutzt: nexus_companies (bereits vorhanden)     │
    │  ERWEITERT: Firmen-Matching (fuzzy)             │
    │  NEU: Event-Matching (company+type+date)        │
    └─────────────────────────────────────────────────┘
    ↓
    ┌─── BESTEHEND: B2 Evaluation (angepasst) ───────┐
    │  Nutzt: cron-evaluate.mjs (modifiziert)        │
    │  ERWEITERT: Event-basiert (nicht Offering)      │
    └─────────────────────────────────────────────────┘
    ↓
    ┌─── NEU: Lead Package Builder ───────────────────┐
    │  Nutzt: nexus_qualified_triggers (V3, erweitert)│
    │  ERWEITERT: Evidence, Quality Score, Export     │
    └─────────────────────────────────────────────────┘
    ↓
    ┌─── BESTEHEND: Contact Intelligence ────────────┐
    │  Nutzt: nexus-contact-intelligence.mjs          │
    │  ERWEITERT: Event-basiert (nicht Opportunity)   │
    └─────────────────────────────────────────────────┘
```

---

## 5. Was bereits existiert

### 5.1 Vollständig produktiv

| Komponente | Datei | Status |
|------------|-------|--------|
| B1 Tavily Search | `cron-search.mjs` | ✅ Produktiv, alle 15 Min |
| B2 DeepSeek Evaluate | `cron-evaluate.mjs` | ✅ Produktiv, alle 15 Min |
| Contact Intelligence | `nexus-contact-intelligence.mjs` | ✅ Funktioniert (1848 Zeilen) |
| Email Pattern Crawler | `nexus-email-crawler.mjs` | ✅ Funktioniert (1013 Zeilen) |
| Email SMTP Verify | `nexus-email-verify.mjs` | ✅ Funktioniert (258 Zeilen) |
| Domain Discovery | `nexus-domain-discovery.mjs` | ✅ Funktioniert (463 Zeilen) |
| Message Generation | `nexus-message-generation.mjs` | ✅ Funktioniert (235 Zeilen) |
| Social Intelligence | `nexus-social-intelligence.mjs` | ✅ Funktioniert (767 Zeilen) |
| Multi-Provider LLM | `nexus-llm.mjs` | ✅ Funktioniert (679 Zeilen) |
| Strategy Generation | `nexus-generate-strategies.mjs` | ✅ Funktioniert (244 Zeilen) |
| DB CRUD | `nexus-db.js` | ✅ 38 Funktionen (605 Zeilen) |
| AI Client | `nexus-ai.js` | ✅ 14 Modi (752 Zeilen) |
| Coach | `nexus-coach.js` + `CoachChatPage.jsx` | ✅ Funktioniert |

### 5.2 Schema vorhanden, Code fehlt

| Komponente | Datei | Status |
|------------|-------|--------|
| Raw Events Pool | `nexus_raw_events` (SQL) | ⚠️ Schema da, 0 Code |
| Filter Profiles | `nexus_filter_profiles` (SQL) | ⚠️ Schema da, 0 Code |
| Qualified Triggers | `nexus_qualified_triggers` (SQL) | ⚠️ Schema da, 0 Code |

### 5.3 Teilweise vorhanden

| Komponente | Status | Was fehlt |
|------------|--------|-----------|
| Entity Resolution | Domain-Discovery reif, Name-Normalisierung reif | Fuzzy Matching, Cross-User |
| Deduplizierung | URL-Hash produktiv | Content-basiert, Event-basiert |
| Verification | Status-Chain in V2.1 definiert | Automatisierung |
| Lead Package | Konzept in qualified_triggers | Verkaufsfähigkeit, Export |

---

## 6. Was fehlt

### 6.1 Kritische Fehlende Teile

| Fehlend | Schwere | Begründung |
|---------|---------|------------|
| **Event-Type-Definitionen** | Hoch | Ohne definierte Event-Typen keine gezielte Suche |
| **Event-Extraktion (AI-Prompt)** | Hoch | Suchergebnis → strukturiertes Event |
| **Event-Matching / Dedup** | Hoch | Gleicher Event aus verschiedenen Quellen |
| **Offering-Unabhängige Discovery** | Hoch | Pipeline muss auch ohne Offering funktionieren |
| **Lead Package Builder** | Hoch | Event → verkaufsfähiges Package |
| **Event-Level Provenance** | Mittel | Welche Quellen belegen welches Event? |
| **Fuzzy Company Matching** | Mittel | "Mueller" vs "Müller" |
| **Cross-User Entity Resolution** | Niedrig | erstrelevant wenn Multi-Team |

### 6.2 Was NICHT fehlt

| Vorhanden | Grund |
|-----------|-------|
| Tavily Search Infrastruktur | 4 Keys, Fallback-Chain |
| LLM Infrastruktur | 5 Provider, Fallback-Chain |
| DB Schema für Raw Events | V3 nexus_raw_events |
| DB Schema für Filter | V3 nexus_filter_profiles |
| Company/Contact DB | nexus_companies, nexus_contacts |
| URL-Dedup | MD5 hash + unique constraint |
| Domain-Discovery | 2-Stage, sehr reif |
| Email-Findung | Crawler + Pattern + SMTP Verify |
| Contact Intelligence | 1848 Zeilen, produktiv |
| Cron-Infrastruktur | claim/evaluate/reset RPCs |

---

## 7. Lead Package Definition

### 7.1 Company-Level Lead

**Kann ein Company-Level Lead bereits ein verkaufbares Produkt sein?**

**JA — unter bestimmten Bedingungen.**

Ein Company-Level Lead ist verkauft, wenn:
- ✅ Unternehmen korrekt identifiziert
- ✅ Business Event dokumentiert (Expansion, Investition, Hiring, etc.)
- ✅ Quellen vorhanden (mindestens 1 belastbare URL)
- ✅ Event ist aktuell (< 30 Tage)
- ✅ Event ist wirtschaftlich relevant (nicht trivial)
- ❌ KEIN persönlicher Kontakt zwingend erforderlich

**Beispiel Käufer:** Eine Personalvermittlung kauft "Firma X baut Werk X aus" — auch ohne Ansprechpartner. Der Käufer hat eigene Kanäle für die Kontaktaufnahme.

### 7.2 Contact-Level Lead

**Wann wird ein persönlicher Kontakt erforderlich?**

Persönliche Kontakte werden erforderlich, wenn:
- Der Käufer eine direkte Erstansprache erwartet
- Das Event eine hohe Dringlichkeit hat (z.B. Ausschreibung mit Deadline)
- Der Markt kompetitiv ist (mehrere Anbieter)
- Das Lead Package als "vollständig" verkauft werden soll

### 7.3 Business-Event Lead

Ein Business-Event Lead kombiniert:
- Company + Event + Context + (optional) Kontakt

### 7.4 Qualified Opportunity

Eine Qualified Opportunity ist:
- Business Event + Offering-Match + Fit-Score + Timing

### 7.5 Feld-Analyse

| Feld | Pflicht | Begründung |
|------|---------|------------|
| Unternehmen | **MANDATORY** | Ohne Unternehmen kein Lead |
| Unternehmensdomain | **MANDATORY** | Verifizierung + Kontakt-Findung |
| Branche | **OPTIONAL** | Hilfreich für Filtering |
| Standort | **MANDATORY** (Land) | Relevanz-Bewertung |
| Event | **MANDATORY** | Das Kernprodukt |
| Event-Typ | **MANDATORY** | Kategorisierung |
| Event-Datum | **MANDATORY** | Aktualität |
| Projekt / Geschäftskontext | **OPTIONAL** | Hilfreich aber nicht zwingend |
| Quelle | **MANDATORY** | Nachweis der Recherche |
| Source URL | **MANDATORY** | Verifizierbarkeit |
| Evidence | **MANDATORY** | Text-Auszug als Beleg |
| Verifizierungsstatus | **MANDATORY** | UNVERIFIED/VERIFIED |
| Aktualität | **MANDATORY** | Events > 30 Tage sind wertlos |
| Kontaktname | **NICE TO HAVE** | Erhöht den Wert erheblich |
| Position | **NICE TO HAVE** | Nur wenn Kontakt vorhanden |
| Abteilung | **NICE TO HAVE** | Nur wenn Kontakt vorhanden |
| E-Mail | **NICE TO HAVE** | Nur wenn Kontakt vorhanden |
| Telefonnummer | **NICE TO HAVE** | Nur wenn Kontakt vorhanden |
| LinkedIn | **NICE TO HAVE** | Nur wenn Kontakt vorhanden |

### 7.6 Antworten auf Schlüsselfragen

1. **Kann ein Lead Package ohne persönlichen Ansprechpartner verkauft werden?**
   JA. Company-Level Leads mit Event + Evidence sind verkaufbar. Der Wert steigt mit Kontakten, aber sie sind nicht zwingend.

2. **Kann ein Company-Level Lead bereits ein verkaufbares Produkt sein?**
   JA. Ein "Unternehmen X expandiert, Quelle Y, Datum Z" ist bereits verwertbare Geschäftsinformation.

3. **Wann wird aus einem Business Event ein Lead?**
   Wenn: Event aktuell (<30 Tage) + wirtschaftlich relevant + mindestens 1 belastbare Quelle + korrekt zugeordnetes Unternehmen.

4. **Wann wird ein persönlicher Kontakt erforderlich?**
   Wenn: Käufer Erstansprache erwartet ODER Markt kompetitiv ODER Deadline-Druck.

5. **Welche Informationen müssen zwingend verifiziert sein?**
   Company Name, Event-Typ, Event-Datum, Source URL.

6. **Was passiert, wenn kein persönlicher Kontakt öffentlich verfügbar ist?**
   Lead Package wird als "Company-Level" verkauft mit dem Hinweis: "Kontakt über allgemeine Kanäle empfohlen."

7. **Welche Daten dürfen aus Datenschutz-/Compliance-Sicht gespeichert werden?**
   Nur öffentlich verfügbare Daten: Firmendaten, öffentliche Event-Informationen, Quellen. Personenbezogene Daten nur mit Interesse an Kontaktaufnahme (DSGVO Art. 6 Abs. 1 lit. f).

8. **Welche Daten stammen direkt aus öffentlichen Quellen?**
   Firmenname, Domain, Event-Beschreibung, Quellen-URLs, Pressetexte.

9. **Welche Daten sind KI-abgeleitet?**
   Event-Klassifizierung, Relevanz-Score, AI-Reasoning, Pitch-Hook.

10. **Welche Daten sind verifiziert und welche nur wahrscheinlich?**
    Verified: Quellen-URLs, Firmenname (via Domain). Wahrscheinlich: Event-Details (AI-extrahiert), Kontakte (Pattern-generiert).

### 7.7 Minimum Sellable Lead Package

```json
{
  "company": {
    "name": "MANDATORY",
    "domain": "MANDATORY",
    "industry": "OPTIONAL",
    "country": "MANDATORY"
  },
  "event": {
    "type": "MANDATORY",
    "title": "MANDATORY",
    "description": "MANDATORY",
    "date": "MANDATORY",
    "confidence": "MANDATORY"
  },
  "evidence": {
    "source_url": "MANDATORY",
    "source_type": "MANDATORY",
    "excerpt": "MANDATORY"
  },
  "quality": {
    "verification_status": "MANDATORY",
    "freshness_days": "MANDATORY"
  }
}
```

### 7.8 Enriched Lead Package

```json
{
  "company": { "name", "domain", "industry", "country", "region", "city", "employee_count" },
  "event": { "type", "title", "description", "date", "confidence", "subtype" },
  "evidence": [{ "url", "type", "date", "excerpt" }],
  "contacts": [{ "name", "role", "email", "linkedin", "email_confidence" }],
  "quality": { "verification_status", "score", "freshness_days", "source_count" },
  "business_context": { "why_relevant", "timing", "urgency" }
}
```

---

## 8. Company-Level vs. Contact-Level Lead

### 8.1 Vergleich

| Eigenschaft | Company-Level Lead | Contact-Level Lead |
|-------------|-------------------|-------------------|
| Unternehmen | ✅ Pflicht | ✅ Pflicht |
| Event | ✅ Pflicht | ✅ Pflicht |
| Evidence | ✅ Pflicht | ✅ Pflicht |
| Kontakt | ❌ Nicht erforderlich | ✅ Pflicht |
| Verkaufbarkeit | JA (60-70% des Werts) | JA (100% des Werts) |
| Preisbasis | Niedriger | Höher |
| Aufwand | Gering | Hoch (Contact Intelligence) |
| Exportierbarkeit | Einfach | Einfach |
| Compliance-Risiko | Niedrig | Mittel (DSGVO) |

### 8.2 Empfehlung

**MVP:** Company-Level Lead Package als Standard. Contact-Level als Premium-Feature.

**Begründung:**
- Company-Level Leads können automatisch erzeugt werden (B1+B2 Pipeline)
- Contact Intelligence ist teuer (API-Aufrufe, crawling) und manchmal erfolglos
- Käufer wie Personalvermittlungen haben eigene Kanäle für Kontaktaufnahme
- Der Wert eines Leads liegt primär im Event, nicht im Kontakt

---

## 9. Datenanforderungen

### 9.1 Minimal Data Requirements pro Lead Package

```
MINIMUM:
├── company.name (NOT NULL)
├── company.domain (NOT NULL)
├── event.type (NOT NULL)
├── event.title (NOT NULL)
├── event.date (NOT NULL)
├── evidence.source_url (NOT NULL)
├── evidence.excerpt (NOT NULL)
└── quality.verification_status (DEFAULT 'unverified')

ENRICHED:
├── company.{ name, domain, industry, country, region, city, employee_count }
├── event.{ type, title, description, date, confidence, subtype }
├── evidence[{ url, type, date, excerpt }]
├── contacts[{ name, role, email, linkedin }]
├── quality.{ verification_status, score, freshness_days, source_count }
└── business_context.{ why_relevant, timing, urgency }
```

### 9.2 Datenfluss

```
DASHBOARD / EVENT EXPLORER
    ↓ (User wählt Event-Type)
EVENT DISCOVERY (Tavily Search)
    ↓ (Rohdaten: URLs + Titles + Snippets)
EVENT EXTRACTION (LLM)
    ↓ (Strukturiertes Event: Was, Wer, Wann, Wo)
ENTITY RESOLUTION
    ↓ (Firma + Event dedupliziert)
VERIFICATION
    ↓ (Quellen geprüft, Status gesetzt)
ENRICHMENT
    ↓ (Domain, Contacts, Größe)
LEAD PACKAGE
    ↓ (Verkaufsfähig)
EXPORT / SALE
```

---

## 10. Preproduction Cost Model

### 10.1 Kostenkette

| Schritt | Provider | Function | API Calls | Kosten pro Event |
|---------|----------|----------|-----------|-----------------|
| **Search** | Tavily (4 Keys) | cron-search, nexus-research | 1-5 queries | ~$0.005-0.025 |
| **Search Fallback** | DuckDuckGo | nexus-llm, nexus-research | 0-3 queries | $0.00 (Free) |
| **Search Fallback** | Brave Search | nexus-llm | 0-1 query | $0.00 (Free Tier) |
| **Extraction** | Groq (primär) | nexus-research, cron-evaluate | 1-2 calls | $0.00 (Free Tier) |
| **Extraction Fallback** | DeepSeek | nexus-research, cron-evaluate | 0-1 call | ~$0.001-0.005 |
| **Classification** | Groq | cron-evaluate | 1 call | $0.00 (Free Tier) |
| **Normalization** | Kein LLM | (deterministisch) | 0 | $0.00 |
| **Entity Resolution** | Kein LLM | (deterministisch) | 0 | $0.00 |
| **Verification** | Kein LLM | (HTTP-Check) | 0-1 HTTP | $0.00 |
| **Enrichment** | Tavily + DeepSeek | nexus-contact-intelligence | 1-3 calls | ~$0.01-0.05 |
| **Contact Finding** | Tavily + LLM | nexus-contact-intelligence | 2-5 calls | ~$0.02-0.10 |
| **Email Verify** | SMTP Socket | nexus-email-verify | 1 check | $0.00 |
| **Message Gen** | Groq | nexus-message-generation | 1 call | $0.00 (Free Tier) |

### 10.2 Geschätzte Gesamtkosten

| Szenario | Tavily | LLM (Groq) | LLM (DeepSeek) | SMTP | Gesamt |
|----------|--------|------------|----------------|------|--------|
| **100 Events** | $0.50-2.50 | $0.00 | $0.10-0.50 | $0.00 | **$0.60-3.00** |
| **1.000 Events** | $5.00-25.00 | $0.00 | $1.00-5.00 | $0.00 | **$6.00-30.00** |
| **10.000 Events** | $50.00-250.00 | $0.00 | $10.00-50.00 | $0.00 | **$60.00-300.00** |

**Hinweis:** Groq Free Tier hat Rate-Limits (Requests/Minute, Tokens/Minute). Bei hohem Volumen müsste auf bezahlte Tier gewechselt werden.

### 10.3 Kosten vor dem ersten Verkauf

| Posten | Geschätzte Kosten |
|--------|-------------------|
| **Einmalige Entwicklung** | 15-23 Stunden (Eigenleistung) |
| **Supabase** | $0 (Free Tier) |
| **Netlify** | $0 (Free Tier) |
| **Tavily (Test-Phase)** | $5-20 |
| **DeepSeek (Test-Phase)** | $1-5 |
| **Sonstige APIs** | $0 |
| **Gesamt (vor erstem Verkauf)** | **$6-25 + Eigenleistung** |

---

## 11. Tavily Cost Analysis

### 11.1 Wo wird Tavily verwendet?

| Function | Query-Typ | Search Depth | max_results | Häufigkeit |
|----------|-----------|-------------|-------------|------------|
| `cron-search.mjs` | Basic | advanced | 5 | Alle 15 Min pro Offering |
| `nexus-research.mjs` | Advanced + News | advanced | 10 | Manuell pro User-Request |
| `nexus-llm.mjs` | Basic | basic | 6 | On-demand (AI auto-search) |
| `coach-chat.mjs` | Advanced | advanced | 5 | Manuell pro Coach-Query |
| `nexus-email-crawler.mjs` | Basic | basic | 5-6 | Pro Contact-Search |
| `nexus-contact-intelligence.mjs` | Basic | basic | 6 | Pro Contact-Findung |
| `nexus-social-intelligence.mjs` | Basic | basic | 5 | Pro Social-Research |

### 11.2 Tavily pro Pipeline-Durchlauf

```
B1 Cron (alle 15 Min):
  pro Offering: 1 Tavily-Query (advanced, 5 results)
  × N Offerings = N Queries pro Cron-Lauf

B2 Evaluate:
  0 Tavily-Queries (nur LLM)

Live Research:
  1 Tavily-Query (advanced, 10 results)

Contact Intelligence:
  1-2 Tavily-Queries (basic, 6 results)
```

### 11.3 Redundanzen und Optimierungen

| Problem | Status | Lösung |
|---------|--------|--------|
| Kein Query-Level Caching | ❌ Jede Anfrage ist frisch | Cache für identische Queries |
| Kein Result Caching | ❌ Gleiche Seite mehrfach gecrawlt | URL-basierter Cache |
| Keine Dedup vor Tavily | ❌ Gleiche Queries unterschiedliche Keys | Query-Hash-Dedup |
| Multi-Key Failover | ✅ Gut implementiert | 4 Keys sequentiell |
| URL-Hash Dedup nach Tavily | ✅ Produktiv | on_conflict resolution |

### 11.4 Tavily-Kosten-Schätzung

| Szenario | Queries/Tag | Kosten/Monat |
|----------|-------------|--------------|
| 10 Offerings, alle 15 Min | ~960 | ~$10-50 |
| 50 Offerings, alle 15 Min | ~4.800 | ~$50-250 |
| 100 Offerings, alle 15 Min | ~9.600 | ~$100-500 |

**Hinweis:** Tavily Free Tier: 1.000 Queries/Monat. Ab daar $0.005-0.01 pro Query.

---

## 12. DeepSeek / LLM Cost Analysis

### 12.1 DeepSeek

| Eigenschaft | Wert |
|-------------|------|
| Modell | `deepseek-chat` (V3) |
| Einsatzort | Primärer Background-Provider |
| Tokens/Call | 1024-4096 max_tokens |
| Caching | KEINES |
| Kosten/1M Input Tokens | ~$0.27 |
| Kosten/1M Output Tokens | ~$1.10 |

**Funktionen mit DeepSeek als Primär:**
- `nexus-contact-intelligence.mjs` (Position 1)
- `nexus-social-intelligence.mjs` (Position 1)
- `cron-evaluate.mjs` (wenn provider=deepseek)

**Funktionen mit DeepSeek als Fallback:**
- `nexus-llm.mjs` (Position 5)
- `chat.mjs` (Position 4)
- `coach-chat.mjs` (Position 6)

### 12.2 LLM-Kosten pro Event

| Task | Provider | Calls | Geschätzte Tokens | Kosten |
|------|----------|-------|-------------------|--------|
| Event-Extraktion | Groq (Free) | 1 | ~2000 in / ~500 out | $0.00 |
| Event-Klassifizierung | Groq (Free) | 1 | ~500 in / ~200 out | $0.00 |
| Relevanz-Bewertung | Groq (Free) | 1 | ~1000 in / ~300 out | $0.00 |
| Contact-Intelligence | DeepSeek | 1-3 | ~3000 in / ~1000 out | ~$0.002 |
| Message Generation | Groq (Free) | 1 | ~1000 in / ~500 out | $0.00 |
| **GESAMT pro Event** | | 5-7 | | **~$0.002** |

### 12.3 Unnötige LLM-Aufrufe

| Problem | Wo | Lösung |
|---------|-----|--------|
| Keine Deterministik für Klassifizierung | cron-evaluate | Event-Typen könnten per Regex/Keywords klassifiziert werden |
| Kein Caching identischer Prompts | Überall | Gleiche Fragen werden mehrfach gestellt |
| Doppelte Extraktion | B1 + B2 | B1 könnte rohe Daten parsen, B2 nur noch bewerten |

---

## 13. Unit Economics

### 13.1 Kosten pro Lead

| Lead-Typ | Tavily | LLM | Contact | Gesamt |
|----------|--------|-----|---------|--------|
| **Company-Level (Minimum)** | $0.005 | $0.00 | $0.00 | **$0.005** |
| **Company-Level (Enriched)** | $0.01 | $0.002 | $0.00 | **$0.012** |
| **Contact-Level** | $0.02 | $0.005 | $0.05 | **$0.075** |
| **Contact-Level (Verified)** | $0.02 | $0.005 | $0.05 | **$0.075** |

### 13.2 Kosten pro verworfenem Event

| Phase | Kosten |
|-------|--------|
| Search (Tavily) | ~$0.005 |
| Extraktion (LLM) | ~$0.001 |
| Bewertung (LLM) | ~$0.001 |
| **Gesamt pro Verworfenem** | **~$0.007** |

### 13.3 Verhältnis Events → Leads

Schätzung: **10-20% der extrahierten Events werden zu Leads.**

Begründung:
- 100 Suchergebnisse → ~30-50 extrahierte Events → ~5-10 verifizierte Events → ~3-5 Leads

### 13.4 Break-Even

Bei einem Verkaufspreis von z.B. €50 pro Lead:
- Company-Level Lead: ~$0.005 Kosten → 99.99% Marge
- Contact-Level Lead: ~$0.075 Kosten → 99.85% Marge
- **Das Kosten-Problem ist NICHT die Pipeline, sondern die Vertriebsseite.**

---

## 14. Real-Data Validation Plan

### 14.1 Test-Szenario

**Suchgebiet:** Deutschland, breites Business-Event-Spektrum
**Anzahl:** 50 reale Events
**Zeitraum:** Letzte 30 Tage
**Event-Typen:** Expansion, Hiring, Investment, M&A, New Product, Office Opening, Partnership, Regulatory, Leadership Change, Sustainability

### 14.2 Test-Design

```
1. Für jeden Event-Type: 5 Suchanfragen auf Deutsch
2. Tavily Search → 10 Ergebnisse pro Query = 500 Rohdaten
3. AI-Extraktion → ~100-200 strukturierte Events
4. Deduplizierung → ~50-100 unique Events
5. Verifikation → ~30-50 verified Events
6. Lead Package Erstellung → ~20-30 Lead Packages
```

### 14.3 Qualitätsmetriken (pro Event)

| # | Metrik | Messung |
|---|--------|---------|
| 1 | Ist es tatsächlich ein Business Event? | Ja/Nein |
| 2 | Ist das Event aktuell? (< 30 Tage) | Ja/Nein |
| 3 | Ist das Unternehmen korrekt? | Ja/Nein |
| 4 | Ist das Event eindeutig? | Ja/Nein |
| 5 | Gibt es belastbare Quellen? | Anzahl Quellen |
| 6 | Ist das Event dedupliziert? | Ja/Nein |
| 7 | Ist es wirtschaftlich interessant? | Score 1-5 |
| 8 | Ist der Kontext ausreichend? | Ja/Nein |
| 9 | Ist es als Lead Package verwendbar? | Ja/Nein |
| 10 | Sind Kontaktdaten vorhanden? | Ja/Nein |
| 11 | Sind Kontaktdaten verifiziert? | Ja/Nein |
| 12 | Welche Informationen fehlen? | Liste |

### 14.4 Zielmetriken

| Metrik | Ziel |
|--------|------|
| Event-Genauigkeit (Ist es ein Event?) | > 80% |
| Firmen-Genauigkeit (Korrekte Zuordnung) | > 90% |
| Aktualität (< 30 Tage) | > 90% |
| Deduplizierungsrate | > 70% |
| Lead-Package-Verwendbarkeit | > 60% |
| Quellen-Verfügbarkeit | > 95% |

---

## 15. Revised Effort Estimate

### 15.1 Detaillierte Aufschlüsselung

| Phase | Beschreibung | Stunden |
|-------|-------------|---------|
| **1. Analyse & Architektur** | | **2-3** |
| 1.1 Event-Type-Definitionen (DB seed) | 1 |
| 1.2 Lead Package Schema设计 | 1 |
| 1.3 Pipeline-Flow Design | 0.5 |
| **2. Database Migration** | | **1-2** |
| 2.1 nexus_events Tabelle | 0.5 |
| 2.2 nexus_event_sources Tabelle | 0.5 |
| 2.3 nexus_lead_packages Tabelle | 0.5 |
| 2.4 RPC-Funktionen | 0.5 |
| **3. Backend Core** | | **4-6** |
| 3.1 Event Discovery Engine | 2 |
| 3.2 Event Extraction (AI Prompt) | 1 |
| 3.3 Entity Resolution (Company Matching) | 1 |
| 3.4 Lead Package Builder | 1 |
| 3.5 nexus-db.js Erweiterung | 0.5 |
| **4. Backend Integration** | | **2-3** |
| 4.1 Cron-Jobs anpassen | 1 |
| 4.2 Contact Intelligence erweitern | 0.5 |
| 4.3 Message Generation anpassen | 0.5 |
| **5. Frontend** | | **3-5** |
| 5.1 Event Explorer Page | 2 |
| 5.2 Event Detail Page | 1 |
| 5.3 Lead Package View | 1 |
| 5.4 Routing + Navigation | 0.5 |
| **6. Testing** | | **3-4** |
| 6.1 Unit Tests | 1 |
| 6.2 Integration Tests | 1 |
| 6.3 Real-Data Test (50 Events) | 1 |
| 6.4 Bug Fixing | 1 |
| **GESAMT** | | **15-23** |

### 15.2 Abhängigkeiten

```
Phase 1 (Analyse) → Phase 2 (DB) → Phase 3 (Backend) → Phase 4 (Integration) → Phase 5 (Frontend) → Phase 6 (Testing)
```

### 15.3 Kritische Pfade

1. **Event Discovery Engine** (2h) — Herzstück der ganzen Architektur
2. **Event Extraction Prompt** (1h) — Qualität der Extraktion bestimmt alles
3. **Real-Data Test** (1h) — Einzige Möglichkeit, Qualität zu messen

---

## 16. Code Complete vs. Production Ready

### 16.1 Definitionen

#### A) CODE COMPLETE
**Aufwand: 8-11 Stunden**

- Alle Funktionen implementiert
- Alle Tabellen erstellt
- Alle RPCs erstellt
- Frontend-Seiten erstellt
- Basis-Fehlerbehandlung
- Keine Tests, keine Verifikation mit echten Daten

#### B) TECHNICALLY TESTED
**Aufwand: 11-15 Stunden**

- Code Complete +
- Unit Tests für Kernfunktionen
- Integration Tests (API-Endpunkte)
- Cron-Jobs testen (manuell)
- Database-Integrität geprüft

#### C) VERIFIED WITH REAL DATA
**Aufwand: 14-19 Stunden**

- Technically Tested +
- Real-Data Test mit 50 Events
- Qualitätsmetriken erhoben
- Bug Fixing basierend auf realen Daten
- Performance-Bewertung
- Kosten-Messung

#### D) PRODUCTION-READY MVP
**Aufwand: 18-23 Stunden**

- Verified with Real Data +
- RLS-Policies vollständig
- Error Handling robust
- Fallbacks getestet
- Rate-Limiting angepasst
- Monitoring / Logging
- Rollback-Plan
- Deployment getestet
- Stabilisierung

### 16.2 Zeitplan

| Phase | Aufwand | Kumuliert |
|-------|---------|-----------|
| Code Complete | 8-11h | 8-11h |
| + Technically Tested | +3-4h | 11-15h |
| + Real Data Verified | +3-4h | 14-19h |
| + Production Ready | +4-4h | 18-23h |

---

## 17. Existing Components: Keep / Change / Migrate / Remove

### 17.1 Tabellen

| Tabelle | Funktion | Wird genutzt? | Funktioniert? | Aktion |
|---------|----------|---------------|---------------|--------|
| `nexus_analyses` | Angebot-Analysen | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_offerings` | Nutzer-Angebote | ✅ Ja | ✅ Ja | **BEHALTEN** (wird optional) |
| `nexus_signal_strategies` | Suchstrategien | ✅ Ja | ✅ Ja | **ÄNDERN** (event_type statt offering_id) |
| `nexus_companies` | Unternehmen | ✅ Ja | ✅ Ja | **BEHALTEN** (erweitern) |
| `nexus_company_offerings` | M:N | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_contacts` | Kontakte | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_trigger_events` | Kaufsignale | ✅ Ja | ✅ Ja | **BEHALTEN** (V2 Legacy) |
| `nexus_radar_hits` | Rohdaten | ✅ Ja | ✅ Ja | **BEHALTEN** (V2 Pipeline) |
| `nexus_research` | AI-Analyse | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_opportunities` | Pipeline | ✅ Ja | ✅ Ja | **BEHALTEN** (erweitern) |
| `nexus_opportunity_contacts` | M:N | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_opportunity_triggers` | M:N | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_generated_content` | Pitches | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_activities` | Log | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_api_usage` | Rate-Limit | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_free_passes` | Free Trials | ✅ Ja | ✅ Ja | **BEHALTEN** |
| `nexus_filter_profiles` | V3 Filter | ⚠️ Nein | ⚠️ Schema da | **AKTIVIEREN** (erweitern) |
| `nexus_qualified_triggers` | V3 Leads | ⚠️ Nein | ⚠️ Schema da | **AKTIVIEREN** (erweitern) |
| `nexus_raw_events` | V3 Raw Pool | ⚠️ Nein | ⚠️ Schema da | **AKTIVIEREN** |

### 17.2 Functions

| Funktion | Funktioniert? | Aktion |
|----------|---------------|--------|
| `nexus-llm.mjs` | ✅ Ja | **BEHALTEN** (Event-Kontext in Prompts) |
| `nexus-research.mjs` | ✅ Ja | **ÄNDERN** (Offering-Optional) |
| `nexus-contact-intelligence.mjs` | ✅ Ja | **ÄNDERN** (Event-basiert) |
| `nexus-domain-discovery.mjs` | ✅ Ja | **BEHALTEN** |
| `nexus-email-crawler.mjs` | ✅ Ja | **BEHALTEN** |
| `nexus-email-verify.mjs` | ✅ Ja | **BEHALTEN** |
| `nexus-message-generation.mjs` | ✅ Ja | **ÄNDERN** (Event+LeadPackage Input) |
| `nexus-social-intelligence.mjs` | ✅ Ja | **ÄNDERN** (Event-basiert) |
| `nexus-generate-strategies.mjs` | ✅ Ja | **ÄNDERN** (Universell) |
| `nexus-polish-text.mjs` | ✅ Ja | **BEHALTEN** |
| `nexus-free-pass.mjs` | ✅ Ja | **BEHALTEN** |
| `cron-search.mjs` | ✅ Ja | **ÄNDERN** (Event-basiert) |
| `cron-evaluate.mjs` | ✅ Ja | **ÄNDERN** (Event-basiert) |

### 17.3 Frontend

| Seite | Funktioniert? | Aktion |
|-------|---------------|--------|
| `NexusLandingPage.jsx` | ✅ Ja | **ÄNDERN** (Neuer Einstieg) |
| `NexusDashboard.jsx` | ✅ Ja | **ÄNDERN** (Event-Stats) |
| `AngebotsanalysePage.jsx` | ✅ Ja | **BEHALTEN** (optional) |
| `NexusLeadRadarPage.jsx` | ✅ Ja | **ÄNDERN** (Event-Radar) |
| `NexusLeadIntelligencePage.jsx` | ✅ Ja | **ÄNDERN** (Event-Detail) |
| `SalesWorkspacePage.jsx` | ✅ Ja | **ÄNDERN** (Event-basiert, größte Änderung) |
| `CoachChatPage.jsx` | ✅ Ja | **BEHALTEN** |

---

## 18. Recommended MVP Scope

### 18.1 MVP = Das Absolute Minimum

**Ziel:** NeXus findet Business Events, extrahiert sie, dedupliziert sie, verifiziert sie, ordnet Unternehmen zu, speichert Quellen und erzeugt ein Minimum Sellable Lead Package.

### 18.2 MVP-Komponenten

| # | Komponente | Beschreibung |
|---|------------|-------------|
| 1 | Event-Type-Definitionen | 10-15 vordefinierte Event-Typen in DB |
| 2 | `nexus_events` Tabelle | Zentrale Event-Entität |
| 3 | `nexus_event_sources` Tabelle | Quellenbelege |
| 4 | Event Discovery Engine | Tavily Search → Event-Type-basiert |
| 5 | Event Extraction (AI) | LLM-Prompt: Suchergebnis → strukturiertes Event |
| 6 | Entity Resolution (einfach) | Domain + Name Company-Matching |
| 7 | Event Dedup (einfach) | company_id + event_type + event_date |
| 8 | Lead Package Builder | Event → Minimum Sellable Package |
| 9 | Event Explorer UI | "Welche Events suchst du?" |
| 10 | Event Detail UI | Event + Evidence + Lead Package |

### 18.3 NICHT im MVP

| Feature | Phase |
|---------|-------|
| Contact Intelligence (Event-basiert) | Post-MVP |
| Message Generation (Event-basiert) | Post-MVP |
| Social Intelligence (Event-basiert) | Post-MVP |
| Verification Engine (automatisiert) | Post-MVP |
| Enrichment Pipeline | Post-MVP |
| Cron-Jobs universell machen | Post-MVP |
| Offering-Optionalität | Post-MVP |
| Alte Daten migrieren | Post-MVP |
| CSV/PDF Export | Post-MVP |
| CRM-Integration | Post-MVP |

### 18.4 MVP-Datenfluss

```
USER WÄHLT EVENT-TYP (z.B. "Expansion")
    ↓
EVENT DISCOVERY (Tavily Search, 10 Queries)
    ↓ (50-100 Rohdaten)
EVENT EXTRACTION (LLM: Groq/DeepSeek)
    ↓ (20-40 strukturierte Events)
ENTITY RESOLUTION (Domain + Name)
    ↓ (15-30 unique Events)
DEDUPLICATION (company + type + date)
    ↓ (10-20 deduplizierte Events)
VERIFICATION (Quellen-Check)
    ↓ (8-15 verifizierte Events)
LEAD PACKAGE BUILDER
    ↓ (5-10 Lead Packages)
EVENT EXPLORER UI
    ↓
USER SIEHT LEAD PACKAGES
```

---

## 19. Architecture Recommendation

### 19.1 Empfohlene Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS 2.0 ARCHITEKTUR                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── EVENT DEFINITIONS (DB) ────────────────────────────┐  │
│  │  nexus_event_type_definitions                          │  │
│  │  (10-15 vordefinierte Event-Typen)                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── EVENT DISCOVERY (NEU) ─────────────────────────────┐  │
│  │  Input: Event-Type + Region + Zeitraum                  │  │
│  │  Engine: Tavily Search (4 Keys, Fallback-Chain)        │  │
│  │  Output: nexus_raw_events (V3, aktiviert)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── EVENT EXTRACTION (NEU) ────────────────────────────┐  │
│  │  Input: nexus_raw_events                                │  │
│  │  Engine: LLM (Groq → DeepSeek)                         │  │
│  │  Output: nexus_events (NEU)                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── ENTITY RESOLUTION (NEU) ───────────────────────────┐  │
│  │  Input: nexus_events + nexus_companies                  │  │
│  │  Engine: Domain-Matching + Name-Normalisierung          │  │
│  │  Output: Deduplizierte Events                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── BESTEHEND: V2 PIPELINE (angepasst) ────────────────┐  │
│  │  B1: cron-search.mjs (Event-basiert)                   │  │
│  │  B2: cron-evaluate.mjs (Event-basiert)                 │  │
│  │  Companies, Opportunities, Activities                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── LEAD PACKAGE BUILDER (NEU) ────────────────────────┐  │
│  │  Input: nexus_events + nexus_companies + contacts       │  │
│  │  Output: nexus_lead_packages (erweitert V3)            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── BESTEHEND: CONTACT INTELLIGENCE (angepasst) ───────┐  │
│  │  nexus-contact-intelligence.mjs (Event-basiert)        │  │
│  │  nexus-email-crawler.mjs (unverändert)                 │  │
│  │  nexus-email-verify.mjs (unverändert)                  │  │
│  │  nexus-domain-discovery.mjs (unverändert)              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── FRONTEND ──────────────────────────────────────────┐  │
│  │  Event Explorer (NEU)                                  │  │
│  │  Event Detail (NEU)                                    │  │
│  │  Lead Package View (NEU)                               │  │
│  │  Sales Workspace (angepasst)                           │  │
│  │  Dashboard (erweitert)                                 │  │
│  │  Coach (unverändert)                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 19.2 Technische Empfehlungen

1. **V3-Tabellen aktivieren:** nexus_raw_events, nexus_filter_profiles, nexus_qualified_triggers direkt verwenden statt neu zu bauen.
2. **V2-Pipeline beibehalten:** B1+B2 Cron-Jobs weiterlaufen lassen, aber um Event-Discovery erweitern.
3. ** Offering-Optionalität schrittweise:** Erst Event-Pipeline, dann Offering-Filter optional machen.
4. **Entity Resolution:** Einfach beginnen (Domain + Name), fuzzy matching später.
5. **Lead Package:** Minimum Sellable Package als MVP, Enrichment als Post-MVP.

---

## 20. Decision

### 20.1 ENTSCHEIDUNG: **V3 MIGRIEREN / UMBAUEN**

**Begründung:**

1. **Die V3-Pipeline-Tabellen sind gut designt** und bieten genau das, was für die universelle Event-Architektur benötigt wird: Offering-unabhängige Rohdaten (nexus_raw_events), Suchfilter (nexus_filter_profiles) und qualifizierte Leads (nexus_qualified_triggers).

2. **Die V3-Tabellen werden NULLmal verwendet.** Es gibt keinen Code, der auf diese Tabellen zugreift. Das bedeutet: Aktivierung ist ein grünes Feld.

3. **Die V2-Pipeline funktioniert und muss erhalten bleiben.** B1+B2 Cron-Jobs, Contact Intelligence, Email Crawler — alles funktioniert. Diese Logik wird in die neue Architektur integriert, nicht ersetzt.

4. **Eine komplett neue Pipeline wäre Überkill.** Die meiste gesuchte Infrastruktur (Tavily, LLM, DB, Cron) existiert bereits. Eine neue Pipeline würde duplizieren.

5. **Der Hauptaufwand liegt nicht in der Infrastruktur, sondern in der Event-Logik:** Event-Type-Definitionen, Extraction-Prompts, Dedup-Logik, Lead-Package-Builder. Das sind 8-11 Stunden Coding, unabhängig davon ob V3 oder Neu.

### 20.2 KONKRETE EMPFEHLUNG

```
PHASE 0 (1-2h): Vorbereitung
  → nexus_event_type_definitions seed
  → nexus_events Tabelle (NEU, kein Konflikt)
  → nexus_event_sources Tabelle (NEU)
  → nexus_companies erweitern (ADD COLUMN)

PHASE 1 (4-6h): Backend Core
  → Event Discovery Engine (nutzt Tavily + V3 nexus_raw_events)
  → Event Extraction (LLM-Prompt)
  → Entity Resolution (Domain + Name)
  → Lead Package Builder (nutzt V3 nexus_qualified_triggers als Basis)
  → nexus-db.js Erweiterung

PHASE 2 (2-3h): Integration
  → Cron-Jobs anpassen (Event-basiert)
  → Contact Intelligence erweitern

PHASE 3 (3-5h): Frontend
  → Event Explorer
  → Event Detail
  → Lead Package View

PHASE 4 (2-3h): Testing + Stabilisierung
  → Real-Data Test (50 Events)
  → Bug Fixing
  → Production-Ready
```

### 20.3 WAS PASSIERT MIT BESTEHENDEN DATEN?

**NICHTS.** Bestehende Daten bleiben unverändert:
- Bestehende Trigger Events (V2) bleiben in `nexus_trigger_events`
- Bestehende Opportunities bleiben in `nexus_opportunities`
- Bestehende Radar Hits bleiben in `nexus_radar_hits`
- Alles bleibt funktional

Die neue Event-Pipeline läuft PARALLEL. Erst in Phase 5 (später) können Daten migriert werden.

### 20.4 WAS IST DAS ERGEBNIS?

Ein Nutzer kann:
1. "Welche Events suchst du?" wählen (Event Explorer)
2. Event-Type wählen (z.B. "Expansion in Deutschland")
3. Pipeline läuft automatisch (Discovery → Extraction → Dedup → Verification)
4. Lead Packages erscheinen im Dashboard
5. Jedes Lead Package enthält: Unternehmen, Event, Quellen, Evidence, Quality-Score
6. Optional: Contact Intelligence für persönliche Kontakte
7. Optional: Offering-Match für bestehende Angebote

---

## 21. ABSOLUT WICHTIG

### Was wurde beantwortet?

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Was ist bereits vorhanden? | 19 Tabellen, 15 Functions, 7 Pages. V3 Schema da, 0 Code. |
| 2 | Was kann wiederverwendet werden? | Fast alles. V3 Tabellen (aktivieren), V2 Pipeline (anpassen), Contact Intelligence (erweitern). |
| 3 | Was fehlt? | Event-Type-Definitionen, Event Extraction, Entity Resolution, Lead Package Builder, Event Explorer UI. |
| 4 | Was ist ein verkaufbarer Lead? | Company + Event + Evidence + Source URL. Kontakte sind Nice-to-Have. |
| 5 | Brauchen wir persönliche Kontaktdaten? | Nein. Company-Level Leads sind verkaufbar. |
| 6 | Was kostet ein Lead vor dem Verkauf? | ~$0.005 (Company-Level) bis ~$0.075 (Contact-Level). |
| 7 | Was kostet die Pipeline bei 100/1K/10K Events? | $0.60-3.00 / $6-30 / $60-300. |
| 8 | Wie viel des MVP steckt in V3? | Schema: 80%. Logik: 0%. |
| 9 | Was muss tatsächlich neu gebaut werden? | Event Discovery, Extraction, Resolution, Lead Package Builder, UI. |
| 10 | Aufwand CODE COMPLETE? | 8-11 Stunden. |
| 11 | Aufwand REAL-DATA VERIFIED? | 14-19 Stunden. |
| 12 | Aufwand PRODUCTION-READY? | 18-23 Stunden. |
| 13 | Welche Architektur ist sinnvoll? | V3 MIGRIEREN/UMBAUEN: V3 Tabellen aktivieren + V2 Pipeline erweitern. |

### Wichtigste Regel befolgt:

**NICHT von der geplanten neuen Architektur ausgegangen und den Bestand daran angepasst.**

**SONDERN: Bestand vollständig verstanden → Funktionierende Teile identifiziert → V3 gegen Zielarchitektur gemappt → Fehlende Teile identifiziert → Kosten und Verkaufbarkeit geklärt → ERST DANN Zielarchitektur und MVP definiert.**

---

*Dieses Dokument ist eine READ-ONLY Analyse. Es wurden keine Code-Änderungen vorgenommen, keine Datenbankmigrationen ausgeführt und keine bestehenden Funktionen gelöscht.*
