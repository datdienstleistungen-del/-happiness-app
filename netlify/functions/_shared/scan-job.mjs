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
// - Maximal maxAgeDays Kalendertage in der Vergangenheit (Standard: 14)
// - Maximal 365 Kalendertage in der Zukunft (für geplante Vorhaben/Investitionen/Neubau)
export function validateEventDate(rawDate, now = new Date(), maxAgeDays = 14) {
  const parsed = parseStrictIsoDate(rawDate);
  if (!parsed) return null;

  const todayDayNum = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const targetDayNum = Math.floor(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 86400000);
  const diffDays = todayDayNum - targetDayNum;

  // Älter als maxAgeDays Kalendertage -> ungültig
  if (diffDays > maxAgeDays) return null;
  // Mehr als 365 Kalendertage in der Zukunft -> ungültig
  if (diffDays < -365) return null;

  return parsed.isoDate;
}

function extractEventKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  const stopWords = new Set([
    'im', 'in', 'der', 'die', 'das', 'und', 'für', 'fuer', 'mit', 'von', 'aus', 'am', 'an', 'zu',
    'den', 'des', 'dem', 'bereich', 'branche', 'unternehmen', 'firmen', 'kunden', 'gmbh', 'ag',
    'ein', 'eine', 'einen', 'einem', 'einer', 'eines', 'sich', 'ist', 'hat', 'wird', 'werden',
    'über', 'ueber', 'nach', 'vor', 'bei', 'zum', 'zur', 'vom', 'ins', 'dass', 'nicht', 'auch',
    'euro', 'million', 'millionen', 'standort', 'deutschland'
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 3 && !stopWords.has(w));
}

/**
 * Prüft, ob ein ISO-Datum (YYYY-MM-DD) im Text vorkommt (als ISO, TT.MM.JJJJ oder Monatsname)
 * und eindeutig mit dem konkreten Ereignis verknüpft ist.
 * Verhindert Halluzinationen und Fehlzuordnungen fremder Daten bei Artikeln mit mehreren Terminen.
 * 
 * @param {string} isoDateStr 
 * @param {string} text 
 * @param {Object} options 
 * @returns {boolean}
 */
