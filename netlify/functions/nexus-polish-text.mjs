// Serverless function: Instant AI Text Polish & STT Spelling Correction
// Provides sub-second correction of phonetic speech-to-text glitches, punctuation, and grammar.

import { callLLM } from './_shared/llm-core.mjs';

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

async function polishText(text, lang = 'de') {
  // Schnelle Kette Groq -> Mistral -> OpenRouter via _shared/llm-core.mjs.
  // Rueckfall: null, wenn alle Provider versagen (Handler gibt Originaltext zurueck).
  try {
    const { text: out } = await callLLM([
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: `Bitte korrigiere folgenden Text (Sprache: ${lang}):\n\n"${text}"` }
    ], {
      providers: ['groq', 'mistral', 'openrouter'],
      temperature: 0.1,
      max_tokens: 2048,
      totalBudgetMs: 12000,
      xTitle: 'NeXus Polish',
    });
    let result = (out || '').trim();
    if (!result) return null;
    if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('„') && result.endsWith('“'))) {
      result = result.slice(1, -1).trim();
    }
    return result || null;
  } catch (e) {
    console.warn('[Polish] chain failed:', e.message);
    return null;
  }
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
    const polished = await polishText(text, lang);

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
