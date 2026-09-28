// ============================================================================
// NeXus _shared/schemas.mjs — Server-seitige JSON-Extraktion + Zod-Validierung
// Phase 2: LLM-Outputs werden HIER validiert (statt nur im Browser-Strict-Guard).
// ============================================================================
import { z } from 'zod';

// --- JSON-Extraktion (fence-stripping + erstes {...}/[...] als Fallback) ---
export function cleanLLMJson(text) {
  return String(text).replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
}

export function extractJson(text) {
  const cleaned = cleanLLMJson(text);
  try {
    return JSON.parse(cleaned);
  } catch { /* weiter mit Fallbacks */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* weiter */ }
  }
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch { /* weiter */ }
  }
  return null;
}

// Validiert geparstes JSON gegen ein Zod-Schema. Wirft bei Verletzung.
// Fehlermeldung ist auf eine Zeile gekuerzt (erscheint in Function-Logs & 500-Antworten).
export function parseWithSchema(text, schema, label = 'LLM-Output') {
  const data = extractJson(text);
  if (data === null || data === undefined) {
    throw new Error(`${label}: kein valides JSON in der KI-Antwort`);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`${label}: Schema-Verletzung — ${detail}`);
  }
  return result.data;
}

// ============================================================================
// Strategien (nexus-generate-strategies)
// Die Roh-Ausgabe der KI ist volatil (Keys koennen heissen wie sie wollen).
// Der Handler normalisiert deshalb ALIAS-Felder — diese Normalisierung ist
// hierher geholt, damit sie einzigartig getestet wird; danach sichert Zod
// die kanonische Form (Typen + Mindestfelder) vor dem DB-Insert ab.
// ============================================================================
export const strategyQuerySchema = z.object({
  market: z.string().catch('Global'),
  language: z.string().catch('de'),
  query: z.string().catch(''),
}).passthrough();

export const strategyItemSchema = z.object({
  signal_category: z.string().catch('expansion'),
  trigger_name: z.string().catch('Signal Trigger'),
  why_relevant: z.string().catch('Relevanter B2B Vertriebs-Trigger'),
  search_queries: z.array(strategyQuerySchema).catch([]),
  source_hints: z.array(z.string()).catch(['Web & LinkedIn']),
});

export const strategiesResponseSchema = z.object({
  strategies: z.array(strategyItemSchema),
});

export function normalizeStrategies(parsed) {
  let raw = [];
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (Array.isArray(parsed?.strategies)) {
    raw = parsed.strategies;
  } else if (Array.isArray(parsed?.signal_strategies)) {
    raw = parsed.signal_strategies;
  } else if (Array.isArray(parsed?.data)) {
    raw = parsed.data;
  } else if (parsed && typeof parsed === 'object') {
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0) {
        raw = val;
        break;
      }
    }
  }
  const strategies = raw.map((s) => ({
    signal_category: s?.signal_category || s?.category || s?.type || 'expansion',
    trigger_name: s?.trigger_name || s?.name || s?.trigger || s?.title || 'Signal Trigger',
    why_relevant: s?.why_relevant || s?.why || s?.relevance || s?.reason || s?.explanation || 'Relevanter B2B Vertriebs-Trigger',
    search_queries: s?.search_queries || s?.queries || (s?.query ? [{ market: 'Global', language: 'de', query: s.query }] : []),
    source_hints: s?.source_hints || s?.sources || s?.hints || ['Web & LinkedIn'],
  }));
  return { strategies };
}

// Radar-Hit-Klassifikation (cron-evaluate): relevance_score landet in numeric
// und steuert die relevance-Schwelle (>= 50) — Koerzion + Clamping verhindern
// hier String-Vergleiche und DB-Insert-Fehler.
export const radarHitClassificationSchema = z.object({
  status: z.enum(['relevant', 'irrelevant']).catch('irrelevant'),
  relevance_score: z.coerce.number()
    .catch(0)
    .transform((v) => Math.max(0, Math.min(100, v))),
  relevance_reason: z.string().catch('N/A'),
  trigger_type: z.string().catch('N/A'),
  firmenname: z.string().nullable().catch(null),
  domain: z.string().nullable().catch(null),
}).passthrough();

// Firmenprofil (nexus-company-profile-step): Booleans/Arrays landen direkt in
// DB-Spalten — z.B. wuerde der String "false" die truthy-Pruefung des
// Competitor-Gates ueberleben und Leads faelschlich downgraden.
export const companyProfileSchema = z.object({
  aussagen: z.array(z.object({ text: z.string().catch(''), zitat: z.string().catch('') }).passthrough()).catch([]),
  leistungen: z.array(z.string()).catch([]),
  zielgruppe: z.string().nullable().catch(null),
  impressum_info: z.string().nullable().catch(null),
  is_competitor: z.union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .catch(false),
  competitor_reason: z.string().nullable().catch(null),
  competitor_category: z.string().nullable().catch(null),
}).passthrough();

// Business-Event-Extraktion (nexus-event-extraction): Struktur sichert die
// Spalten von nexus_events (confidence landet in einer numeric-Spalte — ein
// String wie "hoch" wuerde den Insert sprengen).
export const businessEventSchema = z.object({
  event_type: z.string().catch('regulatory'),
  title: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  company_name: z.string().catch('UNRESOLVED'),
  company_domain: z.string().nullable().catch(null),
  country: z.string().nullable().catch(null),
  region: z.string().nullable().catch(null),
  city: z.string().nullable().catch(null),
  event_date: z.string().nullable().catch(null),
  confidence: z.coerce.number().catch(0.5),
  evidence: z.string().nullable().catch(null),
}).passthrough();

// Scan-Extraktion (nexus-radar-scan-step): sichert, dass trigger_events ein
// Array bleibt — die KI liefert sonst mal einen String/Objekt, der ungefiltert
// in die DB-Spalte triggers wandern wuerde.
export const scanTriggerExtractionSchema = z.object({
  trigger_events: z.array(z.record(z.unknown())).catch([]),
});

// Text -> { trigger_events: [...] }. Liefert Fallback-Objekt bei keinem Ergebnis.
export function parseScanTriggers(text) {
  const parsed = extractJson(text);
  if (parsed === null || parsed === undefined) {
    return { trigger_events: [] };
  }
  const result = scanTriggerExtractionSchema.safeParse(parsed);
  return result.success ? result.data : { trigger_events: [] };
}

// Text -> normalisiertes, validiertes { strategies: [...] }. Wirft bei keinem Ergebnis.
export function parseStrategiesOutput(text) {
  const parsed = extractJson(text);
  if (parsed === null || parsed === undefined) {
    throw new Error('Invalid JSON from AI');
  }
  const normalized = normalizeStrategies(parsed);
  const result = strategiesResponseSchema.safeParse(normalized);
  if (!result.success) {
    const detail = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Strategien-Schema-Verletzung — ${detail}`);
  }
  const valid = result.data.strategies.filter((s) => s.trigger_name && s.why_relevant);
  if (valid.length === 0) {
    throw new Error('AI generated no valid strategies.');
  }
  return { strategies: valid };
}
