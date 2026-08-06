/**
 * NeXus AI Function
 * 
 * Zentrale KI-Funktion für NeXus Sales Intelligence.
 * Nutzt die bestehende Multi-Provider Fallback-Kette von Happiness.
 * 
 * Provider-Reihenfolge:
 * 1. Groq (Llama 3.3 70B) - primär
 * 2. OpenRouter (Gemma 4) - Fallback
 * 3. Mistral - Fallback
 * 4. OpenAI - Fallback
 * 5. DeepSeek - Fallback
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

// ── Multi-Provider Fallback Chain ──

async function tryGroq(messages, temperature = 0.3) {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'groq', model: 'llama-3.3-70b-versatile' }
  } catch { return null }
}

async function tryOpenRouter(messages, temperature = 0.3) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://happiness-eu.netlify.app',
        'X-Title': 'NeXus Sales Intelligence'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'openrouter', model: 'gemma-4-26b' }
  } catch { return null }
}

async function tryMistral(messages, temperature = 0.3) {
  const key = process.env.MISTRAL_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'mistral', model: 'mistral-small-latest' }
  } catch { return null }
}

async function tryOpenAI(messages, temperature = 0.3) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'openai', model: 'gpt-4o-mini' }
  } catch { return null }
}

async function tryDeepSeek(messages, temperature = 0.3) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages,
        temperature,
        max_tokens: 4096
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || null, provider: 'deepseek', model: 'deepseek-v4-flash' }
  } catch { return null }
}

/**
 * Führt eine KI-Anfrage mit Fallback-Kette aus
 */
async function callAI(messages, temperature = 0.3) {
  // Versuche alle Provider in Reihenfolge
  const providers = [
    () => tryGroq(messages, temperature),
    () => tryOpenRouter(messages, temperature),
    () => tryMistral(messages, temperature),
    () => tryOpenAI(messages, temperature),
    () => tryDeepSeek(messages, temperature)
  ]

  for (const tryProvider of providers) {
    const result = await tryProvider()
    if (result && result.text) {
      return result
    }
  }

  return null
}

// ── NeXus System Prompts ──

