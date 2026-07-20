const DEV_MODE_KEY = 'developer_mode'

export function getEnvironment() {
  const h = window.location.hostname
  if (h === 'localhost') return 'localhost'
  if (h.includes('preview--')) return 'preview'
  return 'production'
}

export function enableDeveloperMode() {
  localStorage.setItem(DEV_MODE_KEY, 'true')
  applyDeveloperMode()
  console.log('%c Developer Mode: ACTIVE', 'color: #1b6e6e; font-weight: bold; font-size: 14px;')
}

export function disableDeveloperMode() {
  localStorage.removeItem(DEV_MODE_KEY)
  console.log('%c Developer Mode: OFF', 'color: #6b7280; font-weight: bold; font-size: 14px;')
}

export function isDeveloperMode() {
  return localStorage.getItem(DEV_MODE_KEY) === 'true'
}

function applyDeveloperMode() {
  if (!isDeveloperMode()) return
  if (typeof window.gtag !== 'function') return

  window.gtag('set', {
    traffic_type: 'internal',
    debug_mode: true,
    user_properties: { role: 'developer' }
  })

  window.gtag('event', 'developer_mode_enabled', {
    environment: getEnvironment()
  })
}

export function initDeveloperMode() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('developer') === 'true') enableDeveloperMode()
  if (params.get('developer') === 'false') disableDeveloperMode()

  applyDeveloperMode()

  if (isDeveloperMode()) {
    console.log('%c Developer Mode: ACTIVE', 'color: #1b6e6e; font-weight: bold; font-size: 14px;')
  } else {
    console.log('%c Developer Mode: OFF', 'color: #6b7280; font-weight: bold; font-size: 14px;')
  }

  window.enableDeveloperMode = enableDeveloperMode
  window.disableDeveloperMode = disableDeveloperMode
}
