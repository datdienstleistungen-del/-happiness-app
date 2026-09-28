// ============================================================================
// NeXus Radar Scan — QUEUE (Background Function)
//
// Faehrt einen nexus_scan_jobs-Chunked-Scan serverseitig zu Ende: verarbeitet
// pending_urls nacheinander (Claim-geschuetzt), bis der Job done/error ist,
// das Zeitbudget oder der Iterations-Cap erreicht wird. Das Frontend muss dafuer
// kein Tab offen lassen — es pollt nur noch nexus-radar-scan-step (Read/Claim-
// fallback) auf Status.
//
// Ausloeser: nexus-radar-scan-start (nach Job-Anlage und bei already_running,
// ueber x-queue-secret). Background-Mode via netlify.toml
// [functions."nexus-radar-scan-queue"] background = true -> sofortiges 202,
// dann bis 15 Minuten Laufzeit.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { fetchJob, guardJob, claimJob, processNextUrl } from './_shared/scan-job.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Secret: eigene Var oder Fallback auf den Service-Key (liegt ohnehin nur in
// den Function-Env-Vars, nie im Browser). Ohne beides -> Queue deaktiviert.
const QUEUE_SECRET = process.env.RADAR_QUEUE_SECRET || serviceKey;

const WORK_BUDGET_MS = 8 * 60 * 1000;  // unter dem 15-Min-Background-Limit
const MAX_ITERATIONS = 30;
const CLAIM_RETRY_MS = 1200;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!QUEUE_SECRET || !supabaseUrl || !serviceKey) {
    console.warn('[ScanQueue] Konfiguration fehlt (SUPABASE_SERVICE_KEY) — Queue deaktiviert.');
    return json(503, { error: 'queue not configured' });
  }

  const provided = (event.headers && (event.headers['x-queue-secret'] || event.headers['X-Queue-Secret'])) || '';
  if (provided !== QUEUE_SECRET) {
    return json(403, { error: 'forbidden' });
  }

  let jobId = null;
  try {
    jobId = (JSON.parse(event.body || '{}') || {}).job_id;
  } catch (e) {}
  if (!jobId) return json(400, { error: 'job_id required' });

  // Service-Client (bypassed RLS) — der Worker hat keinen User-Token.
  const svc = createClient(supabaseUrl, serviceKey);

  const deadline = Date.now() + WORK_BUDGET_MS;
  let processed = 0;
  let claimMisses = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS && Date.now() < deadline; i++) {
      const job = await fetchJob(svc, jobId);
      if (!job) {
        return json(200, { ok: false, reason: 'job-not-found', processed });
      }

      const guard = await guardJob(svc, job);
      if (guard.finished) {
        return json(200, { ok: true, reason: 'finished', processed, status: guard.response.status });
      }

      const claimed = await claimJob(svc, job);
      if (!claimed) {
        // Jemand anderes (andere Queue-Instanz oder Frontend-Polling) haelt
        // gerade den Claim oder der Job hat sich geaendert -> kurz neu laden.
        claimMisses++;
        if (claimMisses >= 3) {
          return json(200, { ok: true, reason: 'claimed-elsewhere', processed });
        }
        await new Promise(r => setTimeout(r, CLAIM_RETRY_MS));
        continue;
      }
      claimMisses = 0;

      await processNextUrl(svc, job);
      processed++;
    }

    console.log(`[ScanQueue] Budget/Cap erreicht nach ${processed} URLs (job=${jobId}).`);
    return json(200, { ok: true, reason: 'budget', processed });
  } catch (e) {
    console.error('[ScanQueue] Error:', e);
    return json(500, { error: e.message, processed });
  }
};