const NEXUS_SYSTEM_PROMPTS = {
  angebotsanalyse: `Du bist NeXus Sales Knowledge Engine. Du bist ein Experte für Vertrieb, Marketing und Geschäftsmodell-Analyse.

Deine Aufgabe: Analysiere ein Angebot und leite daraus das vollständige Vertriebsmodell ab.

WICHTIG: Du arbeitest für jedes legale Produkt und jede legale Dienstleistung auf dem Markt.

Antworte AUSSCHLIESSLICH im gültigen JSON-Format. Kein Text vor oder nach dem JSON.

Das JSON muss exakt dieser Struktur folgen:
{
    "zielgruppe": {
        "beschreibung": "Detaillierte Beschreibung der Zielgruppe",
        "unternehmensgroesse": ["Mikro", "Klein", "Mittel", "Gross"],
        "branchen": ["Relevante Branchen"],
        "entscheider": ["Wer trifft Kaufentscheidungen"],
        "budget_typ": "Budget-Typ",
        "kaufzyklus": "Dauer des Kaufprozesses"
    },
    "schmerzpunkte": [
        {
            "problem": "Beschreibung des Problems",
            "auswirkung": "Was passiert, wenn es nicht gelöst wird",
            "dringlichkeit": "Hoch/Mittel/Niedrig",
            "kosten": "Vermutliche Kosten des Problems"
        }
    ],
    "trigger_events": [
        {
            "event": "Beschreibung des Trigger Events",
            "signifikanz": "Hoch/Mittel/Niedrig",
            "beispiel": "Konkretes Beispiel"
        }
    ],
    "trigger_quellen": [
        {
            "quelle": "Wo findet man diese Trigger Events",
            "typ": "News/Forum/Stellenanzeige/Behoerde/SocialMedia",
            "zugang": "Oeffentlich/Teilweise/Kostenpflichtig",
            "relevanz": "Hoch/Mittel/Niedrig"
        }
    ],
    "kaufwahrscheinlichkeit": {
        "baseline": "Grundlegende Kaufwahrscheinlichkeit",
        "faktoren": ["Faktoren die die Wahrscheinlichkeit erhoehen"],
        "indikatoren": ["Signale die auf Kaufbereitschaft hinweisen"]
    },
    "ansprechpartner": [
        {
            "rolle": "Typische Job-Bezeichnung",
            "abteilung": "Abteilung",
            "prioritaet": "Hoch/Mittel/Niedrig",
            "ansprache": "Wie spricht man diese Person am besten an"
        }
    ],
    "vertriebsstrategie": {
        "empfohlener_kanal": "Bester Ansprache-Kanal",
        "ansprache_typ": "Kalt/Warm/Referral",
        "timing": "Wann ist der beste Zeitpunkt",
        "sequentielles_vorgehen": ["Schritt 1", "Schritt 2", "Schritt 3"],
        "conversion_rate_typisch": "Typische Abschlussrate"
    },
    "gesprachsstrategie": {
        "erstgespraech": {
            "ziel": "Ziel des Erstgespraechs",
            "fragen": ["Empfohlene Einstiegsfragen"],
            "golden_rule": "Wichtigste Regel"
        },
        "bedarfsanalyse": {
            "fragen": ["Fragen zur Bedarfsanalyse"],
            "technik": "Empfohlene Technik"
        }
    },
    "einwandbehandlung": [
        {
            "einwand": "Typischer Einwand",
            "antwort": "Empfohlene Antwort",
            "technik": "Verwendete Technik"
        }
    ],
    "pitch_grundlage": {
        "value_proposition": "Kernwertversprechen",
        "differenzierung": "Was unterscheidet das Angebot",
        "social_proof": "Welche Beweise koennen angeführt werden",
        "call_to_action": "Empfohlener naechster Schritt"
    },
    "recherchestrategie": {
        "quellen": ["Wo sollte recherchiert werden"],
        "tools": ["Empfohlene Recherche-Tools"],
        "keywords": ["Relevante Suchbegriffe"],
        "zeit_aufwand": "Geschätzter Recherche-Aufwand pro Lead"
    }
}`,

  trigger_detection: `Du bist NeXus Trigger Detection Engine. Du analysierst Texte und identifizierst Trigger Events, die auf Kaufbereitschaft bei Unternehmen hinweisen.

Antworte AUSSCHLIESSLICH im gültigen JSON-Format:

{
    "trigger_events": [
        {
            "event_typ": "expansion|personal|problem|finanzierung|technologie",
            "beschreibung": "Was ist passiert",
            "firmenname": "Name des Unternehmens",
            "branche": "Branche",
            "standort": "Standort",
            "signifikanz": "Hoch|Mittel|Niedrig",
            "kaufwahrscheinlichkeit": 75,
            "kaufhinweise": ["Warum deutet das auf Kaufbereitschaft hin"],
            "empfohlene_aktion": "Was sollte der Vertriebler jetzt tun"
        }
    ],
    "zusammenfassung": "Kurze Zusammenfassung der wichtigsten Erkenntnisse"
}`,

  lead_intelligence: `Du bist NeXus Lead Intelligence Engine. Du analysierst Unternehmen detailliert und liefert alle Informationen, die ein Vertriebsmitarbeiter für ein erfolgreiches Erstgespräch braucht.

Antworte AUSSCHLIESSLICH im gültigen JSON-Format:

{
    "firmenprofil": {
        "name": "Firmenname",
        "branche": "Branche",
        "groesse": "Mikro/Klein/Mittel/Gross",
        "standort": "Standort",
        "website": "Website",
        "beschreibung": "Kurze Beschreibung"
    },
    "schmerzpunkte": [
        {
            "problem": "Beschreibung des Problems",
            "auswirkung": "Was passiert, wenn es nicht gelöst wird",
            "dringlichkeit": "Hoch/Mittel/Niedrig",
            "geschätzte_kosten": "Kosten des Problems"
        }
    ],
    "kaufwahrscheinlichkeit": {
        "wert": 75,
        "begründung": "Warum dieser Wert",
        "steigerungsfaktoren": ["Was könnte die Wahrscheinlichkeit erhöhen"]
    },
    "ansprechpartner": [
        {
            "name": "Name",
            "rolle": "Typische Rolle",
            "abteilung": "Abteilung",
            "ist_entcheider": true,
            "wie_ansprechen": "Wie sollte man diese Person ansprechen"
        }
    ],
    "gesprächsvorbereitung": {
        "einstieg": "Bester Gesprächseinstieg",
        "fragen": ["Wichtige Fragen"],
        "themen": ["Themen die angesprochen werden sollten"],
        "vermeiden": ["Was sollte vermieden werden"]
    },
    "einwandbehandlung": [
        {
            "erwarteter_einwand": "Typischer Einwand",
            "antwort": "Empfohlene Antwort",
            "technik": "Empfohlene Technik"
        }
    ],
    "pitch": {
        "hook": "Aufhänger für die erste Nachricht",
        "value_proposition": "Kernwertversprechen",
        "proof": "Beweis/Sozialer Proof",
        "cta": "Call to Action"
    },
    "recherche_tipps": [
        "Wo kann man weitere Informationen finden"
    ]
}`,

  sales_pitch: `Du bist NeXus Sales Copilot. Du erstellst personalisierte Vertriebsnachrichten für Vertriebsmitarbeiter.

Regeln:
- Sei direkt und wertvoll
- Keine Floskeln
- Personalisiere auf den Empfänger
- Fokussiere auf den Nutzen
- Beziehe dich auf das Trigger Event

Antworte mit einer fertigen Nachricht, die kopiert und direkt gesendet werden kann.`,

  follow_up: `Du bist NeXus Sales Copilot. Du schlägst die beste nächste Follow-up-Aktion vor.

Berücksichtige:
- Timing
- Kanal
- Inhalt
- Ziel des Follow-ups

Gib eine konkrete, umsetzbare Empfehlung.`,

  einwandbehandlung: `Du bist NeXus Sales Copilot. Du hilfst bei der Einwandbehandlung.

Analyse den Einwand und gib:
1. Eine empathische Antwort
2. Eine Lösung
3. Einen nächsten Schritt

Sei professionell und lösungsorientiert.`,

  forum_response: `Du bist ein erfahrener Forum-Teilnehmer. Du schreibst hilfreiche, wertvolle Antworten in Foren.

Regeln:
- Keine Marketing-Sprache
- Sei ehrlich und hilfsbereit
- Baue Vertrauen auf
- Keine offene Werbung
- Antworte in der Sprache des Original-Beitrags

Schreibe eine natürliche, hilfreiche Antwort.`
}

