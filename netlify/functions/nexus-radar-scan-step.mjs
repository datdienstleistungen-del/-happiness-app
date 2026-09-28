/**
 * NeXus Radar Scan — STEP
 * 
 * Verarbeitet eine URL pro Aufruf (Frontend-Polling / Claim-Fallback):
 * 1. Job laden + Grenz-Checks (stale / hard-cap / leer) via _shared/scan-job.mjs
 * 2. Claim gewinnen -> naechste URL verarbeiten
 * 3. Claim verloren (Background-Queue nexus-radar-scan-queue laeuft gerade)
 *    -> nur ReadOnly-Zustand zurueckgeben (Statusanzeige)
 *
 * Die eigentliche Verarbeitung liegt in _shared/scan-job.mjs und wird von
 * beiden Fahrern (diese Function und der Queue) identisch genutzt. Ohne
 * aktive Queue bleibt dieses Polling der alleinige Treiber wie bisher.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchJob, guardJob, claimJob, processNextUrl, readResponse } from './_shared/scan-job.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { job_id } = JSON.parse(event.body || '{}');

    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

    if (!job_id) return { statusCode: 400, body: JSON.stringify({ error: 'job_id required' }) };

    const job = await fetchJob(userSupabase, job_id, user.id);
    if (!job) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Job nicht gefunden' }) };
    }

    const guard = await guardJob(userSupabase, job);
    if (guard.finished) {
      return json(200, guard.response);
    }

    const claimed = await claimJob(userSupabase, job);
    if (!claimed) {
      // Claim liegt bei der Background-Queue (oder einem anderen Poll) ->
      // frischen Zustand als ReadOnly liefern, Frontend zeigt weiter Status.
      const fresh = await fetchJob(userSupabase, job_id, user.id);
      return json(200, readResponse(fresh || job));
    }

    const response = await processNextUrl(userSupabase, job);
    return json(200, response);

  } catch (e) {
    console.error('[ScanStep] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
