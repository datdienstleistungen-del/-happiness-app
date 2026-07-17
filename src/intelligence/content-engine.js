/**
 * Content Engine
 *
 * Orchestrates all 12 platform agents.
 * Each agent returns structured JSON.
 *
 * flow: goal → detectPlatforms → runPlatformAgent (parallel) → results[]
 */

import tiktokPrompt from '../platforms/tiktok.js'
import facebookPrompt from '../platforms/facebook.js'
import instagramPrompt from '../platforms/instagram.js'
import linkedinPrompt from '../platforms/linkedin.js'
import youtubePrompt from '../platforms/youtube.js'
import kleinanzeigenPrompt from '../platforms/kleinanzeigen.js'
import redditPrompt from '../platforms/reddit.js'
import pinterestPrompt from '../platforms/pinterest.js'
import emailPrompt from '../platforms/email.js'
import podcastPrompt from '../platforms/podcast.js'
import twitterPrompt from '../platforms/twitter.js'
import blogPrompt from '../platforms/blog.js'
import googleBusinessPrompt from '../platforms/google-business.js'
import newsletterPrompt from '../platforms/newsletter.js'

const PLATFORM_AGENTS = {
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    prompt: tiktokPrompt,
    keywords: ['tiktok', 'reel', 'kurzvideo'],
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    prompt: instagramPrompt,
    keywords: ['instagram', 'ig', 'story'],
  },
  facebook: {
    name: 'Facebook',
    icon: '👥',
    prompt: facebookPrompt,
    keywords: ['facebook', 'fb'],
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    prompt: linkedinPrompt,
    keywords: ['linkedin'],
  },
  youtube: {
    name: 'YouTube Shorts',
    icon: '▶️',
    prompt: youtubePrompt,
    keywords: ['youtube', 'yt'],
  },
  twitter: {
    name: 'X / Twitter',
    icon: '🐦',
    prompt: twitterPrompt,
    keywords: ['twitter', 'tweet', 'x post'],
  },
  pinterest: {
    name: 'Pinterest',
    icon: '📌',
    prompt: pinterestPrompt,
    keywords: ['pinterest', 'pin', 'board'],
  },
  reddit: {
    name: 'Reddit',
    icon: '🔴',
    prompt: redditPrompt,
    keywords: ['reddit', 'thread', 'ama'],
  },
  blog: {
    name: 'Blog',
    icon: '📝',
    prompt: blogPrompt,
    keywords: ['blog', 'artikel'],
  },
  newsletter: {
    name: 'Newsletter',
    icon: '✉️',
    prompt: newsletterPrompt,
    keywords: ['newsletter', 'mailing'],
  },
  googleBusiness: {
    name: 'Google Business',
    icon: '📍',
    prompt: googleBusinessPrompt,
    keywords: ['google business', 'gm', 'lokales'],
  },
  kleinanzeigen: {
    name: 'Kleinanzeigen',
    icon: '🏷️',
    prompt: kleinanzeigenPrompt,
    keywords: ['kleinanzeige', 'verkauf', 'vermietung', 'preis'],
  },
}

const PLATFORM_ORDER = [
  'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube',
  'twitter', 'pinterest', 'reddit', 'blog', 'newsletter',
  'googleBusiness', 'kleinanzeigen'
]

/**
 * Priorisierte Plattform-Erkennung
 * Spezifische Begriffe werden zuerst geprüft
 */
