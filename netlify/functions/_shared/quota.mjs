// ============================================================================
// NeXus _shared/quota.mjs — Kontingent-Logik (Phase 5b, ARCHITECTURE.md §2)
//
// Tageszaehler und Provider-Cooldowns, persistent ueber Netlify Blobs
// (kein DB-Migration noetig). ohne Netlify-Kontext (lokal/Smoke) faellt es
// automatisch auf In-Memory zurueck — dann pro Prozess-Lauf gueltig.
//
// Werte sind Weich-Grenzen: Blobs haben keinen atomaren Increment, bei
// parallelen Aufrufen kann der Zaehler leicht ueberschreiten. Das ist
// bewusst so — es geht um Obergrenzen, nicht um harte Limits.
// ============================================================================
import crypto from 'crypto';

const STORE_NAME = 'neus-quota';

// --- Speicher: Blobs in Netlify, Map lokal -------------------------------
let blobStorePromise = null;
function getStoreSafe() {
  if (!blobStorePromise) {
    blobStorePromise = (async () => {
      try {
        const { getStore } = await import('@netlify/blobs');
        const store = getStore(STORE_NAME);
        // Probe: funktioniert der Store wirklich? (lokal wirft er oft erst
        // beim ersten Zugriff, nicht beim Anlegen)
        await store.get('__probe__');
        return store;
      } catch (e) {
        console.warn('[Quota] Netlify Blobs nicht verfuegbar, nutze In-Memory:', e.message);
        return null;
      }
    })();
  }
  return blobStorePromise;
}

const memDaily = new Map();
const memCooldown = new Map();

async function readRaw(key) {
  try {
    const store = await getStoreSafe();
    if (store) {
      const v = await store.get(key);
      return v == null ? null : v;
    }
  } catch {
    // Store-Zaehler fehlgeschlagen -> In-Memory lesen
  }
  return memDaily.get(key) ?? memCooldown.get(key) ?? null;
}

async function writeRaw(key, value) {
  try {
    const store = await getStoreSafe();
    if (store) {
      await store.set(key, String(value));
      return;
    }
  } catch (e) {
    console.warn('[Quota] Blobs-Schreiben fehlgeschlagen, nutze In-Memory:', e.message);
  }
  memDaily.set(key, String(value));
  memCooldown.set(key, String(value));
}

// --- Tages- und Stundenzaehler --------------------------------------------

// UTC-Tag als Bucket-Tag (Blobs ueberleben den Tag hinaus; Tagwechsel = neuer Key)
export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// UTC-Stunde als Bucket-Key (z.B. "2026-10-12T00")
export function hourKey(d = new Date()) {
  return d.toISOString().slice(0, 13);
}

// Key nie roh speichern — Fingerprint reicht zur Unterscheidung.
export function keyFingerprint(key) {
  return crypto.createHash('sha256').update(String(key || '')).digest('hex').slice(0, 12);
}

// Verbraucht 1 aus dem Tagesbudget. Liefert { allowed, used, limit }.
// Limit <= 0: nie erlaubt; nicht numerisch/fehlend: Default des Aufrufers.
export async function tryConsumeDaily(bucket, limit) {
  const used = parseInt(await readRaw(bucket), 10) || 0;
  if (used >= limit) return { allowed: false, used, limit };
  await writeRaw(bucket, used + 1);
  return { allowed: true, used: used + 1, limit };
}

// Verbraucht 1 aus dem Stundenbudget. Liefert { allowed, used, limit }.
export async function tryConsumeHourly(bucket, limit) {
  const used = parseInt(await readRaw(bucket), 10) || 0;
  if (used >= limit) return { allowed: false, used, limit };
  await writeRaw(bucket, used + 1);
  return { allowed: true, used: used + 1, limit };
}

