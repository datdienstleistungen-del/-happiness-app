const STORAGE_KEY = 'nexus_free_pass_data'
const PASS_DURATION_SECONDS = 24 * 3600

export async function fetchFreePassStatus() {
  let localData = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) localData = JSON.parse(raw)
  } catch (e) {}

  try {
    const res = await fetch('/.netlify/functions/nexus-free-pass')
    if (res.ok) {
      const data = await res.json()
      if (data && data.success) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        return data
      }
    }
  } catch (err) {
    console.warn('Free pass API network fallback:', err)
  }

  // Client fallback if offline / local dev without netlify functions running
  const now = Date.now()
  if (localData && localData.expires_at) {
    const expTime = new Date(localData.expires_at).getTime()
    const remaining = Math.max(0, Math.floor((expTime - now) / 1000))
    return {
      success: true,
      remaining_seconds: remaining,
      is_active: remaining > 0,
      is_expired: remaining <= 0,
      expires_at: localData.expires_at
    }
  }

  // Brand new pass in localStorage
  const expiresAt = new Date(now + PASS_DURATION_SECONDS * 1000).toISOString()
  const fallbackData = {
    success: true,
    started_at: new Date(now).toISOString(),
    expires_at: expiresAt,
    remaining_seconds: PASS_DURATION_SECONDS,
    is_active: true,
    is_expired: false,
    duration_hours: 24
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData))
  } catch (e) {}
  return fallbackData
}

export function formatRemainingTime(seconds) {
  if (seconds <= 0) return '00:00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
