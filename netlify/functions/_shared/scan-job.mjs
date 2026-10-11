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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeXusBot/1.0)' }
    }, 4000);
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
6. Klassifiziere jedes Signal in eine der 5 Kategorien

KAUFSIGNAL-KATEGORIEN:
1. HIRING — Strategische Stellenanzeigen & Personalaufbau (z.B. Head of Sales, IT-Leitung, Expansion)
2. FUNDING — Finanzierungsrunden, Investitionen, Förderungen
3. TECH_MIGRATION — Cloud-Migration, Systemwechsel, ERP/CRM-Einführung
4. REGULATION — Neue Gesetze, Compliance-Pflichten, Zertifizierungen
5. M_A — Übernahmen, Fusionen, Joint Ventures, Partnerschaften

Gib ein JSON zurück:
{
  "trigger_events": [
    {
      "firmenname": "Name des konkreten Unternehmens aus dem Quelltext",
      "branche": "Branche",
      "prioritaet": 1,
      "bewertung": "B - Hohe Chance. Warum?",
      "signal": "Was ist passiert? (Konkretes Ereignis)",
      "signal_kategorie": "HIRING | FUNDING | TECH_MIGRATION | REGULATION | M_A",
      "relevanz": "Konkretes Kaufsignal & Relevanz für den B2B-Vertrieb",
      "target_group_match": 85,
      "is_potential_buyer": true,
      "match_reason": "Begründung: Warum ist die Firma ein Käufer und kein Anbieter?",
      "ansprechpartner": null,
      "position": "Ziel-Entscheiderrolle",
      "kontakt": null,
      "quelle": "${nextUrl.url}",
      "psychologische_ansprache": "Was ist der emotionale Zustand und unsichtbare Schmerz des Entscheiders?"
    }
  ]
}`;

  const llmResult = await Promise.race([
    callLLM([
      { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
      { role: 'user', content: extractPrompt }
    ], { profile: 'json', temperature: 0.3, max_tokens: 2000, jsonMode: true, totalBudgetMs: 8000, xTitle: 'NeXus Research' }).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), 8500))
  ]);

  // Zod sichert: trigger_events bleibt ein Array (siehe _shared/schemas.mjs)
  let extracted = { trigger_events: [] };
  if (llmResult?.text) {
    if (extractJson(llmResult.text) === null) {
      console.warn(`[ScanJob] JSON parse error for ${domain}: kein valides JSON`);
    }
    extracted = parseScanTriggers(llmResult.text);
  }

  // Baustelle 1 & 3: Platzhalter filtern und Zielgruppen-Match absichern
  const cleanTriggers = (extracted.trigger_events || [])
    .filter(t => !isPlaceholderCompany(t.firmenname))
    .map(t => {
      // Heuristik-Check: Wenn Firma Ricoh oder reiner IT-Hersteller ist und sales-software gesucht wird
      const isKnownVendor = /^(ricoh|canon|konica minolta|xerox|bechtle|computacenter)$/i.test((t.firmenname || '').trim());
      const matchScore = isKnownVendor ? 25 : (typeof t.target_group_match === 'number' ? Math.max(0, Math.min(100, t.target_group_match)) : 75);
      return {
        ...t,
        target_group_match: matchScore,
        is_potential_buyer: !isKnownVendor && (t.is_potential_buyer !== false),
        quelle: t.quelle || nextUrl.url
      };
    });

  const newResults = [...partialResults, {
    url: nextUrl.url,
    title: nextUrl.title,
    domain,
    source_type: nextUrl.source_type || 'NEWS',
    triggers: cleanTriggers,
    extracted_at: new Date().toISOString()
  }];

  const updatedPending = pendingUrls.slice(1);
  const newStep = job.current_step + 1;
  const triggersFound = (extracted.trigger_events || []).length;
  const message = triggersFound > 0
    ? `${triggersFound} mögliche Signale auf ${domain} gefunden, werte aus...`
    : `${domain} — keine Signale erkannt.`;
  const isDone = updatedPending.length === 0;

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