export function detectPlatforms(goal) {
  const lower = goal.toLowerCase()
  const detected = []

  // Priorisierte Erkennung
  const priorityRules = [
    { key: 'tiktok', patterns: [/tiktok/i, /reel/i, /kurzvideo/i] },
    { key: 'youtube', patterns: [/youtube/i, /yt shorts/i] },
    { key: 'instagram', patterns: [/instagram/i, /\big\b/i, /story/i] },
    { key: 'linkedin', patterns: [/linkedin/i] },
    { key: 'twitter', patterns: [/twitter/i, /\btweet\b/i, /\bx post\b/i] },
    { key: 'blog', patterns: [/blog/i, /artikel/i] },
    { key: 'newsletter', patterns: [/newsletter/i, /mailing/i] },
    { key: 'googleBusiness', patterns: [/google business/i, /\bgm\b/i, /lokal/i] },
    { key: 'kleinanzeigen', patterns: [/kleinanzeige/i, /verkauf/i, /vermietung/i] },
    { key: 'reddit', patterns: [/reddit/i, /ama/i] },
    { key: 'pinterest', patterns: [/pinterest/i, /\bpin\b/i] },
    { key: 'facebook', patterns: [/facebook/i, /\bfb\b/i] },
  ]

  for (const rule of priorityRules) {
    if (rule.patterns.some(p => p.test(lower))) {
      detected.push(rule.key)
    }
  }

  // Fallback: generische Keywords prüfen
  if (detected.length === 0) {
    for (const [key, agent] of Object.entries(PLATFORM_AGENTS)) {
      if (agent.keywords.some(kw => lower.includes(kw))) {
        detected.push(key)
      }
    }
  }

  // Wenn "video" generisch → TikTok
  if (detected.length === 0 && /video/i.test(lower)) {
    detected.push('tiktok')
  }

  // Letzter Fallback: Instagram
  if (detected.length === 0) {
    detected.push('instagram')
  }

  return detected
}

/**
 * Parst die JSON-Antwort eines Agents
 */
export function parsePlatformResult(rawText) {
  if (!rawText) return null

  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.body || parsed.hook) {
        return {
          hook: parsed.hook || '',
          title: parsed.title || '',
          body: parsed.body || '',
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
          cta: parsed.cta || '',
          imageIdea: parsed.imageIdea || '',
          platformSpecific: parsed.platformSpecific || {}
        }
      }
    }
  } catch (e) {
    console.warn('[ContentEngine] JSON parse failed for platform, using fallback')
  }

  // Fallback: Fließtext als body
  return {
    hook: '',
    title: '',
    body: rawText,
    hashtags: [],
    cta: '',
    imageIdea: '',
    platformSpecific: {}
  }
}

export function getAgentPrompt(platformKey) {
  return PLATFORM_AGENTS[platformKey]?.prompt || ''
}

export function getAgentName(platformKey) {
  return PLATFORM_AGENTS[platformKey]?.name || platformKey
}

export function getAgentIcon(platformKey) {
  return PLATFORM_AGENTS[platformKey]?.icon || '📄'
}

export function getAllPlatforms() {
  return PLATFORM_ORDER.map(key => ({
    key,
    name: PLATFORM_AGENTS[key].name,
    icon: PLATFORM_AGENTS[key].icon,
  }))
}

/**
 * Führt einen einzelnen Plattform-Agent aus
 */
export async function runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token) {
  const agent = PLATFORM_AGENTS[platformKey]
  if (!agent) return null

  const systemPrompt = `${agent.prompt}\n\n---\n\nMASTER-BRIEF:\n${masterBrief}\n\n---\n\nErstelle den fertigen Content basierend auf dem Master-Brief und den Plattform-Regeln.`

  try {
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: `Erstelle Content für ${agent.name}.`,
        systemPrompt,
        history: [],
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    const parsed = parsePlatformResult(data.response)

    return {
      platform: platformKey,
      name: agent.name,
      icon: agent.icon,
      content: parsed,
      raw: data.response
    }
  } catch {
    return null
  }
}

/**
 * Führt alle Plattformen parallel aus
 */
export async function runAllPlatformAgents(platforms, goal, masterBrief, chatEndpoint, token, onProgress) {
  const results = {}

  const promises = platforms.map(async (platformKey, index) => {
    const result = await runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token)
    if (result) {
      results[platformKey] = result
    }
    if (onProgress) {
      onProgress(platformKey, index + 1, platforms.length)
    }
    return result
  })

  await Promise.all(promises)
  return results
}

/**
 * Erstellt einen Master-Brief aus den Goal-Analyse-Daten
 */
export function buildMasterBriefFromAnalysis(analysis) {
  return `Ziel: ${analysis.goal}
Branche: ${analysis.industry}
Zielgruppe: ${analysis.targetAudience}
Tonfall: ${analysis.tone}
Hooks: ${analysis.hooks.join(' | ')}
Hashtags: ${analysis.hashtags.join(', ')}
Content-Chance: ${analysis.contentScore}%
Beste Zeit: ${analysis.bestTime}`
}

export { PLATFORM_AGENTS, PLATFORM_ORDER }
