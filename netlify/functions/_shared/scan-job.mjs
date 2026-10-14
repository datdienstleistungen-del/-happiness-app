// ============================================================================
// NeXus _shared/scan-job.mjs — Chunked-Scan-Logik (Phase 3, Radar-Queue)
// Gemeinsame Verarbeitung fuer nexus-radar-scan-step (synchron, Frontend-
// Polling als Fallback) und nexus-radar-scan-queue (Background-Worker, faehrt
// den Job serverseitig zu Ende, auch wenn kein Tab offen ist).
//
// Parallelitaets-Schutz: optimistischer Claim ueber updated_at. Nur wer den
// Claim gewinnt, verarbeitet die naechste URL. Die Frontend-Polling-Instanz
// bekommt bei Claim-Verlust nur noch den ReadOnly-Zustand (Statusanzeige).
// ============================================================================
import { callLLM } from './llm-core.mjs';
import { parseScanTriggers, extractJson } from './schemas.mjs';
import { isPlaceholderCompany } from './validation.mjs';

export const STALE_MS = 5 * 60 * 1000;   // Job-Alter ab dem status='error'
export const HARD_CAP = 25;              // max. current_step

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId);
    return res;
  } catch (e) {
    clearTimeout(abortId);
    throw e;
  }
}

async function fetchPageText(url) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }, 4500);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripBoilerplate(html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim());
    return text.substring(0, 4000);
  } catch (e) {
    return null;
  }
}

// Cookie-Banner/Navigation aus dem Textkopf entfernen: die ersten 1500
// Zeichen dominieren das LLM-Fenster (substring 0..3000 im Extrakations-
// Prompt) und bestehen bei vielen Seiten sonst ueberwiegend aus Consent-Text.
export function stripBoilerplate(text) {
  if (!text) return text;
  const BANNER_KEYS = /\b(cookie|cookies|consent|tracking|werbung|werbezwecke|statistik|statistikzwecke|personalisierung|akzeptieren|ablehnen|einstellungen|einwilligung|zustimmen|verstanden|nur notwendige|notwendige cookies|diese website|wir verwenden|werden verwendet|datenschutzerklärung|impressum|newsletter|abonnieren|willkommen|weitere informationen|alle auswählen)\b/i;
  const head = text.slice(0, 1500);
  const rest = text.slice(1500);
  const kept = head.split(/(?<=[.!?])\s+/).filter(s => !BANNER_KEYS.test(s));
  return [...kept, rest].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Prüft vor dem LLM-Aufruf, ob eine Seite offensichtlich ungeeigneter
 * Endverbraucher- oder Boulevard-Content ist (z.B. Schreibtisch-Testbericht,
 * Heiratsantrag, Rezepte, Gutscheine), um unnötige LLM-Aufrufe einzusparen.
 */
export function isObviouslyIrrelevantPage(url, pageText) {
  if (!url) return true;
  try {
    const urlLower = url.toLowerCase();
    const NOISE_PATH_REGEX = /\/(testberichte?|produkttest|gutschein|rabatt|deals|gewinnspiel|heiratsantrag|horoskop|rezept|rezepte|promi|unterhaltung)\b/i;
    if (NOISE_PATH_REGEX.test(urlLower)) return true;
  } catch {}

  if (pageText) {
    const textLower = pageText.toLowerCase().slice(0, 1000);
    if (/\b(unser fazit im test|ausführlicher testbericht|im praxistest|pro und contra|lieferumfang:|aufbau und montage)\b/i.test(textLower)) {
      return true;
    }
  }
  return false;
}

// Exakte Kalendertagsprüfung nach gregorianischem Kalender:
// Weist unmögliche Kalenderdaten wie 2026-09-31 oder 2026-02-31 strikt ab.
export function parseStrictIsoDate(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day > daysInMonth[month - 1]) return null;
  return { year, month, day, isoDate: `${match[1]}-${match[2]}-${match[3]}` };
}