// Token-Budget-Tracking (Standard: 100.000 Token/Tag pro Nutzer, persistent in Supabase)
export async function checkDailyTokenBudget(userId, maxDailyTokens = 100000) {
  const today = dayKey();
  let dbUsed = 0;

  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (sUrl && sKey && userId) {
    try {
      const res = await fetch(`${sUrl}/rest/v1/nexus_cost_log?user_id=eq.${userId}&created_at=gte.${today}T00:00:00Z&select=tokens_in,tokens_out`, {
        headers: { apikey: sKey, Authorization: `Bearer ${sKey}` }
      });
      if (res.ok) {
        const rows = await res.json();
        for (const r of rows) {
          dbUsed += (r.tokens_in || 0) + (r.tokens_out || 0);
        }
      }
    } catch (e) {
      console.warn('[Quota] Failed to fetch token usage from Supabase:', e.message);
    }
  }

  const key = `tokens:${userId}:${today}`;
  const memUsed = parseInt(await readRaw(key), 10) || 0;
  const totalUsed = Math.max(dbUsed, memUsed);

  return { allowed: totalUsed < maxDailyTokens, used: totalUsed, limit: maxDailyTokens };
}

export async function recordTokenUsage(userId, tokens, provider = 'llm', operation = 'request') {
  if (!tokens || tokens <= 0) return;
  const today = dayKey();
  const key = `tokens:${userId}:${today}`;
  const memUsed = parseInt(await readRaw(key), 10) || 0;
  await writeRaw(key, memUsed + tokens);

  const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (sUrl && sKey && userId) {
    try {
      await fetch(`${sUrl}/rest/v1/nexus_cost_log`, {
        method: 'POST',
        headers: {
          apikey: sKey,
          Authorization: `Bearer ${sKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          provider: provider || 'llm',
          operation: operation || 'request',
          tokens_in: Math.round(tokens * 0.75),
          tokens_out: Math.round(tokens * 0.25),
          cost_usd: 0
        })
      });
    } catch (e) {
      console.warn('[Quota] Failed to log token usage to Supabase:', e.message);
    }
  }
}

export function tavilyDailyLimit() {
  const n = parseInt(process.env.TAVILY_DAILY_LIMIT, 10);
  return Number.isFinite(n) ? n : 30; // Tavily-Free ~1000 Credits/Monat
}

// --- Provider-Cooldowns & Monitoring --------------------------------------

// Setzt eine Sperre fuer `ms` auf den Bucket-Namen.
export async function setCooldown(bucket, ms) {
  const until = new Date(Date.now() + ms).toISOString();
  await writeRaw(`cooldown:${bucket}`, until);
  console.warn(`[Quota] Cooldown ${bucket} bis ${until}`);
}

// Verbleibende Sperrzeit in ms (0 = frei oder Fehler).
export async function cooldownRemaining(bucket) {
  const raw = await readRaw(`cooldown:${bucket}`);
  if (!raw) return 0;
  const until = new Date(raw).getTime();
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

// Provider Health Monitoring: Fehler protokollieren
export async function recordProviderError(provider, errorMsg) {
  const today = dayKey();
  const countKey = `health:err:${provider}:${today}`;
  const lastKey = `health:last_err:${provider}`;
  const currentCount = parseInt(await readRaw(countKey), 10) || 0;
  await writeRaw(countKey, currentCount + 1);
  await writeRaw(lastKey, JSON.stringify({ error: String(errorMsg).slice(0, 200), timestamp: new Date().toISOString() }));
}

// Provider Health Snapshot fuer Monitoring-Endpoints
export async function getProviderHealthSnapshot(providers = ['deepseek', 'mistral', 'openrouter', 'groq', 'openai']) {
  const today = dayKey();
  const summary = {};
  for (const p of providers) {
    const isGloballyCooling = (await cooldownRemaining(`${p}:*`)) > 0;
    const errorsToday = parseInt(await readRaw(`health:err:${p}:${today}`), 10) || 0;
    const lastErrRaw = await readRaw(`health:last_err:${p}`);
    let lastError = null;
    try { if (lastErrRaw) lastError = JSON.parse(lastErrRaw); } catch {}
    summary[p] = {
      status: isGloballyCooling ? 'COOLDOWN' : (errorsToday > 10 ? 'DEGRADED' : 'HEALTHY'),
      errorsToday,
      cooldownRemainingMs: await cooldownRemaining(`${p}:*`),
      lastError
    };
  }
  return summary;
}

