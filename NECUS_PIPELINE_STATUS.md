# NeXus Pipeline – Stand 09.09.2026 / 21:00 Uhr

## Was wurde erreicht?

Die **automatisierte NeXus Lead-Pipeline** funktioniert jetzt Ende-zu-Ende (E2E). Das heißt:

**Täglich (alle 15 Minuten):**
1. **B1 (cron-search)**Sucht per Tavily API nach Signalen, die zu den Angeboten des Users passen
2. **B2 (cron-evaluate)**Bewertet die Treffer mit DeepSeek KI und erstellt automatisch Companies, Trigger Events und Opportunities

**Das Ergebnis:** Der User定义t sein Angebot → die Pipeline findet im Hintergrund Kaufsignale → relevante Treffer erscheinen automatisch im Dashboard.

---

## Technischer Status

### Was funktioniert

| Bereich | Status | Details |
|---------|--------|---------|
| B1 – Tavily Search | ✅ | `cron-search.mjs` — claimt Offerings, sucht Tavily, schreibt `nexus_radar_hits` |
| B2 – DeepSeek Evaluation | ✅ | `cron-evaluate.mjs` — claimt pending Hits, bewertet mit DeepSeek |
| Relevanzbewertung | ✅ | Scores 0-100, Trigger-Typen, Firmen-Extraktion |
| Company-Erstellung | ✅ | `nexus_companies` — wird automatisch angelegt |
| Trigger Events | ✅ | `nexus_trigger_events` — mit `radar_hit_id`, `status='neu'` |
| Company ↔ Offering | ✅ | `nexus_company_offerings` M:N Verknüpfung |
| Opportunity-Erstellung | ✅ | `nexus_opportunities` — Pipeline Stage 'opportunity' |
| Lead Radar UI | ✅ | Zeigt radarHits und opportunities korrekt an |
| Dashboard | ✅ | Stats + Signale der Nachtschicht |
| Sales Workspace | ✅ | Pipeline Queue mit Company-Namen |
| RLS / User-Isolation | ✅ | Service Key bypassed RLS, Frontend nutzt User-Session |

### Offene Punkte (niedrig priorisiert)

1. **B1-Suchrauschen** — Viele irrelevante Treffer (Job-Börsen, Instagram, FAZ-Artikel). Das ist eine Qualitätsfrage der Suchstrategie, kein Infrastrukturfehler.
2. **Vorhandene alte Trigger Events** — Die 39 alten Events (von `NeXus Radar Scan`) haben kein `radar_hit_id`. Das ist historisch und nicht schlimm.

---

## Dateien & Architektur

### Backend (Netlify Functions)

| Datei | Funktion |
|-------|----------|
| `netlify/functions/cron-search.mjs` | **B1** — Tavily Search Cron. Claimt Offerings, sucht Tavily, schreibt radar_hits. Schedule: `*/15 * * * *` |
| `netlify/functions/cron-evaluate.mjs` | **B2** — DeepSeek Evaluation Cron. Claimt pending Hits, bewertet, erstellt Company/Trigger/Opportunity. Schedule: `*/15 * * * *` |
| `netlify/functions/nexus-research.mjs` | Tavily Search + DeepSeek Analyse (manueller Aufruf) |
| `netlify/functions/nexus-llm.mjs` | Multi-Provider LLM Backend (Groq → OpenRouter → Mistral) |

### Frontend

| Datei | Funktion |
|-------|----------|
| `src/pages/NexusDashboard.jsx` | Dashboard mit Stats, Opportunities, "Signale der Nachtschicht" (radarHits) |
| `src/pages/NexusLeadRadarPage.jsx` | Lead Radar — Tavily-basierte Trigger-Suche |
| `src/pages/SalesWorkspacePage.jsx` | Pipeline Queue + CRM mit AI-Pitch-Generierung |
| `src/context/LeadContext.jsx` | State Provider — lädt opportunities, triggers, radarHits, offerings |
| `src/lib/nexus-db.js` | Supabase CRUD — `getRadarHits()`, `getOpportunities()`, `getTriggerEvents()` etc. |

