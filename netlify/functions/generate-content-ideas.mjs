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

    const prompt = `Du bist ein TikTok-Experte der VIRALE Clips analysiert. Du生成ierst keine "schönen" Ideen — du生成ierst IDEEN DIE FUNKTIONIEREN. Jede Idee muss durch einen "Would I stop scrolling?" Test kommen.

Ziel des Creators: ${goal}
Plattform: ${platform}
Anzahl Ideen: ${count}

REGELN FÜR VIRALE IDEEN:
- Hook muss in 1 Sekunde entscheiden: Scroll weiter oder stehen bleiben
- Kein "Hallo ich bin..." — direkt rein mit dem Content
- controversy > harmlos. Eine starke Meinung ist besser als "schöner" Content
- "Du machst X falsch" funktioniert immer besser als "So machst du X"
- Konflikt erzeugt Interesse: Zeig das Problem VOR der Lösung
- Specific beats generic: "Mein Kühlschrank sieht aus wie bei Hoarders" > "Mein Kühlschrank"
- Pattern Interrupt: Iwas muss in den ersten 0.5 Sekunden passieren das den Zuschauer überrascht

Für jede Idee:
1. HOOK (die ersten 1-3 Sekunden) — muss SOFORT Aufmerksamkeit erregen. Kein Aufwärmen. Direkt der schärfste Punkt.
2. VIDEO-BESCHREIBUNG — Was passiert konkret (nicht "zeig deinen Alltag" sondern SZENE für SZENE)
3. WARUM ES FUNKTIONIERT — Psychologischer Trigger (Neugier, Wut, Lachen, Schock)
4. SUCHBEGRIFF — Englischer Begriff für Referenz-Videos (z.B. "disgusting kitchen cleaning", "apartment tour small space hacks")
5. SCHWIERIGKEIT — Einfach/Mittel/Schwer

VERBOTEN:
- "Hallo ich bin [Name] und heute zeige ich euch..."
- "5 Tipps für..."
- "So funktioniert..."
- Generische Hooks wie "Wer kennt das nicht..."
- "In diesem Video zeige ich euch..."
- Iwas das nach YouTube-Tutorial klingt

IDEEN MÜSSEN SICH VONANDER UNTERSCHIEDEN — kein Copy-Paste mit anderen Worten.

Antworte NUR mit einem gültigen JSON Array:
[
  {
    "hook": "Schockierender erster Satz der Aufmerksamkeit erregt",
    "content": "Konkrete Szenen Beschreibung, nicht abstrakt",
    "why_it_works": "Welcher psychologische Trigger wird ausgelöst",
    "search_term": "englischer Suchbegriff für Referenz-Videos",
    "difficulty": "Einfach"
  }
]${rulesText}

NUR das JSON Array. Kein Text davor oder danach. Kein ```json``` markdown.`

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
          model: 'mistral-large-latest',
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
              temperature: 0.8,
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
