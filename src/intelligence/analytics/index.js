export const trackHitEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      project: 'happiness_hit',
      ...params
    })
  }
}

export const trackIdeaSubmitted = (topic) => {
  trackHitEvent('hit_idea_submitted', { idea_topic: topic })
}

export const trackRecipeGenerated = (title, duration) => {
  trackHitEvent('hit_recipe_success', { video_title: title, video_duration: duration })
}

export const trackPlatformViewed = (platformName) => {
  trackHitEvent('hit_platform_tab_click', { platform: platformName })
}

export const trackCapCutTriggered = () => {
  trackHitEvent('hit_capcut_export_click', { action: 'start_autopilot' })
}