export function isDateGroundedInText(isoDateStr, text, { evidence = '', company = '', eventFact = '' } = {}) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return false;
  const match = isoDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [_, y, m, d] = match;
  const dayNum = parseInt(d, 10);
  const monthNum = parseInt(m, 10);
  if (monthNum < 1 || monthNum > 12) return false;

  const germanMonths = [
    'Januar', 'Februar', '(?:März|Maerz)', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const germanMonthShort = [
    'Jan', 'Feb', '(?:Mär|Mrz)', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
  ];
  const monthName = germanMonths[monthNum - 1];
  const monthShort = germanMonthShort[monthNum - 1];

  const patterns = [
    // ISO format: 2026-10-15
    new RegExp(`${y}-${m}-${d}`, 'i'),
    // German dots: 15.10.2026, 15.10.26, 15. 10. 2026
    new RegExp(`(?:^|\\D)0?${dayNum}\\.\\s*0?${monthNum}\\.\\s*(?:${y}|${y.slice(2)})(?:\\D|$)`, 'i'),
    // Written month: 15. September 2026, 29. September, 27. September
    new RegExp(`(?:^|\\D)0?${dayNum}\\.?\\s*(?:${monthName}|${monthShort})(?:\\D|$)`, 'i'),
    // Slashes: 15/10/2026
    new RegExp(`(?:^|\\D)0?${dayNum}/0?${monthNum}/(?:${y}|${y.slice(2)})(?:\\D|$)`, 'i')
  ];

  const testMatch = (str) => typeof str === 'string' && patterns.some(p => p.test(str));

  // 1. Wenn der Belegsatz (evidence) oder das konkrete Ereignis (eventFact) das Datum direkt enthält -> Höchste Evidenz!
  if (evidence && testMatch(evidence)) return true;
  if (eventFact && testMatch(eventFact)) return true;

  if (!text || typeof text !== 'string') return false;

  // 2. Extrahiere spezifische Inhaltsbegriffe dieses Ereignisses, um Multi-Ereignis-Falschzuordnungen auszuschließen
  const eventKeywords = extractEventKeywords(`${eventFact} ${evidence}`);

  // 3. Volltext-Prüfung mit semantischem Kontext- und Boilerplate-Schutz:
  let hasValidMatch = false;
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'gi');
    let mResult;
    while ((mResult = regex.exec(text)) !== null) {
      const idx = mResult.index;
      // Umkreis von bis zu 90 Zeichen, aber nicht über Absatzgrenzen (\n\n oder \r\n\r\n) hinaus
      const prevBreak = Math.max(text.lastIndexOf('\n\n', idx), text.lastIndexOf('\r\n\r\n', idx));
      const nextBreakIdx1 = text.indexOf('\n\n', idx);
      const nextBreakIdx2 = text.indexOf('\r\n\r\n', idx);
      let nextBreak = -1;
      if (nextBreakIdx1 !== -1 && nextBreakIdx2 !== -1) {
        nextBreak = Math.min(nextBreakIdx1, nextBreakIdx2);
      } else if (nextBreakIdx1 !== -1) {
        nextBreak = nextBreakIdx1;
      } else if (nextBreakIdx2 !== -1) {
        nextBreak = nextBreakIdx2;
      }

      const snippetStart = Math.max(prevBreak !== -1 ? prevBreak + 2 : 0, idx - 90);
      const snippetEnd = Math.min(nextBreak !== -1 ? nextBreak : text.length, idx + mResult[0].length + 90);
      const snippet = text.slice(snippetStart, snippetEnd);
      const snippetLower = snippet.toLowerCase();

      // Boilerplate-Filter: Impressum, Copyright, Datenschutz, Stand/Aktualisiert am, Navigation
      const isBoilerplate = /\b(impressum|datenschutz|copyright|©|alle rechte vorbehalten|agb|stand:\s*|zuletzt aktualisiert|redaktion|autor:|kontakt|newsletter|cookie)\b/i.test(snippet);
      if (isBoilerplate) continue;

      // Wenn spezifische Event-Keywords vorhanden sind: Das Datum MUSS sich im Umfeld dieses konkreten Events befinden!
      if (eventKeywords.length > 0) {
        const hasSpecificToken = eventKeywords.some(kw => snippetLower.includes(kw));
        if (hasSpecificToken) {
          hasValidMatch = true;
          break;
        }
      } else {
        // Fallback für kurze Testschnipsel ohne übergebene Keywords
        const hasGeneralEvent = /\b(eröffn|spatenstich|bau|invest|gründ|start|übernahm|fusion|stell|hiring|werk)\b/i.test(snippet);
        const hasCompanyContext = company && company.length > 2 && snippetLower.includes(company.toLowerCase().slice(0, 10));
        if (hasGeneralEvent || hasCompanyContext || text.length < 300) {
          hasValidMatch = true;
          break;
        }
      }
    }
    if (hasValidMatch) break;
  }

  return hasValidMatch;
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
// Wichtig: Verworfene Hits (z.B. Nicht-Käufer) werden mit status='irrelevant' abgelegt,
// um ein Umgehen der Filter-Pipeline durch nachgelagerte Cronjobs zu verhindern.
async function insertRadarHit(client, job, url, title, pageText, hitMeta = {}) {
  if (!job.offering_id || !job.user_id || !pageText) return;
  try {
    const crypto = await import('crypto');
    const isRejected = Boolean(hitMeta.isRejected);
    const status = isRejected ? 'irrelevant' : (hitMeta.status || 'pending');
    const row = {
      user_id: job.user_id,
      offering_id: job.offering_id,
      url,
      url_hash: crypto.createHash('md5').update(url).digest('hex'),
      source: 'NeXus Radar Scan',
      title: title || '',
      raw_content: pageText,
      published_at: null,
      status
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

/**
 * Filter-Pipeline für extrahierte Signal-Trigger (Phase 2B: Käufer-Prüfung & Zielgruppen-Match).
 * Verwirft:
 * - Platzhalter-Firmen
 * - Ungültige oder veraltete Ereignisdaten (>60d)
 * - Signale ohne konkreten Belegsatz (<10 Zeichen)
 * - Signale ohne verifizierten DACH-Hauptsitz / DACH-Niederlassung
 * - Reine PR-Erwähnungen ohne Veränderungsanlass (PURE_MENTION)
 * - Bedingung a: Nicht-Käufer (is_potential_buyer === false)
 * - Bedingung b: Unpassende Zielgruppen (target_group_match < 50)
 *
 * Dokumentiert jeden Verwerfungsgrund in rejectedTriggers für den Prüfbericht.
 */
export function filterAndCleanTriggers(rawTriggers = [], { url = '', now = new Date(), maxAgeDays = 14 } = {}) {
  const cleanTriggers = [];
  const rejectedTriggers = [];

  for (const t of rawTriggers) {
    // 1. Platzhalter filtern
    if (isPlaceholderCompany(t.firmenname)) {
      rejectedTriggers.push({
        ...t,
        rejection_reason: 'Platzhalter-Firmenname'
      });
      continue;
    }

    // 2. Ereignisdatum & Veröffentlichungsdatum prüfen (max. maxAgeDays Kalendertage bzw. Zukunft <= 365d)
    const sourceUrl = t.quelle || url || '';
    const isJobPortal = /\b(stepstone|indeed|linkedin\.com\/jobs|xing\.com\/jobs|jobs\.ch|karriere\.at|jobboerse|monster)\b/i.test(sourceUrl);
    const isHiringTrigger = t.signal_kategorie === 'HIRING' || isJobPortal;

    let validEventDate = validateEventDate(t.event_date, now, maxAgeDays);
    let validPubDate = validateEventDate(t.published_at, now, maxAgeDays);
    let isUnverifiedDate = Boolean(t.event_date_unverified);

    // Sonderregel für Jobanzeigen:
    // Wenn signal_kategorie === 'HIRING' oder der Trigger von einem Jobportal stammt:
    // Und wenn kein gültiges event_date / published_at vorhanden ist:
    // Dann setze das heutige Datum (new Date()) als "Abrufdatum" und markiere es als "frisch abgerufen".
    // Begründung: Eine heute abgerufene Stellenanzeige ist ein heutiger Trigger, auch wenn kein explizites Datum im Text steht.
    // Nur bei HIRING-Triggern anwenden. Bei Bau/News-Triggern bleibt der strikte maxAgeDays-Filter.
    if (isHiringTrigger && !validEventDate && !validPubDate) {
      const todayIso = (now instanceof Date ? now : new Date()).toISOString().slice(0, 10);
      validEventDate = todayIso;
      validPubDate = todayIso;
      isUnverifiedDate = false;
      t.event_date = todayIso;
      t.published_at = t.published_at || todayIso;
      t.event_date_unverified = false;
      t.is_freshly_fetched_job = true;
    }

    let finalEventDate = validEventDate;

    if (!finalEventDate || isUnverifiedDate) {
      if (validPubDate) {
        // Fallback: Kein/ungültiges Ereignisdatum, aber belegtes Veröffentlichungsdatum <= maxAgeDays Tage
        finalEventDate = null;
        isUnverifiedDate = true;
      } else {
        // Weder Ereignisdatum noch Veröffentlichungsdatum <= maxAgeDays Tage
        rejectedTriggers.push({
          ...t,
          rejection_reason: `Älter als ${maxAgeDays} Tage - veraltet`
        });
        continue;
      }
    }

    // 3. Belegbarkeit: Das Signal MUSS einen konkreten Belegsatz haben (mind. 10 Zeichen)
    const evidence = (t.evidence || t.beleg || '').trim();
    if (!evidence || evidence.length < 10) {
      rejectedTriggers.push({
        ...t,
        rejection_reason: 'Kein konkreter Belegsatz (mind. 10 Zeichen)'
      });
      continue;
    }

    // 4. DACH-Verifikation: Nur verifizierte DACH-Hauptsitze oder DACH-Niederlassungen zulassen!
    const dachStatus = t.dach_status;
    if (dachStatus === 'FOREIGN_MENTIONED' || dachStatus === 'DACH_UNVERIFIED') {
      rejectedTriggers.push({
        ...t,
        rejection_reason: 'Kein verifizierter DACH-Standort (FOREIGN_MENTIONED / DACH_UNVERIFIED)'
      });
      continue;
    }
    if (dachStatus && dachStatus !== 'DACH_HEADQUARTERS' && dachStatus !== 'DACH_SUBSIDIARY') {
      rejectedTriggers.push({
        ...t,
        rejection_reason: 'Kein verifizierter DACH-Hauptsitz oder Niederlassung'
      });
      continue;
    }

    // 5. Kaufabsicht/Erwähnung: Reine PR-Erwähnungen ohne geschäftlichen Veränderungsanlass verwerfen
    if (t.purchase_intent_status === 'PURE_MENTION') {
      rejectedTriggers.push({
        ...t,
        rejection_reason: 'Reine PR-Erwähnung ohne geschäftlichen Veränderungsanlass (PURE_MENTION)'
      });
      continue;
    }

    // 6. Bedingung a: Wenn is_potential_buyer === false -> Signal verwerfen
    const isKnownVendor = /\b(ricoh|canon|konica minolta|xerox|bechtle|computacenter)\b/i.test((t.firmenname || '').trim());
    if (t.is_potential_buyer === false || isKnownVendor) {
      rejectedTriggers.push({
        ...t,
        is_potential_buyer: false,
        rejection_reason: 'Kein potenzieller Käufer'
      });
      continue;
    }

    // 7. Bedingung b: Wenn target_group_match < 50 -> Signal verwerfen
    const matchScore = typeof t.target_group_match === 'number'
      ? Math.max(0, Math.min(100, t.target_group_match))
      : 75;
    if (matchScore < 50) {
      rejectedTriggers.push({
        ...t,
        target_group_match: matchScore,
        rejection_reason: 'Zielgruppen-Match unter 50'
      });
      continue;
    }

    // Phase 2B: Hypothesen-Kennzeichnung für business_opportunity
    const purchaseIntentStatus = t.purchase_intent_status || 'TRIGGER_EVENT';
    let opportunity = (t.business_opportunity || t.relevanz || '').trim();
    if (opportunity) {
      if (purchaseIntentStatus === 'EXPLICIT_INTENT') {
        opportunity = opportunity.replace(/^\[Hypothese\]\s*/i, '');
      } else if (!opportunity.startsWith('[Hypothese]')) {
        opportunity = `[Hypothese] ${opportunity}`;
      }
    }

    // Qualifiziertes Signal normalisieren
    cleanTriggers.push({
      ...t,
      event_date: finalEventDate,
      published_at: validPubDate || null,
      event_date_unverified: isUnverifiedDate,
      evidence,
      target_group_match: matchScore,
      is_potential_buyer: true,
      quelle: t.quelle || url,
      dach_status: t.dach_status || 'DACH_UNVERIFIED',
      company_hq_country: t.company_hq_country || null,
      company_hq_city: t.company_hq_city || null,
      dach_evidence: (t.dach_evidence || '').trim() || null,
      event_fact: (t.event_fact || t.signal || '').trim(),
      business_opportunity: opportunity,
      purchase_intent_status: purchaseIntentStatus,
      pain_point: (t.pain_point || '').trim(),
      blind_company: (t.blind_company || '').trim(),
      blind_location: (t.blind_location || '').trim(),
      blind_quantity: (t.blind_quantity || '').trim(),
      target_buyers: Array.isArray(t.target_buyers) ? t.target_buyers.map(b => String(b).trim()).filter(Boolean) : []
    });
  }

  return { cleanTriggers, rejectedTriggers };
}

/**
 * cleanTriggers Wrapper für Kompatibilität mit Array- und Objekt-Zugriff.
 */
export function cleanTriggers(rawTriggers = [], opts = {}) {
  const { cleanTriggers: clean, rejectedTriggers: rejected } = filterAndCleanTriggers(rawTriggers, opts);
  const arr = [...clean];
  arr.rejected_triggers = rejected;
  arr.rejected = rejected;
  arr.cleanTriggers = clean;
  return arr;
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
  let offeringMaxAge = null;
  if (job.offering_id) {
    try {
      const offRes = await client.from('nexus_offerings').select('offering_name, target_audience, positioning, ai_understanding').eq('id', job.offering_id).single();
      if (offRes.data) {
        offeringContext = `\nUNSER ANGEBOT (DARAUF BASIERT DAS MATCHING):
- Produkt/Dienstleistung: ${offRes.data.offering_name || 'B2B Lösung'}
- Definierte Zielgruppe: ${offRes.data.target_audience || 'Mittelständische Unternehmen'}
- Positionierung: ${offRes.data.positioning || 'B2B Vertrieb'}\n`;
        if (offRes.data.ai_understanding?.max_age_days) {
          offeringMaxAge = Number(offRes.data.ai_understanding.max_age_days);
        }
      }
    } catch (e) {
      console.warn('[ScanJob] Konnte Offering-Kontext nicht laden:', e.message);
    }
  }

  const effectiveMaxAgeDays = Math.max(1, Math.min(30, Number(
    nextUrl?.max_age_days || job.max_age_days || offeringMaxAge || 14
  )));

  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  const extractPrompt = `Du bist die Intelligence Engine für NeXus Sales. Analysiere diesen Web-Inhalt und finde B2B-Kaufsignale.
${offeringContext}
QUELLE: ${nextUrl.url}
TITEL: ${nextUrl.title || 'Unbekannt'}

INHALT:
${pageText.substring(0, 3000)}

REGELN:
0. TOKEN-SPAR-FILTER (SOFORTABBRUCH):
   - Ist das Ereignis exakt belegbar (Datum, Ort, Unternehmen)? -> Falls NEIN, antworte NUR: "KEIN_VALIDES_SIGNAL"
   - Besteht dadurch geschäftlicher Handlungsdruck für B2B-Dienstleister? -> Falls NEIN, antworte NUR: "KEIN_VALIDES_SIGNAL"
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
7. EREIGNISDATUM vs. VERÖFFENTLICHUNGSDATUM (KEINE HALLUZINATIONEN):
   - "event_date": Das konkrete Datum des EREIGNISSES ("YYYY-MM-DD"), wann das Event tatsächlich stattfand oder stattfinden wird (z.B. Spatenstich, Eröffnung, Finanzierungsrunde).
     STRIKTE REGEL: Wenn im Quelltext KEIN konkretes Kalenderdatum (z.B. TT.MM.JJJJ oder JJJJ-MM-TT) für das Ereignis steht, darf event_date NICHT erfunden, geschätzt oder berechnet werden!
     Stattdessen: Setze "event_date": null!
   - "published_at": Das Veröffentlichungsdatum des Artikels ("YYYY-MM-DD" oder null). Wird separat erfasst.
   - Heutiges Referenzdatum: ${currentDate} (${currentYear}).
   - Weder das Ereignis noch der Artikel dürfen älter als ${effectiveMaxAgeDays} Kalendertage sein (bei angekündigten Vorhaben max. 12 Monate in der Zukunft).
   - Wenn weder ein belegbares Ereignisdatum noch ein Veröffentlichungsdatum auffindbar ist oder beide älter als ${effectiveMaxAgeDays} Tage sind:
     Setze "trigger_events": [] (Signal verwerfen!).
8. BELEG-SATZ (EVIDENCE):
   - Zitiere im Feld "evidence" den konkreten 1-2 Sätze langen Textauszug aus dem Quelltext, der das Ereignis belegt.
   - Ein Signal ohne belegbaren Satz im Text ist unzulässig!
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
   - "business_opportunity": Die daraus abgeleitete geschäftliche Chance für unser Angebot.
     WICHTIGE REGEL: Wenn purchase_intent_status !== 'EXPLICIT_INTENT', muss business_opportunity ZWINGEND mit dem Präfix "[Hypothese] " beginnen.
     Beispiel:
     event_fact: "Deutsche Aircraft eröffnet Werk in Leipzig/Halle."
     business_opportunity: "[Hypothese] Ein neues Werk erzeugt typischerweise Bedarf an Dokumentenmanagement-Systemen."
     STRIKTES VERBOT: Keine Formulierung, die einen konkreten Bedarf behauptet, wenn dieser nicht im Quelltext belegt ist!
   - "purchase_intent_status":
     * "TRIGGER_EVENT": Konkreter operativer Veränderungsanlass (Expansion, Neubau, Systemwechsel, Führungswechsel), aber keine explizite Ausschreibung/Kaufabsicht geäußert.
     * "EXPLICIT_INTENT": Das Unternehmen sucht im Text wörtlich nach einer Lösung/Software/Ausschreibung.
     * "PURE_MENTION": Reiner PR-Artikel, Speaker-Auftritt (z.B. Keynote auf DMEXCO), allgemeine Produktwerbung, Thought-Leadership ohne konkretes Investitions-/Veränderungsereignis.
   * REGEL: "PURE_MENTION" ist KEIN Kaufsignal! Wenn kein konkretes geschäftliches Veränderungsereignis vorliegt, setze "trigger_events": [].
11. IMPACT-ANALYSE / OPERATIVER PAIN POINT (HANDLUNGSDRUCK):
   - Leite für JEDEN gefundenen Trigger zwingend das operative Hauptziel bzw. den akuten Handlungsdruck ("pain_point") ab, der durch diesen Anlass im Unternehmen entsteht.
   - Branchenunabhängig für ALLE Trigger-Typen:
     * HIRING / JOB: Welches operative Problem soll die Besetzung lösen? Welcher Engpass drückt bis zur Besetzung? (z.B. "Umsatzstagnation in Region Süd, Vakanzkosten und fehlende Vertriebskapazität").
     * NEUBAU / EXPANSION: Welche operativen Risiken & Anforderungen entstehen? (z.B. "Termindruck bei Gewerkeabstimmung, Risiko von Bauverzögerungen, Bedarf an Baustellenlogistik und Brandschutz").
     * M&A / INVESTITION: Was ist die Integrations- oder Skalierungsherausforderung? (z.B. "Post-Merger-Systemintegration, Konsolidierung heterogener IT-Infrastrukturen und hohes Investoren-Reporting").
     * TECH_MIGRATION / REGULATION: Welche Umstellungs- oder Haftungsrisiken drängen? (z.B. "Ablauf von Support-Fristen, drohende Bußgelder oder Betriebsunterbrechung").
12. BLIND PROFILE (ANONYMISIERUNG FÜR LEAD-BROKERAGE):
   - Erstelle für jeden Trigger ein branchenagnostisches Blindprofil, sodass das Lead-Signal vorab anonymisiert an potenzielle B2B-Käufer/Dienstleister vermarktet werden kann:
     * "blind_company": Anonymisierte, aussagekräftige Beschreibung des Unternehmens OHNE Nennung des Eigennamens (z.B. "Führender D-A-CH-Hörgeräteakustiker", "Spezialisierter Automobilzulieferer für Antriebstechnik", "Mittelständisches Logistikunternehmen").
     * "blind_location": Anonymisierte regionale Angabe (z.B. "Westschweiz", "Metropolregion Stuttgart", "Großraum München", "Nordrhein-Westfalen").
     * "blind_quantity": Fuzzy-Größenordnung oder Kennzahl aus dem Signal oder Kontext (z.B. "zweistelliges Filialnetz (>20 Standorte)", "ca. 150-200 Mitarbeiter", "Investitionsvolumen im mittleren einstelligen Millionenbereich", "Team von >50 Entwicklern"). Wenn keine Zahl im Text steht, schätze eine plausible Spanne basierend auf Unternehmensart.
13. MATCHMAKING (TARGET BUYERS / ANBIETER-TYPEN):
   - "target_buyers": Array von 2-3 konkreten B2B-Anbieter- bzw. Dienstleister-Kategorien, die von diesem Signal geschäftlich profitieren und daran verdienen können.
   - Beispiele branchenübergreifend:
     * Bei Expansion/Neubau: ["Ladenbauer & Innenausstatter", "Gewerbe-Elektroinstallateure", "Brandschutz- & Sicherheitstechnik"]
     * Bei Hiring/Jobanzeige: ["Executive Search & Personalberater", "Interim-Management-Provider", "Mitarbeiter-Onboarding-Software"]
     * Bei M&A / Übernahme: ["M&A-Integrationsberater", "IT-Konsolidierungs-Dienstleister", "Change-Management-Consultants"]
     * Bei Tech-Migration / Investition: ["Cloud-Architekten", "ERP-Implementierungspartner", "Cybersecurity-Dienstleister"]

KAUFSIGNAL-KATEGORIEN (5 B2B-KERN-BEREICHE):
1. FÜHRUNGSKRÄFTEWECHSEL — C-Level Vakanzen, Vorstand, neuer Geschäftsführer, Aufsichtsrat, Vertriebsleitung
2. KAPAZITÄTSERWEITERUNG & BAU — Spatenstich, Richtfest, Hallenbau (> 2.000 m²), neues Logistikzentrum, Neubau
3. M&A / NACHFOLGE — Übernahmen, Mehrheitsbeteiligungen, Fusionen, Unternehmensnachfolge Mittelstand, Asset Deal
4. SANIERUNG / EIGENVERWALTUNG — Insolvenz in Eigenverwaltung, Schutzschirmverfahren, Sanierungsexperte
5. STELLENWACHSTUM — "Wir stellen ein", Expansionskurs, 5+ offene Stellen, massiver Personalaufbau

Gib ein JSON zurück:
{
  "trigger_events": [
    {
      "firmenname": "Name des konkreten Unternehmens aus dem Quelltext",
      "branche": "Branche",
      "prioritaet": 1,
      "bewertung": "B - Hohe Chance. Warum?",
      "signal": "Was ist passiert? (Konkretes Ereignis / Anlass)",
      "signal_kategorie": "Führungskräftewechsel / C-Level Vakanzen | Kapazitätserweiterung & Bau / Hallen | M&A / Übernahmen / Nachfolge | Insolvenz in Eigenverwaltung / Sanierung | Exponentielles Stellenwachstum",
      "relevanz": "Konkretes Kaufsignal & Relevanz für den B2B-Vertrieb",
      "target_group_match": 85,
      "is_potential_buyer": true,
      "match_reason": "Begründung: Warum ist die Firma ein Käufer und kein Anbieter?",
      "event_date": "YYYY-MM-DD oder null (wenn kein konkretes Datum im Text steht)",
      "published_at": "YYYY-MM-DD oder null (Veröffentlichungsdatum des Beitrags)",
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
      "event_fact": "Objektiv belegtes Ereignis (z.B. Deutsche Aircraft eröffnet Werk in Leipzig/Halle)",
      "business_opportunity": "[Hypothese] Ein neues Werk erzeugt typischerweise Bedarf an Dokumentenmanagement-Systemen",
      "pain_point": "Operatives Hauptziel & akuter Handlungsdruck (branchenunabhängig)",
      "blind_company": "Anonymisierte Unternehmensbeschreibung (z.B. Führender D-A-CH-Hörgeräteakustiker)",
      "blind_location": "Anonymisierte Region (z.B. Westschweiz, Metropolregion Stuttgart)",
      "blind_quantity": "Fuzzy-Kennzahl/Größenordnung (z.B. zweistelliges Filialnetz (>20 Standorte) oder 100-250 MA)",
      "target_buyers": ["Anbieter-Typ 1", "Anbieter-Typ 2", "Anbieter-Typ 3"],
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
        max_tokens: 2500,
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

  // Fall 3: Sofortiger Token-Spar-Abbruch bei unqualifizierten Inhalten
  if (llmResult?.text && (llmResult.text.includes('KEIN_VALIDES_SIGNAL') || llmResult.text.trim() === 'KEIN_VALIDES_SIGNAL')) {
    console.log(`[ScanJob] Token-Spar-Bremse aktiv für ${domain}: KEIN_VALIDES_SIGNAL`);
    const updatedPending = pendingUrls.slice(1);
    const isDone = updatedPending.length === 0;
    const last_message = `${domain} — kein valides B2B-Signal (Token-Spar-Bremse aktiv).`;

    const newResults = [...partialResults, {
      url: nextUrl.url,
      title: nextUrl.title,
      domain,
      source_type: nextUrl.source_type || 'NEWS',
      status: 'skipped',
      analysis_status: 'skipped',
      reason: 'kein_valides_signal',
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

  // Fall 4: LLM lieferte Antwort -> Zod-Parsing und strenge Datumsvalidierung
  if (extractJson(llmResult.text) === null) {
    console.warn(`[ScanJob] JSON parse error for ${domain}: kein valides JSON`);
  }
  const extracted = parseScanTriggers(llmResult.text);

  const verifiedTriggers = (extracted.trigger_events || []).map(t => {
    if (t.event_date) {
      const isGrounded = isDateGroundedInText(t.event_date, pageText, { 
        evidence: t.evidence, 
        company: t.firmenname,
        eventFact: t.event_fact || t.signal
      });
      if (!isGrounded) {
        return {
          ...t,
          event_date: null,
          event_date_unverified: true
        };
      }
    }
    return t;
  });

  // Baustelle 1 & 3 + Phase 2A & 2B: Filter-Pipeline mit Käufer-Prüfung & Zielgruppen-Match
  const { cleanTriggers: filteredTriggers, rejectedTriggers } = filterAndCleanTriggers(verifiedTriggers, {
    url: nextUrl.url,
    maxAgeDays: effectiveMaxAgeDays
  });

  // Phase 2A: Deduplizierung innerhalb derselben Quellseite nach Firma + Event-Datum / Veröffentlichungsdatum
  const seenPageEvents = new Set();
  const deduplicatedTriggers = [];
  for (const t of filteredTriggers) {
    const key = `${(t.firmenname || '').toLowerCase().trim()}::${t.event_date || t.published_at || ''}`;
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
    rejected_triggers: rejectedTriggers,
    extracted_at: new Date().toISOString()
  }];

  const updatedPending = pendingUrls.slice(1);
  const newStep = job.current_step + 1;
  const isDone = updatedPending.length === 0;
  const message = deduplicatedTriggers.length > 0
    ? `${deduplicatedTriggers.length} verifizierte Signale auf ${domain} gefunden.`
    : `${domain} — keine qualifizierten Signale erkannt.`;

  // B2-Bruecke: Treffer-Pending-Row fuer cron-evaluate (Phase 3b).
  // Verhindert Cron-Leck: Nur Seiten mit tatsächlich qualifizierten Signalen (deduplicatedTriggers > 0)
  // dürfen als 'pending' abgelegt werden. Alle anderen Seiten (verworfen oder ohne Kaufsignal)
  // werden ausnahmslos mit status='irrelevant' persistiert!
  const hasQualifiedTriggers = deduplicatedTriggers.length > 0;
  await insertRadarHit(client, job, nextUrl.url, nextUrl.title, pageText, {
    isRejected: !hasQualifiedTriggers,
    status: hasQualifiedTriggers ? 'pending' : 'irrelevant'
  });

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
    partial_results: newResults,
    rejected_triggers: rejectedTriggers
  };
}