### Datenbank (Supabase)

| Tabelle | Funktion |
|---------|----------|
| `nexus_offerings` | Angebote des Users (mit `target_audience`) |
| `nexus_radar_hits` | Gefundene Treffer (status: pending/processing/relevant/irrelevant) |
| `nexus_companies` | Erkannte Firmen |
| `nexus_company_offerings` | M:N Company ↔ Offering |
| `nexus_trigger_events` | Kaufsignale (signal_type, status='neu') |
| `nexus_opportunities` | Pipeline (stage: opportunity) |

---

## Env Variables (Netlify)

| Variable | Status |
|----------|--------|
| `VITE_SUPABASE_URL` | ✅ gesetzt |
| `VITE_SUPABASE_ANON_KEY` | ✅ gesetzt |
| `SUPABASE_SERVICE_KEY` | ✅ gesetzt |
| `TAVILY_API_KEY` | ✅ gesetzt |
| `DEEPSEEK_API_KEY` | ✅ gesetzt |
| `BACKGROUND_AI_PROVIDER` | ✅ `deepseek` |

**Werte liegen in `.env` (lokal) und in Netlify Dashboard → Environment Variables.**

---

## Supabase RPCs

| RPC | Status | Funktion |
|-----|--------|----------|
| `claim_offerings_for_scan` | ✅ | Claimt Offerings für B1 (mit `is_scanning` Lock) |
| `claim_pending_radar_hits` | ✅ | Claimt pending Hits für B2 (setzt auf `processing`) |
| `save_hit_evaluation` | ✅ | Speichert B2-Ergebnis (status, score, reason, trigger_type) |
| `reset_crashed_radar_hits` | ✅ | Setzt hängengebliebene `processing` Hits zurück |

---

## Git History (letzte Commits)

```
2d3bee3 fix: add radar_hit_id to trigger event creation
11d6cec fix: trigger event status enum 'new' -> 'neu' (German ENUM)
0f8dd16 fix: handle duplicate hits gracefully (409 conflict)
```

---

## Beispieldaten (Mister Spex + Agicap)

### Mister Spex (vor radar_hit_id-Fix)
- Radar Hit: score=60, trigger=Expansion
- Company: Mister Spex ✅
- Trigger Event: signal=Expansion, source=Cron Radar B2, status=neu, **radar_hit_id=null** (vor Fix)
- Opportunity: stage=opportunity ✅

### Agicap Deutschland (nach radar_hit_id-Fix)
- Radar Hit: score=85, trigger=Stellenausschreibung
- Company: Agicap Deutschland ✅
- Trigger Event: signal=Stellenausschreibung, source=Cron Radar B2, status=neu, **radar_hit_id=e8700381** ✅
- Opportunity: stage=opportunity ✅

---

## Nächste Schritte

1. **B1-Suchrauschen reduzieren** — Die Suchstrategie verbessern, damit weniger irrelevante Treffer (Job-Börsen, Instagram) entstehen. Das ist eine Qualitätsfrage, kein Bug.

2. **Offering-Intelligence** — NeXus muss aus "Wir bauen Industrietore" selbst verstehen, was das bedeutet und daraus sinnvolle Such- und Triggerlogik entwickeln. Die Pipeline darunter steht.

---

## Wichtig für die Arbeit

- **Keine Änderungen an der Pipeline nötig** — Sie funktioniert E2E
- **Deploy-Workflow:** Code ändern → git commit → git push → Netlify deployet automatisch → Env Vars brauchen ggf. Redeploy
- **Netlify Cron:** Beide Functions laufen alle 15 Minuten (`*/15 * * * *`)
- **Testen:** `cron-search → Run now` und `cron-evaluate → Run now` in Netlify Dashboard
- **Supabase Dashboard:** SQL Editor für RPCs und Daten-Inspektion
