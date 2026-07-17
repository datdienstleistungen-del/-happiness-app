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

const PLATFORM_AGENTS = {
  tiktok: {
    name: 'TikTok Agent',
    prompt: tiktokPrompt,
    platforms: ['tiktok'],
    keywords: ['video', 'tiktok', 'reel', 'kurzvideo'],
  },
  facebook: {
    name: 'Facebook Agent',
    prompt: facebookPrompt,
    platforms: ['facebook'],
    keywords: ['facebook', 'fb'],
  },
  instagram: {
    name: 'Instagram Agent',
    prompt: instagramPrompt,
    platforms: ['instagram'],
    keywords: ['instagram', 'ig', 'story'],
  },
  linkedin: {
    name: 'LinkedIn Agent',
    prompt: linkedinPrompt,
    platforms: ['linkedin'],
    keywords: ['linkedin'],
  },
  youtube: {
    name: 'YouTube Agent',
    prompt: youtubePrompt,
    platforms: ['youtube'],
    keywords: ['youtube', 'video'],
  },
  kleinanzeigen: {
    name: 'Kleinanzeigen Agent',
    prompt: kleinanzeigenPrompt,
    platforms: ['kleinanzeigen', 'marketplace'],
    keywords: ['kleinanzeige', 'verkauf', 'vermietung', 'preis'],
  },
  reddit: {
    name: 'Reddit Agent',
    prompt: redditPrompt,
    platforms: ['reddit'],
    keywords: ['reddit', 'thread', 'diskussion', 'ama'],
  },
  pinterest: {
    name: 'Pinterest Agent',
    prompt: pinterestPrompt,
    platforms: ['pinterest'],
    keywords: ['pinterest', 'pin', 'board', 'diy'],
  },
  email: {
    name: 'E-Mail Agent',
    prompt: emailPrompt,
    platforms: ['email'],
    keywords: ['e-mail', 'email', 'newsletter', 'mailing'],
  },
  podcast: {
    name: 'Podcast Agent',
    prompt: podcastPrompt,
    platforms: ['podcast'],
    keywords: ['podcast', 'episode', 'folge', 'audio'],
  },
}

const PLATFORM_ORDER = ['tiktok', 'instagram', 'facebook', 'linkedin', 'youtube', 'kleinanzeigen', 'reddit', 'pinterest', 'email', 'podcast']

export function detectPlatforms(goal) {
  const lower = goal.toLowerCase()
  const detected = []

  for (const [key, agent] of Object.entries(PLATFORM_AGENTS)) {
    if (agent.keywords.some(kw => lower.includes(kw))) {
      detected.push(key)
    }
  }

  if (detected.length === 0) {
    detected.push('facebook')
  }

  return detected
}

export function getAgentPrompt(platformKey) {
  return PLATFORM_AGENTS[platformKey]?.prompt || ''
}

export function getAgentName(platformKey) {
  return PLATFORM_AGENTS[platformKey]?.name || `${platformKey} Agent`
}

export function getAllPlatforms() {
  return PLATFORM_ORDER.map(key => ({
    key,
    name: PLATFORM_AGENTS[key].name,
    platforms: PLATFORM_AGENTS[key].platforms,
  }))
}

export function buildMasterBrief(goal, context = {}) {
  return `
Du bist die Master Content Engine von Happiness.

AUFGABE: Erstelle einen Master-Brief basierend auf dem Ziel des Nutzers.
Der Master-Brief wird an Plattform-Agenten weitergegeben.

ZIEL: "${goal}"
${context.ton ? `TÖNUNG: ${context.ton}` : ''}
${context.targetGroup ? `ZIELGRUPPE: ${context.targetGroup}` : ''}

Erstelle einen strukturierten Master-Brief mit:
1. KERNbotschaft (1 Satz)
2. ZIELGRUPPE (wer soll es sehen)
3. EMOTION (was soll der Zuschauer fühlen)
4. HAUPTTHEMA (worum geht es)
5. CALL-TO-ACTION (was soll der Zuschauer tun)

Antworte NUR mit dem Master-Brief, kein Markdown, kein JSON.
`.trim()
}

export async function runPlatformAgent(platformKey, goal, masterBrief, chatEndpoint, token) {
  const agent = PLATFORM_AGENTS[platformKey]
  if (!agent) return null

  if (platformKey === 'tiktok') {
    try {
      const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession())
      const token = session?.access_token || ''
      const res = await fetch('/api/content-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topic: goal.trim(), duration: 30 })
      })
      if (res.ok) {
        const recipe = await res.json()
        return { platform: 'tiktok', content: recipe.voiceover_script, agent: agent.name, recipe }
      }
    } catch {}
  }

  const systemPrompt = `${agent.prompt}

---

MASTER-BRIEF:
${masterBrief}

---

Erstelle den fertigen Content basierend auf dem Master-Brief und den Plattform-Regeln.
Antworte NUR mit dem fertigen Text, kein Markdown, kein JSON.`

  try {
    const response = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: `Erstelle Content für ${agent.name} basierend auf dem Master-Brief.`,
        systemPrompt,
        history: [],
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    return { platform: platformKey, content: data.response, agent: agent.name }
  } catch {
    return null
  }
}

export { PLATFORM_AGENTS, PLATFORM_ORDER }