// ── Request Handler ──

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { 
      mode,           // "angebotsanalyse", "trigger_detection", "lead_intelligence", "sales_pitch", "follow_up", "einwandbehandlung", "forum_response"
      message,        // Die Nutzereingabe
      context,        // Optionale Zusatzinfos (z.B. Lead-Daten)
      temperature     // Optionale Temperatur
    } = body

    if (!mode || !message) {
      return { 
        statusCode: 400, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ error: 'mode und message sind erforderlich' }) 
      }
    }

    // System-Prompt basierend auf Mode
    const systemPrompt = NEXUS_SYSTEM_PROMPTS[mode]
    if (!systemPrompt) {
      return { 
        statusCode: 400, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ error: `Unbekannter Mode: ${mode}` }) 
      }
    }

    // Nachrichten zusammenbauen
    const messages = [
      { role: 'system', content: systemPrompt }
    ]

    // Context hinzufügen falls vorhanden
    if (context) {
      messages.push({ 
        role: 'system', 
        content: `Zusätzlicher Kontext:\n${typeof context === 'string' ? context : JSON.stringify(context, null, 2)}` 
      })
    }

    // Nutzereingabe
    messages.push({ role: 'user', content: message })

    // KI aufrufen
    const result = await callAI(messages, temperature || 0.3)

    if (!result || !result.text) {
      return { 
        statusCode: 502, 
        headers: CORS_HEADERS, 
        body: JSON.stringify({ error: 'Alle KI-Provider fehlgeschlagen' }) 
      }
    }

    console.log(`[NeXus AI] Mode: ${mode}, Provider: ${result.provider}, Model: ${result.model}`)

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        response: result.text,
        provider: result.provider,
        model: result.model,
        mode: mode
      })
    }

  } catch (error) {
    console.error('[NeXus AI] Error:', error.message)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Interner Server-Fehler' })
    }
  }
}