// Validiert ein Ereignisdatum auf Kalendertagebene (unabhängig von UTC-Tageszeit):
// - Maximal 60 Kalendertage in der Vergangenheit
// - Maximal 365 Kalendertage in der Zukunft (für geplante Vorhaben/Investitionen/Neubau)
export function validateEventDate(rawDate, now = new Date()) {
  const parsed = parseStrictIsoDate(rawDate);
  if (!parsed) return null;

  const todayDayNum = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const targetDayNum = Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000);
  const diffDays = todayDayNum - targetDayNum;

  // Älter als 60 Kalendertage -> ungültig
  if (diffDays > 60) return null;
  // Mehr als 365 Kalendertage in der Zukunft -> ungültig
  if (diffDays < -365) return null;

  return parsed.isoDate;
}

// Job laden. Mit userId (scan-step, user-RLS-Client) nur eigene Jobs, ohne
// userId (Queue, service-Client) alle. Liefert null wenn nicht gefunden.
export async function fetchJob(client, jobId, userId = null) {
  let query = client
    .from('nexus_scan_jobs')
    .select('*')
    .eq('id', jobId);
  if (userId) query = query.eq('user_id', userId);
  const res = await query.single();
  if (res.error || !res.data) return null;
  return res.data;
}

// ReadOnly-Antwort im bisherigen scan-step-Shape (Frontend-kompatibel).
export function readResponse(job) {
  return {
    status: job.status,
    current_step: job.current_step,
    total_steps: job.total_steps,
    last_message: job.last_message,
    partial_results: job.partial_results || [],
    error_message: job.error_message
  };
}

