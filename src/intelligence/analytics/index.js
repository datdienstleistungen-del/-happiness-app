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

export const trackWorkflowCreated = (platform) => {
  trackHitEvent('hit_workflow_created', { platform })
}

export const trackWorkflowCompleted = (platform, duration) => {
  trackHitEvent('hit_workflow_completed', { platform, duration_seconds: duration })
}

export const trackArtifactSaved = (type) => {
  trackHitEvent('hit_artifact_saved', { artifact_type: type })
}

export const trackDemoStarted = (goal) => {
  trackHitEvent('hit_demo_started', { goal })
}

export const trackDemoCompleted = (goal) => {
  trackHitEvent('hit_demo_completed', { goal })
}

export const trackWidgetOpened = (workflowId) => {
  trackHitEvent('hit_widget_opened', { workflow_id: workflowId })
}

export const trackPlatformsDetected = (platforms) => {
  trackHitEvent('hit_platforms_detected', { platforms: platforms.join(','), count: platforms.length })
}

export const trackMasterBriefGenerated = (goal) => {
  trackHitEvent('hit_master_brief_generated', { goal })
}

export const trackPlatformAgentResult = (platform, success) => {
  trackHitEvent('hit_platform_agent_result', { platform, success: success ? 'yes' : 'no' })
}

export const trackMultiPlatformCount = (count) => {
  trackHitEvent('hit_multi_platform_count', { count })
}
