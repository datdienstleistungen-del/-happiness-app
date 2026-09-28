import { callLLM } from './_shared/llm-core.mjs';

const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SYSTEM_PROMPT = `Du bist ein preisgekrönter Senior Copywriter und Content-Strategist, spezialisiert auf B2B-Sales-Videos, Kurzvideos (TikTok, Reels, Shorts) und visuelle Video-Pitches. Erstelle ein hochgradig konvertierendes, emotionales und maßgeschneidertes "Rezept" (Videoskript oder Caption).

STRUKTUR- UND STILVORGABEN FÜR DIE ZIELGRUPPE:
1. PSYCHOLOGISCHER STRUKTUR-AUFBAU (PAS-Modell): Problem → Agitation → Solution
2. FORMALER REZEPT-AUFBAU:
   - Hook & Visual (erste 3 Sekunden)
   - Body & Storyline (kurze, rhythmische Sätze, extrem scannbar)
   - Call to Action (CTA)

Output: NUR valides JSON (kein Markdown, kein Text davor/danach).

JSON-Struktur:
{
  "video_title": "Kurzprägnanter Titel",
  "voiceover_script": "Kompletter Voiceover-Text am Stück zum Kopieren für TTS. PAS-Modell: Problem → Agitation → Solution.",
  "scenes": [
    {
      "timestamp": "00:00 - 00:03",
      "spoken_text": "Text der in dieser Szene gesprochen wird",
      "visual_prompt": "Detaillierter Prompt für KI-Bildgenerierung/Szene, cinematic shot, photorealistic, 4k, --ar 9:16"
    }
  ],
  "publishing_payload": {
    "tiktok_instagram": {
      "hook": "Extrem starke Hookline mit Emoji (max 1 Zeile)",
      "description": "PAS-Struktur mit Hashtags."
    },
    "linkedin_facebook": {
      "headline": "Professionelle Hook-Zeile",
      "body_text": "Wertgetriebener, strukturierter Beitragstext für Business-Netzwerke."
    },
    "youtube_shorts": {
      "title": "Catchy YouTube-Titel (max 60 Zeichen)",
      "description": "Kurze Beschreibung mit relevanten Keywords und #Shorts"
    },
    "reddit": {
      "title": "Subreddit-freundlicher Titel",
      "body_text": "Ehrlich, nicht werblich. Community-first."
    }
  },
  "hook_check_notes": [],
  "hook_check_suggestions": []
}`;

function cleanJson(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {}
    }
    return null;
  }
}

export async function handler(event) {
  console.log('[CAPCUT-RECIPE] Function called, method:', event.httpMethod);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { 
      statusCode: 400, 
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Ungueltige Daten' }) 
    };
  }

  const { topic, duration } = body;

  if (!topic || topic.trim().length < 3) {
    return { 
      statusCode: 400, 
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Thema ist zu kurz (min. 3 Zeichen)' }) 
    };
  }

  const validDurations = [15, 30, 45, 60];
  const videoDuration = validDurations.includes(duration) ? duration : 30;

  const fullPrompt = `${SYSTEM_PROMPT}\n\nAUFGABE: Erstelle ein ${videoDuration}-Sekunden Video-Rezept für folgendes Thema:\n"${topic.trim()}"\n\nAntworte NUR mit dem geforderten JSON-Objekt.`;

  let recipeData = null;

  // Kette Groq -> DeepSeek -> Mistral via _shared/llm-core.mjs; acceptText
  // faehrt wie bisher zum naechsten Provider, wenn das JSON unbrauchbar ist.
  try {
    console.log('[CAPCUT-RECIPE] Trying LLM chain (groq -> deepseek -> mistral)...');
    const { text, provider } = await callLLM([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: fullPrompt }
    ], {
      providers: ['groq', 'deepseek', 'mistral'],
      temperature: 0.7,
      jsonMode: true,
      acceptText: (t) => Boolean(cleanJson(t)),
      totalBudgetMs: 20000,
    });
    recipeData = cleanJson(text);
    if (recipeData) console.log(`[CAPCUT-RECIPE] Success with ${provider}`);
  } catch (e) {
    console.warn('[CAPCUT-RECIPE] LLM chain error:', e.message);
  }

  if (!recipeData) {
    return { 
      statusCode: 503, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
      body: JSON.stringify({ error: 'Die KI-Dienste sind aktuell stark ausgelastet. Bitte versuche es in wenigen Sekunden erneut.' }) 
    };
  }

  // Normalize recipe structure
  if (!recipeData.video_title) recipeData.video_title = topic.substring(0, 40);
  if (!recipeData.voiceover_script) recipeData.voiceover_script = topic;
  if (!Array.isArray(recipeData.scenes) || recipeData.scenes.length === 0) {
    recipeData.scenes = [
      {
        timestamp: '00:00 - 00:05',
        spoken_text: recipeData.voiceover_script,
        visual_prompt: 'cinematic B2B office scene, photorealistic, 4k, --ar 9:16'
      }
    ];
  }

  recipeData.scenes = recipeData.scenes.map((s, i) => ({
    timestamp: s.timestamp || `00:${String(i * 3).padStart(2, '0')} - 00:${String((i + 1) * 3).padStart(2, '0')}`,
    spoken_text: s.spoken_text || '',
    visual_prompt: s.visual_prompt || 'cinematic shot, modern office, photorealistic, 4k, --ar 9:16'
  }));

  if (!recipeData.publishing_payload) {
    recipeData.publishing_payload = {
      tiktok_instagram: {
        hook: recipeData.scenes[0]?.spoken_text || recipeData.video_title,
        description: `${recipeData.video_title}\n\n#nexus #sales #b2b #growth`
      },
      linkedin_facebook: {
        headline: recipeData.video_title,
        body_text: recipeData.voiceover_script
      },
      youtube_shorts: {
        title: recipeData.video_title.substring(0, 60),
        description: `${recipeData.video_title} #Shorts`
      },
      reddit: {
        title: recipeData.video_title,
        body_text: recipeData.voiceover_script
      }
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(recipeData)
  };
}
