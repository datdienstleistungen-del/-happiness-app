import { supabase } from '../../lib/supabase'

const EVENTS_TABLE = 'events'

function getOrCreateVisitorId() {
  let visitorId = localStorage.getItem('visitor_id')
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    localStorage.setItem('visitor_id', visitorId)
  }
  return visitorId
}

let geoData = null
let geoLoaded = false

async function loadGeoData() {
  if (geoLoaded) return geoData
  geoLoaded = true
  try {
    const res = await fetch('https://ip-api.com/json/?fields=status,country,regionName,city,lat,lon')
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'success') {
        geoData = {
          country: data.country,
          region: data.regionName,
          city: data.city,
          latitude: data.lat,
          longitude: data.lon,
        }
      }
    }
  } catch {}
  return geoData
}

export async function trackEvent(eventName, metadata = {}) {
  const visitorId = getOrCreateVisitorId()
  const geo = await loadGeoData()

  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id || null

  const event = {
    visitor_id: visitorId,
    user_id: userId,
    event_name: eventName,
    metadata,
    page_url: window.location.href,
    city: geo?.city || null,
    country: geo?.country || null,
    region: geo?.region || null,
    latitude: geo?.latitude || null,
    longitude: geo?.longitude || null,
    user_agent: navigator.userAgent,
  }

  supabase.from(EVENTS_TABLE).insert(event).then(({ error }) => {
    if (error) console.warn('[Analytics] Insert error:', error.message)
  })
}

export function getVisitorId() {
  return getOrCreateVisitorId()
}

// Convenience wrappers
export function trackPageView(page) {
  trackEvent('page_view', { page })
}

export function trackGoalSubmitted(goal, platform) {
  trackEvent('goal_submitted', { goal, platform })
}

export function trackQuickResult(goal) {
  trackEvent('quick_result', { goal })
}

export function trackWorkflowStarted(workflowId, goal) {
  trackEvent('workflow_started', { workflow_id: workflowId, goal })
}

export function trackContentGenerated(platform, workflowId) {
  trackEvent('content_generated', { platform, workflow_id: workflowId })
}

export function trackCopyAction(platform) {
  trackEvent('copy_action', { platform })
}

export function trackChatMessage() {
  trackEvent('chat_message')
}
