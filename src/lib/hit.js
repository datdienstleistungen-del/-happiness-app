const HIT_ENABLED = import.meta.env.VITE_HIT_ENABLED === 'true'

export function getChatEndpoint() {
  return HIT_ENABLED ? '/api/hit-router' : '/api/chat'
}

export function isHitEnabled() {
  return HIT_ENABLED
}
