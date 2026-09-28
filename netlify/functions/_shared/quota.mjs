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

// --- Tageszaehler --------------------------------------------------------

// UTC-Tag als Bucket-Tag (Blobs ueberleben den Tag hinaus; Tagwechsel = neuer Key)
export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
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

export function tavilyDailyLimit() {
  const n = parseInt(process.env.TAVILY_DAILY_LIMIT, 10);
  return Number.isFinite(n) ? n : 30; // Tavily-Free ~1000 Credits/Monat
}

// --- Provider-Cooldowns --------------------------------------------------

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