// Grenz-Faelle: nicht-laufender Job, stale (>5min), Hard Cap, keine Pending-
// URLs mehr. Mutiert die DB bei stale/cap/done. Liefert
// { finished: true, response } oder { finished: false }.
export async function guardJob(client, job) {
  if (job.status !== 'running') {
    return { finished: true, response: readResponse(job) };
  }

  const jobAge = Date.now() - new Date(job.created_at).getTime();
  if (jobAge > STALE_MS) {
    console.log(`[ScanJob] Stale job ${job.id} (${Math.round(jobAge / 1000)}s old) — marking as error`);
    const error_message = 'Scan-Timeout: Job stale (>5min)';
    await client
      .from('nexus_scan_jobs')
      .update({ status: 'error', error_message, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return {
      finished: true,
      response: { ...readResponse(job), status: 'error', last_message: 'Scan-Timeout', error_message }
    };
  }

  if (job.current_step > HARD_CAP) {
    const error_message = `Hard Cap erreicht (max ${HARD_CAP} Schritte)`;
    await client
      .from('nexus_scan_jobs')
      .update({ status: 'error', error_message, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return {
      finished: true,
      response: { ...readResponse(job), status: 'error', last_message: 'Scan wurde abgebrochen: zu viele Schritte.', error_message }
    };
  }

  const pendingUrls = job.pending_urls || [];
  if (pendingUrls.length === 0) {
    const partialResults = job.partial_results || [];
    const last_message = `Fertig: ${partialResults.length} Leads gefunden.`;
    await client
      .from('nexus_scan_jobs')
      .update({ status: 'done', last_message, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return { finished: true, response: { ...readResponse(job), status: 'done', last_message } };
  }

  return { finished: false };
}

// Optimistischer Claim: nur wenn sich seit dem Snapshot nichts geaendert hat
// (updated_at identisch) UND status noch 'running' ist. Setzt gleich das
// Frontend-taugliche "Pruefe ..." last_message. Liefert true bei Erfolg.
export async function claimJob(client, job) {
  const pendingUrls = job.pending_urls || [];
  const domain = new URL(pendingUrls[0].url).hostname.replace('www.', '');
  const patch = {
    last_message: `Prüfe ${domain} auf aktuelle Meldungen...`,
    updated_at: new Date().toISOString()
  };

  let query = client
    .from('nexus_scan_jobs')
    .update(patch)
    .eq('id', job.id)
    .eq('status', 'running');
  // updated_at kann bei alten Jobs NULL sein (scan-start setzt es erst seit Phase 3)
  query = (job.updated_at == null) ? query.is('updated_at', null) : query.eq('updated_at', job.updated_at);

  const res = await query.select('id');
  return Boolean(res.data && res.data.length > 0);
}

// Treffer aus dem Scan als nexus_radar_hits ablegen (Phase 3b): B2
// (cron-evaluate) bewertet sie im naechsten 15-Min-Lauf automatisch mit.
// Genau der Row-Shape wie cron-search (B1), inkl. url_hash + ignore-duplicates,
// damit B1-Doppelfunde nicht doppelt landen. Pro URL, nicht erst bei Job-Done.
async function insertRadarHit(client, job, url, title, pageText) {
  if (!job.offering_id || !job.user_id || !pageText) return;
  try {
    const crypto = await import('crypto');
    const row = {
      user_id: job.user_id,
      offering_id: job.offering_id,
      url,
      url_hash: crypto.createHash('md5').update(url).digest('hex'),
      source: 'NeXus Radar Scan',
      title: title || '',
      raw_content: pageText,
      published_at: null,
      status: 'pending'
    };
    const res = await client
      .from('nexus_radar_hits')
      .insert(row, { ignoreDuplicates: true });
    if (res.error) {
      // 409/Duplikat: erwartet, wenn B1 dieselbe URL schon eingefuegt hat
      console.warn(`[ScanJob] radar_hit insert fehlgeschlagen (${url}):`, res.error.message);
    }
  } catch (e) {
    console.warn(`[ScanJob] radar_hit insert Fehler (${url}):`, e.message);
  }
}

// Eine URL verarbeiten (Volltext -> LLM-Extraktion -> DB-Update). Darf nur mit
// gewonnenem Claim aufgerufen werden. Liefert die Antwort im alten Shape.
export async function processNextUrl(client, job) {
  const pendingUrls = job.pending_urls || [];
  const partialResults = job.partial_results || [];
  const nextUrl = pendingUrls[0];
  const domain = new URL(nextUrl.url).hostname.replace('www.', '');

  const pageText = await fetchPageText(nextUrl.url);

  if (!pageText || pageText.length < 100) {
    const updatedPending = pendingUrls.slice(1);
    const isDone = updatedPending.length === 0;
    const last_message = `${domain} — kein brauchbarer Inhalt gefunden.`;
    await client
      .from('nexus_scan_jobs')
      .update({
        pending_urls: updatedPending,
        current_step: job.current_step + 1,
        last_message,
        status: isDone ? 'done' : 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return {
      status: isDone ? 'done' : 'running',
      current_step: job.current_step + 1,
      total_steps: job.total_steps,
      last_message,
      partial_results: partialResults
    };
  }

  // Phase 2A Pre-Filter: Offensichtliche Verbrauchertests oder Boulevard vor LLM abfangen
  if (isObviouslyIrrelevantPage(nextUrl.url, pageText)) {
    const updatedPending = pendingUrls.slice(1);
    const isDone = updatedPending.length === 0;
    const last_message = `${domain} — kein B2B-Kaufanlass (Verbrauchertest/Boulevard übersprungen).`;
    const newResults = [...partialResults, {
      url: nextUrl.url,
      title: nextUrl.title,
      domain,
      source_type: nextUrl.source_type || 'NEWS',
      status: 'skipped',
      analysis_status: 'skipped',
      reason: 'obviously_irrelevant_consumer_content',
      triggers: [],
      extracted_at: new Date().toISOString()
    }];
    await client
      .from('nexus_scan_jobs')
      .update({
        pending_urls: updatedPending,
        partial_results: newResults,
        current_step: job.current_step + 1,
        last_message,
        status: isDone ? 'done' : 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return {
      status: isDone ? 'done' : 'running',
      current_step: job.current_step + 1,
      total_steps: job.total_steps,
      last_message,
      partial_results: newResults
    };
  }

  // Baustelle 3: Offering-Kontext laden für Zielgruppen- und Käufer-Matching
  let offeringContext = '';
  if (job.offering_id) {
    try {
      const offRes = await client.from('nexus_offerings').select('offering_name, target_audience, positioning').eq('id', job.offering_id).single();
      if (offRes.data) {
        offeringContext = `\nUNSER ANGEBOT (DARAUF BASIERT DAS MATCHING):
- Produkt/Dienstleistung: ${offRes.data.offering_name || 'B2B Lösung'}
- Definierte Zielgruppe: ${offRes.data.target_audience || 'Mittelständische Unternehmen'}
- Positionierung: ${offRes.data.positioning || 'B2B Vertrieb'}\n`;
      }
    } catch (e) {
      console.warn('[ScanJob] Konnte Offering-Kontext nicht laden:', e.message);
    }
  }

  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  const extractPrompt = `Du bist die Intelligence Engine für NeXus Sales. Analysiere diesen Web-Inhalt und finde B2B-Kaufsignale.
${offeringContext}
QUELLE: ${nextUrl.url}
TITEL: ${nextUrl.title || 'Unbekannt'}

INHALT:
${pageText.substring(0, 3000)}

REGELN:
1. NUR echte Firmennamen aus dem Text. Erfinde KEINE Unternehmen und nutze NIEMALS Platzhalter wie "Echter Firmenname", "Musterfirma" oder "Test GmbH".
2. KÄUFER-VS-ANBIETER FILTER (WICHTIG - ANTI-RICOH-FILTER):
   - Ist das gefundene Unternehmen ein potenzieller KÄUFER des Angebots?
   - Wenn das Unternehmen SELBST Anbieter/Hersteller der angebotenen Lösung ist oder eigene Produkte bewirbt (z.B. Ricoh bewirbt eigene Dokumentenmanagement-Lösungen, IT-Dienstleister bewirbt eigene Cloud), ist das Unternehmen ein WETTBEWERBER/ANBIETER und KEIN Käufer!
   - In solchen Fällen: Setze "target_group_match" auf unter 40 und "is_potential_buyer" auf false!
3. ZIELGRUPPEN-MATCH (0-100):
   - 80-100: Perfekter Käufer-Match (Passt zur Zielgruppe, echter Bedarf)
   - 50-79: Plausibler Käufer (Bedarf wahrscheinlich)
   - 0-49: Zielgruppe unklar / Anbieter / Wettbewerber / Fehlmatch
4. "ansprechpartner" nur wenn Name WÖRTLICH im Text steht, sonst null
5. "quelle" MUSS die echte URL sein
6. Klassifiziere jedes Signal in eine konkrete Kategorie (z.B. EXPANSION, NEUBAU, INVESTITION, HIRING, M_A, TECH_MIGRATION, REGULATION).
7. EREIGNISDATUM ALS STRIKTES PFLICHTFELD (WICHTIG):
   - Du MUSST das konkrete Datum des EREIGNISSES ("event_date") im Format "YYYY-MM-DD" angeben (wann fand das Event statt, z.B. Spatenstich, Finanzierung, Relaunch, Übernahme).
   - "published_at" (optional): Veröffentlichungsdatum des Artikels ("YYYY-MM-DD"). Verwende das Veröffentlichungsdatum NIEMALS als Ersatz für das Ereignisdatum!
   - Suche im Text nach Datumsangaben (z.B. "12. Oktober 2026", "14.10.2026", "vor 3 Tagen", "im September 2026", "2026-10-11").
   - Heutiges Referenzdatum: ${currentDate} (${currentYear}).
   - Das Ereignis darf NICHT älter als 60 Kalendertage sein (bzw. bei angekündigten Vorhaben max. 12 Monate in der Zukunft).
   - Wenn im Quelltext absolut KEIN belegbares Ereignisdatum auffindbar ist oder das Ereignis älter als 60 Tage ist:
     Setze "trigger_events": [] (Signal verwerfen!).
8. BELEG-SATZ (EVIDENCE):
   - Zitiere im Feld "evidence" den konkreten 1-2 Sätze langen Textauszug aus dem Quelltext, der das Ereignis und das Datum belegt.
   - Ein Signal ohne belegbaren Satz oder ohne Datumsbezug im Text ist unzulässig!
9. DACH-BEZUG-VERIFIKATION (WICHTIG - KEINE BLINDEN DOMAIN-ANNAHMEN):
   Unterscheide strikt zwischen 4 Fällen und setze "dach_status":
   - "DACH_HEADQUARTERS": Das Unternehmen hat seinen belegten Hauptsitz in Deutschland (DE), Österreich (AT) oder der Schweiz (CH).
     * Nachweis durch: DACH-Rechtsform (GmbH, AG, GmbH & Co. KG, e.K. etc.), Registerangabe oder expliziten Standort im Text (z.B. "Fahrradhersteller Raymon aus Schweinfurt").
   - "DACH_SUBSIDIARY": Ein ausländisches Unternehmen mit einer im Text belegten eigenständigen, operativen Niederlassung, Tochtergesellschaft oder lokalem Standort im DACH-Raum (z.B. "deutsche Tochtergesellschaft in Frankfurt", "eröffnet DACH-Büro in München").
   - "FOREIGN_MENTIONED": Ein ausländisches Unternehmen OHNE belegten DACH-Standort, über dessen globales Produkt, globale Finanzierung oder Pressemitteilung lediglich in einem deutschsprachigen Medium berichtet wird (z.B. Shenzhen Timekettle mit US-Dollar-Preis auf deutschem Blog).
   - "DACH_UNVERIFIED": Der Standort des Unternehmens lässt sich aus dem Quelltext nicht verifizieren (keine Rechtsform, kein Ort im DACH-Raum).
   * ACHTUNG: Die Domainendung (.de, .at, .ch) der Nachrichtenseite beweist NIEMALS den Sitz des Unternehmens!
   * Bei "FOREIGN_MENTIONED" oder "DACH_UNVERIFIED": Setze "target_group_match" auf unter 40 und "is_potential_buyer" auf false!
10. DREISTUFIGE SIGNAL-TRENNUNG (EREIGNIS vs. CHANCE vs. KAUFABSICHT):
   - "event_fact": Das tatsächliche, objektiv im Text belegte Ereignis (Was ist passiert? z.B. "Start eines neuen B2B-Shops im November 2026").
   - "business_opportunity": Die daraus abgeleitete geschäftliche Chance für unser Angebot (Warum könnte Bedarf entstehen? Hypothese). Eine abgeleitete Chance ist KEINE belegte Kaufabsicht!
   - "purchase_intent_status":
     * "TRIGGER_EVENT": Konkreter operativer Veränderungsanlass (Expansion, Neubau, Systemwechsel, Führungswechsel), aber keine explizite Ausschreibung/Kaufabsicht geäußert.
     * "EXPLICIT_INTENT": Das Unternehmen sucht im Text wörtlich nach einer Lösung/Software/Ausschreibung.
     * "PURE_MENTION": Reiner PR-Artikel, Speaker-Auftritt (z.B. Keynote auf DMEXCO), allgemeine Produktwerbung, Thought-Leadership ohne konkretes Investitions-/Veränderungsereignis.
   * REGEL: "PURE_MENTION" ist KEIN Kaufsignal! Wenn kein konkretes geschäftliches Veränderungsereignis vorliegt, setze "trigger_events": [].

KAUFSIGNAL-KATEGORIEN:
1. EXPANSION / NEUBAU — Neue Standorte, Werksneubau, Vergrößerung, Büros
2. INVESTITION / FUNDING — Finanzierungsrunden, Investitionen, Maschinenkauf
3. HIRING — Strategische Stellenanzeigen & Personalaufbau
4. M_A — Übernahmen, Fusionen, Joint Ventures, Partnerschaften
5. TECH_MIGRATION — Cloud-Migration, Systemwechsel, ERP/CRM-Einführung
6. REGULATION — Neue Gesetze, Compliance-Pflichten, Zertifizierungen

Gib ein JSON zurück:
{
  "trigger_events": [
    {
      "firmenname": "Name des konkreten Unternehmens aus dem Quelltext",
      "branche": "Branche",
      "prioritaet": 1,
      "bewertung": "B - Hohe Chance. Warum?",
      "signal": "Was ist passiert? (Konkretes Ereignis / Anlass)",
      "signal_kategorie": "EXPANSION | NEUBAU | INVESTITION | HIRING | M_A | TECH_MIGRATION | REGULATION",
      "relevanz": "Konkretes Kaufsignal & Relevanz für den B2B-Vertrieb",
      "target_group_match": 85,
      "is_potential_buyer": true,
      "match_reason": "Begründung: Warum ist die Firma ein Käufer und kein Anbieter?",
      "event_date": "YYYY-MM-DD",
      "published_at": "YYYY-MM-DD oder null",
      "evidence": "Wörtlicher Beleg-Satz aus dem Quelltext",
      "ansprechpartner": null,
      "position": "Ziel-Entscheiderrolle (z.B. Geschäftsführung, Werkleiter, Head of Sales)",
      "kontakt": null,
      "quelle": "${nextUrl.url}",
      "psychologische_ansprache": "Was ist der emotionale Zustand und unsichtbare Schmerz des Entscheiders?",
      "dach_status": "DACH_HEADQUARTERS | DACH_SUBSIDIARY | FOREIGN_MENTIONED | DACH_UNVERIFIED",
      "company_hq_country": "DE | AT | CH | ANDERES | UNBEKANNT",
      "company_hq_city": "Stadt des Sitzes oder null",
      "dach_evidence": "Wörtlicher Belegsatz für den DACH-Sitz/Niederlassung",
      "event_fact": "Objektiv belegtes Ereignis",
      "business_opportunity": "Abgeleitete Chance (Hypothese)",
      "purchase_intent_status": "TRIGGER_EVENT | EXPLICIT_INTENT | PURE_MENTION"
    }
  ]
}`;

  // Priorität 2: Begrenzte Wiederholungen mit exponentiellem Backoff und Jitter
  let llmResult = null;
  let llmError = null;
  const maxAttempts = 2;
  const stepBudgetMs = 22000;
  const stepDeadline = Date.now() + stepBudgetMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remainingBudget = stepDeadline - Date.now();
    if (remainingBudget < 3000) break;

    try {
      llmResult = await callLLM([
        { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
        { role: 'user', content: extractPrompt }
      ], {
        profile: 'json',
        temperature: 0.3,
        max_tokens: 2000,
        jsonMode: true,
        totalBudgetMs: Math.min(remainingBudget - 500, 18000),
        xTitle: 'NeXus Research'
      });
      if (llmResult?.text) {
        llmError = null;
        break;
      }
    } catch (err) {
      llmError = err;
      console.warn(`[ScanJob] LLM-Aufruf Versuch ${attempt}/${maxAttempts} für ${domain} fehlgeschlagen:`, err.message);
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 400);
        const backoffMs = Math.min(600 * Math.pow(2, attempt - 1) + jitter, Math.max(0, stepDeadline - Date.now() - 2000));
        if (backoffMs > 0) {
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }
  }

  // Fall 1: Alle KI-Provider temporär erschöpft / Rate-Limit (z.B. Groq 429 ohne weiteren Provider)
  const isProviderExhausted = Boolean(
    llmError && (
      llmError.code === 'ALL_PROVIDERS_UNAVAILABLE' ||
      /alle ki-provider/i.test(llmError.message) ||
      /rate limit|cooldown/i.test(llmError.message)
    )
  );

  if (!llmResult?.text && isProviderExhausted) {
    // Kritischer Blocker behoben: Job NICHT als erfolgreich mit leeren Triggern abschließen!
    // Stattdessen nachvollziehbaren Fehlerstatus speichern und pending_urls erhalten, damit später fortgesetzt werden kann.
    console.warn(`[ScanJob] Alle Provider temporär erschöpft für ${domain}. Pausiere Scan-Job ${job.id}`);
    const last_message = `Scan pausiert: KI-Provider temporär ausgelastet (${domain}). Bitte in 1-2 Minuten fortsetzen.`;
    const error_message = `KI-Rate-Limit: ${llmError?.message || 'Provider ausgelastet'}. ${pendingUrls.length} URLs verbleibend.`;

    await client
      .from('nexus_scan_jobs')
      .update({
        last_message,
        error_message,
        status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return {
      status: 'error',
      current_step: job.current_step,
      total_steps: job.total_steps,
      last_message,
      error_message,
      partial_results: partialResults
    };
  }

  // Fall 2: Einzelfall-Fehler für diese URL (z.B. Timeout oder kein valides JSON nach Retries)
  if (!llmResult?.text) {
    console.warn(`[ScanJob] Analyse für ${domain} fehlgeschlagen:`, llmError?.message);
    const updatedPending = pendingUrls.slice(1);
    const isDone = updatedPending.length === 0;
    const last_message = `${domain} — Analyse fehlgeschlagen (${llmError?.message || 'Ungültige Antwort'}).`;

    const newResults = [...partialResults, {
      url: nextUrl.url,
      title: nextUrl.title,
      domain,
      source_type: nextUrl.source_type || 'NEWS',
      status: 'failed',
      analysis_status: 'failed',
      error: llmError?.message || 'Kein valides JSON extrahiert',
      triggers: [],
      extracted_at: new Date().toISOString()
    }];

    await client
      .from('nexus_scan_jobs')
      .update({
        pending_urls: updatedPending,
        partial_results: newResults,
        current_step: job.current_step + 1,
        last_message,
        status: isDone ? 'done' : 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return {
      status: isDone ? 'done' : 'running',
      current_step: job.current_step + 1,
      total_steps: job.total_steps,
      last_message,
      partial_results: newResults
    };
  }

  // Fall 3: LLM lieferte Antwort -> Zod-Parsing und strenge Datumsvalidierung
  if (extractJson(llmResult.text) === null) {
    console.warn(`[ScanJob] JSON parse error for ${domain}: kein valides JSON`);
  }
  const extracted = parseScanTriggers(llmResult.text);

  // Baustelle 1 & 3 + Phase 2A: Platzhalter filtern, DACH-Status prüfen, striktes Ereignisdatum (max. 60 Tage) und Kaufanlass absichern
  const cleanTriggers = (extracted.trigger_events || [])
    .filter(t => !isPlaceholderCompany(t.firmenname))
    .filter(t => {
      // PFLICHTFELD: Striktes Ereignisdatum (max. 60 Kalendertage alt oder geplantes Zukunftsevent <= 365d)
      // Das Veröffentlichungsdatum darf NIEMALS als Ersatz für das Ereignisdatum herangezogen werden!
      const validEventDate = validateEventDate(t.event_date);
      if (!validEventDate) return false;

      // Belegbarkeit: Das Signal MUSS einen konkreten Belegsatz haben (mind. 10 Zeichen)
      const evidence = (t.evidence || t.beleg || '').trim();
      if (!evidence || evidence.length < 10) return false;

      // Phase 2A: DACH-Verifikation: Nur verifizierte DACH-Hauptsitze oder DACH-Niederlassungen zulassen!
      // Ausländische Unternehmen ohne DACH-Präsenz (FOREIGN_MENTIONED) oder unbestätigter Standort (DACH_UNVERIFIED) verwerfen
      const dachStatus = t.dach_status;
      if (dachStatus === 'FOREIGN_MENTIONED' || dachStatus === 'DACH_UNVERIFIED') {
        return false;
      }
      if (dachStatus && dachStatus !== 'DACH_HEADQUARTERS' && dachStatus !== 'DACH_SUBSIDIARY') {
        return false;
      }

      // Phase 2A: Kaufabsicht/Erwähnung: Reine PR-Erwähnungen ohne geschäftlichen Veränderungsanlass verwerfen
      if (t.purchase_intent_status === 'PURE_MENTION') {
        return false;
      }

      return true;
    })
    .map(t => {
      // Heuristik-Check: Wenn Firma Ricoh oder reiner IT-Hersteller ist und sales-software gesucht wird
      const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test((t.firmenname || '').trim());
      const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? Math.max(0, Math.min(100, t.target_group_match)) : 75);
      const validEventDate = validateEventDate(t.event_date);
      // published_at separat validieren, NIEMALS mit event_date vermischen
      const validPubDate = validateEventDate(t.published_at);
      return {
        ...t,
        event_date: validEventDate,
        published_at: validPubDate || null,
        evidence: (t.evidence || t.beleg || '').trim(),
        target_group_match: matchScore,
        is_potential_buyer: !isKnownVendor && (t.is_potential_buyer !== false),
        quelle: t.quelle || nextUrl.url,
        // Phase 2A: Strukturierte Felder
        dach_status: t.dach_status || 'DACH_UNVERIFIED',
        company_hq_country: t.company_hq_country || null,
        company_hq_city: t.company_hq_city || null,
        dach_evidence: (t.dach_evidence || '').trim() || null,
        event_fact: (t.event_fact || t.signal || '').trim(),
        business_opportunity: (t.business_opportunity || t.relevanz || '').trim(),
        purchase_intent_status: t.purchase_intent_status || 'TRIGGER_EVENT'
      };
    });

  // Phase 2A: Deduplizierung innerhalb derselben Quellseite nach Firma + Event-Datum
  const seenPageEvents = new Set();
  const deduplicatedTriggers = [];
  for (const t of cleanTriggers) {
    const key = `${(t.firmenname || '').toLowerCase().trim()}::${t.event_date || ''}`;
    if (!seenPageEvents.has(key)) {
      seenPageEvents.add(key);
      deduplicatedTriggers.push(t);
    }
  }

  const newResults = [...partialResults, {
    url: nextUrl.url,
    title: nextUrl.title,
    domain,
    source_type: nextUrl.source_type || 'NEWS',
    status: 'completed',
    analysis_status: 'completed',
    triggers: deduplicatedTriggers,
    extracted_at: new Date().toISOString()
  }];

  const updatedPending = pendingUrls.slice(1);
  const newStep = job.current_step + 1;
  const isDone = updatedPending.length === 0;
  const message = deduplicatedTriggers.length > 0
    ? `${deduplicatedTriggers.length} verifizierte Signale auf ${domain} gefunden.`
    : `${domain} — keine qualifizierten Signale erkannt.`;

  // B2-Bruecke: Treffer-Pending-Row fuer cron-evaluate (Phase 3b).
  await insertRadarHit(client, job, nextUrl.url, nextUrl.title, pageText);

  await client
    .from('nexus_scan_jobs')
    .update({
      pending_urls: updatedPending,
      partial_results: newResults,
      current_step: newStep,
      last_message: message,
      status: isDone ? 'done' : 'running',
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id);

  return {
    status: isDone ? 'done' : 'running',
    current_step: newStep,
    total_steps: job.total_steps,
    last_message: message,
    partial_results: newResults
  };
}
