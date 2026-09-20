const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;

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

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

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

  // 1. Try Groq (Ultra fast: 0.1s response time, 100% active models)
  if (!recipeData && GROQ_API_KEY) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
    for (const m of groqModels) {
      try {
        console.log(`[CAPCUT-RECIPE] Trying Groq model ${m}...`);
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: fullPrompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
        }, 8000);

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          recipeData = cleanJson(text);
          if (recipeData) {
            console.log(`[CAPCUT-RECIPE] Success with Groq ${m}`);
            break;
          }
        } else {
          console.warn(`[CAPCUT-RECIPE] Groq ${m} status: ${res.status}`);
        }
      } catch (e) {
        console.warn(`[CAPCUT-RECIPE] Groq ${m} error: ${e.message}`);
      }
    }
  }

  // 2. Try DeepSeek (Fallback)
  if (!recipeData && DEEPSEEK_API_KEY) {
    try {
      console.log('[CAPCUT-RECIPE] Trying DeepSeek...');
      const res = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are an elite video copywriter. Output valid JSON only.' },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      }, 10000);

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        recipeData = cleanJson(text);
        if (recipeData) console.log('[CAPCUT-RECIPE] Success with DeepSeek');
      }
    } catch (e) {
      console.warn('[CAPCUT-RECIPE] DeepSeek error:', e.message);
    }
  }

  // 3. Try Mistral (Fallback)
  if (!recipeData && MISTRAL_API_KEY) {
    try {
      console.log('[CAPCUT-RECIPE] Trying Mistral...');
      const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: 'You are an elite video copywriter. Output valid JSON only.' },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      }, 10000);

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        recipeData = cleanJson(text);
        if (recipeData) console.log('[CAPCUT-RECIPE] Success with Mistral');
      }
    } catch (e) {
      console.warn('[CAPCUT-RECIPE] Mistral error:', e.message);
    }
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
