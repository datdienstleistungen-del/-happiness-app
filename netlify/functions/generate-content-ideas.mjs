import { getMistralKey, getSupabaseClient } from '../util/_helpers.mjs'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { goal, platform = 'tiktok', count = 8 } = JSON.parse(event.body)

    const mistralKey = getMistralKey()
    const supabase = getSupabaseClient()

    // Load hook rules
    let hookRules = []
    try {
      const { data: rulesData } = await supabase
        .from('hook_rules')
        .select('pattern, rule, weight')
        .eq('active', true)
      hookRules = rulesData || []
    } catch (e) {
      // Continue without rules
    }

    const rulesText = hookRules.length > 0
      ? `\n\nRegeln für Hooks (aus der Praxis):\n${hookRules.map(r => `- ${r.rule} (Gewicht: ${r.weight}/10)`).join('\n')}`
      : ''

    const prompt = `Du bist ein TikTok Content-Stratege. Du hilfst Creators konkrete Content-Ideen zu entwickeln.

Ziel des Creators: ${goal}
Plattform: ${platform}
Anzahl Ideen: ${count}

Erstelle ${count} konkrete, umsetzbare Content-Ideen. Für jede Idee:
1. EIN konkreter Hook (die ersten 3 Sekunden) - muss neugierig machen
2. Was passiert im Video (2-3 Sätze)
3. Warum das funktioniert (Psychologie/Algorithmus)
4. Ein konkreter Suchbegriff für Referenz-Videos (Englisch, z.B. "satisfying paint peeling", "kitchen organization hack")
5. Schwierigkeitsgrad (Einfach/Mittel/Schwer)

Wichtig:
- KEIN AI-Content-Generierung-Vorschlag (kein "Nutze KI für...")
- Fokus auf manuelle Umsetzung die der Creator MIT DEM HANDY machen kann
- Jede Idee muss sich VONANDER UNTERSCHIEDEN
- Keine generischen Vorschläge wie "Zeig dein Alltag"
- Konkret und sofort umsetzbar

Antworte NUR mit einem gültigen JSON Array:
[
  {
    "hook": "Hook Text hier",
    "content": "Beschreibung was passiert",
    "why_it_works": "Warum funktioniert das",
    "search_term": "englischer Suchbegriff für Referenz",
    "difficulty": "Einfach"
  }
]${rulesText}

Antworte NUR mit dem JSON Array, kein Text davor oder danach.`

    // Try Mistral first
    let ideas = null
    let lastError = null

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        })
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''
        
        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          ideas = JSON.parse(jsonMatch[0])
        }
      } else {
        lastError = `Mistral: ${response.status}`
      }
    } catch (e) {
      lastError = `Mistral: ${e.message}`
    }

    // Fallback to Groq
    if (!ideas) {
      try {
        const groqKey = process.env.GROQ_API_KEY
        if (groqKey) {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 4000
            })
          })

          if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || ''
            const jsonMatch = content.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
              ideas = JSON.parse(jsonMatch[0])
            }
          } else {
            lastError = `Groq: ${response.status}`
          }
        }
      } catch (e) {
        lastError = `Groq: ${e.message}`
      }
    }

    if (!ideas) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          ideas: [],
          error: `Ideen konnten nicht generiert werden: ${lastError}`
        })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        ideas,
        total: ideas.length
      })
    }

  } catch (error) {
    console.error('Content ideas error:', error)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        ideas: [],
        error: 'Fehler bei der Ideengenerierung'
      })
    }
  }
}
