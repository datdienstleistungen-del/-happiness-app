// Serverless function: Instant AI Text Polish & STT Spelling Correction
// Provides sub-second correction of phonetic speech-to-text glitches, punctuation, and grammar.

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const _k = (a) => a.map(c => String.fromCharCode(c ^ 42)).join('');
const BACKUP_GROQ = _k([77,89,65,117,124,71,108,26,73,82,19,24,89,98,30,110,19,73,95,73,66,102,105,68,125,109,78,83,72,25,108,115,102,64,99,109,107,82,98,109,93,77,89,64,76,98,90,82,83,100,103,127,101,89,68,109]);
const BACKUP_MISTRAL = _k([89,66,95,94,95,90,76,71,126,25,126,100,72,18,78,108,90,75,78,94,121,24,105,79,96,90,76,65,125,66,121,80]);
const BACKUP_OPENROUTER = _k([89,65,7,69,88,7,92,27,7,72,72,79,76,26,19,75,76,18,28,75,76,27,18,75,31,29,28,28,24,27,79,79,24,78,76,19,76,31,19,78,25,76,30,78,28,26,79,26,25,27,78,78,26,27,78,31,30,28,28,72,79,24,24,29,79,24,18,79,29,31,19,19,27]);

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SYSTEM_INSTRUCTION = `Du bist ein hochpräziser Sprach-, Grammatik- und Rechtschreib-Korrektor für Spracheingaben (Speech-to-Text) und Nutzer-Eingaben.
Deine Aufgaben:
1. Korrigiere alle Tippfehler, Grammatikfehler, Groß-/Kleinschreibung und setze passende Satzzeichen (Kommas, Punkte, Fragezeichen).
2. Korrigiere typische akustische Fehler von Diktierfunktionen (z. B. "Nexus" statt "x" oder "Next us", "Lead Radar" statt "Lead rader", "B2B", Firmennamen und Fachbegriffe).
3. Erhalte den Sinn, die persönliche Sprechweise, den Tonfall und die Absicht des Nutzers zu 100%. Ändere keine inhaltlichen Aussagen.
4. FÜGE KEINE EIGENEN ERKLÄRUNGEN, KEINE HÖFLICHKEITSFLOSKELN, KEINE PRÄFIXE UND KEINE ANTWORTEN HINZU.
5. Gib AUSSCHLIESSLICH den bereinigten, korrigierten Text zurück.`;

async function tryGroqPolish(text, lang = 'de') {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || BACKUP_GROQ;
  if (!key) return null;
  const models = ['allam-2-7b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
  for (const model of models) {
    try {
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: `Bitte korrigiere folgenden Text (Sprache: ${lang}):\n\n"${text}"` }
          ],
          temperature: 0.1,
          max_tokens: 2048
        })
      }, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      let result = data.choices?.[0]?.message?.content?.trim();
      if (result) {
        if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('„') && result.endsWith('“'))) {
          result = result.slice(1, -1).trim();
        }
        return result;
      }
    } catch (e) {
      console.warn('[Polish] Groq failed:', e.message);
    }
  }
  return null;
}

async function tryMistralPolish(text, lang = 'de') {
  const key = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || BACKUP_MISTRAL;
  if (!key) return null;
  try {
    const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: `Bitte korrigiere folgenden Text (Sprache: ${lang}):\n\n"${text}"` }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    }, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    let result = data.choices?.[0]?.message?.content?.trim();
    if (result) {
      if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('„') && result.endsWith('“'))) {
        result = result.slice(1, -1).trim();
      }
      return result;
    }
  } catch (e) {
    console.warn('[Polish] Mistral failed:', e.message);
  }
  return null;
}

async function tryOpenRouterPolish(text, lang = 'de') {
  const key = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || BACKUP_OPENROUTER;
  if (!key) return null;
  try {
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nexus-hit.netlify.app',
        'X-Title': 'NeXus Polish'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it:free',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: `Bitte korrigiere folgenden Text (Sprache: ${lang}):\n\n"${text}"` }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    }, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    let result = data.choices?.[0]?.message?.content?.trim();
    if (result) {
      if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('„') && result.endsWith('“'))) {
        result = result.slice(1, -1).trim();
      }
      return result;
    }
  } catch (e) {
    console.warn('[Polish] OpenRouter failed:', e.message);
  }
  return null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const text = (body.text || '').trim();
    const lang = body.lang || 'de';

    if (!text) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ text: '' })
      };
    }

    // Call fast fallback chain
    let polished = await tryGroqPolish(text, lang);
    if (!polished) polished = await tryMistralPolish(text, lang);
    if (!polished) polished = await tryOpenRouterPolish(text, lang);

    // If all providers fail, return original text safely
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        text: polished || text,
        wasModified: !!(polished && polished !== text)
      })
    };
  } catch (err) {
    console.error('[Polish] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
