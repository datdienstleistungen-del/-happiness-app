import { createClient } from '@supabase/supabase-js'
import { callLLM } from './_shared/llm-core.mjs'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SYSTEM_PROMPT = `Du bist ein Social-Media-Experte. Erstelle ein kurzes, sofort postfertiges Video-Rezept.

WICHTIG: Antworte NUR mit validem JSON, kein Markdown, kein Text davor oder danach.

JSON-Struktur:
{
  "hook": "Der erste Satz des Videos (max 10 Wörter, muss stoppen)",
  "script": "Komplettes 30-Sekunden Voiceover (80-120 Wörter, authentisch, Deutsch)",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "best_time": "HH:MM Uhr",
  "platform": "tiktok"
}

Regeln:
- Hook muss innerhalb von 2 Sekunden Aufmerksamkeit erregenden
- Script: Keine Füllwörter, direkte Sprache, PSA-Modell (Problem → Agitation → Solution)
- Hashtags: Relevant + trending, mix aus großen und Nischen
- Plattform: Standard TikTok, es sei denn der User will etwas anderes`

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Nicht authentifiziert' }) }
  }

  // Parse body for freetext flow
  let body = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch (e) {
    body = {}
  }
  const { summarizeOnly, customRequest } = body

  try {
    // Auth check
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.VITE_SUPABASE_ANON_KEY }
    }).then(r => r.json())

    const user = authResponse?.id ? authResponse : authResponse?.data?.user
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Ungültiges Token' }) }
    }

    const today = new Date().toISOString().split('T')[0]

    // SUMMARIZE ONLY: User wrote freetext, we summarize it for confirmation
    if (summarizeOnly && customRequest) {
      let summary = customRequest
      try {
        const r = await callLLM([
          { role: 'system', content: 'Du fassst den Wunsch des Users in 1-2 klaren Sätzen zusammen. Antworte NUR mit der Zusammenfassung, kein Markdown, kein extra Text.' },
          { role: 'user', content: `Fasse zusammen was der User möchte:\n\n"${customRequest}"` }
        ], { providers: ['mistral'], temperature: 0.3, max_tokens: 200 })
        summary = r.text?.trim() || customRequest
      } catch (e) {
        console.error('[DAILY-PACKAGE] Summary error:', e.message)
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ summary })
      }
    }

    // Check if package already exists for today (skip for custom requests)
    if (!customRequest) {
      const { data: existing } = await supabase
        .from('daily_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('package_date', today)
        .single()

      if (existing) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ package: existing, cached: true })
        }
      }
    }

    // Load user profile for personalization
    const { data: profile } = await supabase
      .from('ai_profiles')
      .select('industry, target_audience, tone, goals')
      .eq('user_id', user.id)
      .single()

    const { data: settings } = await supabase
      .from('ai_settings')
      .select('language, daily_package_settings')
      .eq('user_id', user.id)
      .single()

    const lang = settings?.language || 'de'

    // Use custom request or fall back to profile-based context
    let userContext
    if (customRequest) {
      userContext = `Wunsch des Users: "${customRequest}"\nSprache: ${lang === 'de' ? 'Deutsch' : 'Englisch'}`
    } else {
      const pkgSettings = settings?.daily_package_settings || {}
      const industry = pkgSettings.topic || profile?.industry || 'Allgemein'
      const audience = profile?.target_audience || '18-35 Jahre'
      const tone = pkgSettings.tone || profile?.tone || 'authentisch'
      const platform = pkgSettings.platform || 'tiktok'
      const duration = pkgSettings.duration || 30

      userContext = `Branche: ${industry}
Zielgruppe: ${audience}
Tonfall: ${tone}
Sprache: ${lang === 'de' ? 'Deutsch' : 'Englisch'}
Plattform: ${platform}
Videodauer: ${duration} Sekunden`
    }

    // Generate with Mistral (Kette via _shared/llm-core.mjs)
    let raw = null
    try {
      const r = await callLLM([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: customRequest
          ? `Erstelle ein Creator-Paket basierend auf diesem Wunsch:\n\n${userContext}`
          : `Erstelle ein Creator-Paket für heute.\n\n${userContext}` }
      ], { providers: ['mistral'], temperature: 0.7, max_tokens: 1024 })
      raw = r.text || ''
    } catch (e) {
      console.error('[DAILY-PACKAGE] Mistral error:', e.message)
    }

    if (raw === null) {
      // Fallback: generic package
      const fallback = {
        hook: 'Stop scrolling. Das hier ändert alles.',
        script: 'Du scrollst durch feeds und fühlst dich leer. Alle posten, aber niemand sagt etwas Wichtiges. Doch was, wenn ich dir sage: Du kannst in 30 Sekunden etwas posten, das bleibt? Kein Glamour, keine Filter. Einfach du, ehrlich und direkt. Das ist Content, der verbindet. Probier es aus. Poste heute etwas Echtes.',
        hashtags: ['authentisch', 'echtbleiben', 'contentcreator', 'tiktokdeutsch', 'kreatorszene'],
        best_time: '18:30 Uhr',
        platform: platform
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ package: { ...fallback, user_id: user.id, package_date: today, used: false }, cached: false, fallback: true })
      }
    }

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const pkg = JSON.parse(cleaned)

    // Save to Supabase
    const { data: saved, error: saveError } = await supabase
      .from('daily_packages')
      .insert({
        user_id: user.id,
        package_date: today,
        hook: pkg.hook,
        script: pkg.script,
        hashtags: pkg.hashtags,
        best_time: pkg.best_time,
        platform: pkg.platform || platform,
        used: false
      })
      .select()
      .single()

    if (saveError) {
      console.error('[DAILY-PACKAGE] Save error:', saveError.message)
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ package: saved || { ...pkg, user_id: user.id, package_date: today, used: false }, cached: false })
    }

  } catch (error) {
    console.error('[DAILY-PACKAGE] Error:', error.message)
    return { statusCode: 500, body: JSON.stringify({ error: 'Fehler beim Erstellen des Pakets' }) }
  }
}
