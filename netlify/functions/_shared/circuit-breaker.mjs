// ============================================================================
// NeXus _shared/circuit-breaker.mjs
// Automatischer Not-Aus & Schutzwall gegen Kosten- und Sicherheitslecks
//
// Prinzip: "Erkennen und sofort schließen"
// 1. Erkennt Bot-Bursts / Frequenz-Anomalien -> Sperrt IP sofort (Quarantäne).
// 2. Erkennt Kosten-Bursts / Provider-Fehler -> Schaltet Bezahl-APIs (DeepSeek,
//    OpenAI) sofort systemweit ab (Not-Aus / Free-Fallback).
// 3. Status ist persistent über Netlify Blobs & In-Memory Fallback.
// ============================================================================

import { tryConsumeHourly, setCooldown, cooldownRemaining, dayKey, hourKey } from './quota.mjs';

const IP_QUARANTINE_MS = 24 * 60 * 60 * 1000; // 24 Stunden Vollsperre bei Missbrauch / Bot-Bursts
const MAX_REQUESTS_PER_MINUTE_PER_IP = 4; // Max 3-4 Anfragen/Minute pro IP (menschliches Arbeitstempo)
const MAX_REQUESTS_PER_HOUR_PER_IP = 60; // Max 60 Requests/Stunde pro IP

// Speicher für In-Memory Rate-Limiting
const ipMinuteBuckets = new Map();

/**
 * Ermittelt die echte Client-IP aus Netlify- / Proxy-Headern
 */
export function getClientIp(event) {
  const headers = event.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['x-nf-client-connection-ip'] || headers['client-ip'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/**
 * Prüft, ob eine IP unter Quarantäne steht
 */
export async function isIpQuarantined(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') return false;
  const remaining = await cooldownRemaining(`quarantine:ip:${ip}`);
  return remaining > 0;
}

/**
 * Erkennt Anomalien und sperrt eine auffällige IP sofort
 */
export async function quarantineIp(ip, reason) {
  const hours = Math.round(IP_QUARANTINE_MS / 3600000);
  console.warn(`[CIRCUIT-BREAKER] 🚨 ANOMALIE ERKANNT: Sperre IP ${ip} sofort für ${hours} Stunden. Grund: ${reason}`);
  await setCooldown(`quarantine:ip:${ip}`, IP_QUARANTINE_MS);
}

/**
 * Rate-Limiter & Burst-Detector mit automatischem Sofort-Verschluss (Auto-Quarantine)
 * Gibt { allowed: true } oder { allowed: false, status: 429, reason: string } zurück.
 */
export async function checkIpSafety(event, options = {}) {
  const ip = getClientIp(event);
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') {
    return { allowed: true };
  }

  // 1. Prüfen, ob IP bereits in Quarantäne ist
  if (await isIpQuarantined(ip)) {
    const remainingMs = await cooldownRemaining(`quarantine:ip:${ip}`);
    const remainingHours = Math.ceil(remainingMs / 3600000);
    return {
      allowed: false,
      status: 403,
      error: `Zugriff für diese IP gesperrt wegen wiederholter automatisierter Anfragen. Sperre aktiv für noch ca. ${remainingHours} Stunden.`
    };
  }

  // 2. Minuten-Burst-Check (In-Memory Sliding Minute)
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const minuteKey = `${ip}:${currentMinute}`;
  const minuteCount = (ipMinuteBuckets.get(minuteKey) || 0) + 1;
  ipMinuteBuckets.set(minuteKey, minuteCount);

  // Alte Minuten aus dem Speicher aufräumen
  if (ipMinuteBuckets.size > 2000) {
    for (const [k] of ipMinuteBuckets.entries()) {
      const min = parseInt(k.split(':')[1], 10);
      if (min < currentMinute - 2) ipMinuteBuckets.delete(k);
    }
  }

  const maxPerMin = options.maxPerMinute || MAX_REQUESTS_PER_MINUTE_PER_IP;
  if (minuteCount > maxPerMin) {
    // ERKENNEN UND SOFORT SCHLIESSEN:
    await quarantineIp(ip, `Burst-Limit überschritten (${minuteCount} Requests in 1 Minute, menschliches Limit: ${maxPerMin})`);
    return {
      allowed: false,
      status: 403,
      error: 'Zu viele Anfragen in kurzer Zeit (menschliches Limit überschritten). Diese IP wurde für 24 Stunden gesperrt.'
    };
  }

  // 3. Stunden-Check
  const hourBucket = `ip_limit:${ip}:${hourKey()}`;
  const maxPerHour = options.maxPerHour || MAX_REQUESTS_PER_HOUR_PER_IP;
  const hourCheck = await tryConsumeHourly(hourBucket, maxPerHour);
  if (!hourCheck.allowed) {
    await quarantineIp(ip, `Stunden-Limit überschritten (${hourCheck.used}/${hourCheck.limit})`);
    return {
      allowed: false,
      status: 429,
      error: 'Stündliches Limit für diese IP überschritten.'
    };
  }

  return { allowed: true };
}

/**
 * Prüft, ob der globale Not-Aus für Bezahl-APIs aktiv ist
 */
export async function isPaidApiKillswitchTripped() {
  if (process.env.PAID_APIS_KILLSWITCH === 'true') {
    return { tripped: true, reason: 'Manuell via ENV-Killswitch aktiviert' };
  }
  const remaining = await cooldownRemaining('killswitch:paid_apis');
  if (remaining > 0) {
    return {
      tripped: true,
      reason: `Automatischer Kosten-Not-Aus aktiv (noch ${Math.ceil(remaining / 60000)} Minuten)`,
      remainingMs: remaining
    };
  }
  return { tripped: false };
}

/**
 * Löst den sofortigen Not-Aus für alle Bezahl-APIs (DeepSeek, OpenAI) aus.
 * Alle Funktionen fallen dann sofort auf 100% kostenlose APIs (Groq/OpenRouter) zurück.
 */
export async function tripPaidApiKillswitch(reason, durationMs = 2 * 60 * 60 * 1000) {
  console.warn(`[CIRCUIT-BREAKER] 🛑 NOT-AUS FÜR BEZAHL-APIs AKTIVIERT! Grund: ${reason}`);
  await setCooldown('killswitch:paid_apis', durationMs);
}

/**
 * Setzt den Not-Aus manuell zurück
 */
export async function resetPaidApiKillswitch() {
  console.log('[CIRCUIT-BREAKER] ✅ Not-Aus für Bezahl-APIs zurückgesetzt.');
  await setCooldown('killswitch:paid_apis', 0);
}
