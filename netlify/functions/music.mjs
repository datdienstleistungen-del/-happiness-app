const MUSIC_MAP = {
  motivation: [
    { name: 'Inspiring Cinematic', url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_2af2a09828.mp3', duration: 120 },
    { name: 'Upbeat Corporate', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c3a.mp3', duration: 90 },
    { name: 'Motivational Pop', url: 'https://cdn.pixabay.com/audio/2023/03/14/audio_2e3a2e2b90.mp3', duration: 100 }
  ],
  calm: [
    { name: 'Peaceful Piano', url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_2dae668d83.mp3', duration: 150 },
    { name: 'Ambient Nature', url: 'https://cdn.pixabay.com/audio/2023/07/31/audio_c2e2e74a6c.mp3', duration: 180 }
  ],
  upbeat: [
    { name: 'Happy Ukulele', url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_b1b94da596.mp3', duration: 80 },
    { name: 'Funky Beat', url: 'https://cdn.pixabay.com/audio/2023/03/21/audio_7a08573094.mp3', duration: 95 }
  ],
  dramatic: [
    { name: 'Epic Cinematic', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_38e7be59db.mp3', duration: 130 },
    { name: 'Tension Build', url: 'https://cdn.pixabay.com/audio/2023/05/15/audio_08a858e5ed.mp3', duration: 110 }
  ]
}

function pickMood(text) {
  const lower = text.toLowerCase()
  if (lower.includes('motiv') || lower.includes('ziel') || lower.includes('erfolg') || lower.includes('stark')) return 'motivation'
  if (lower.includes('ruh') || lower.includes('medit') || lower.includes('entspann') || lower.includes('yoga')) return 'calm'
  if (lower.includes('feier') || lower.includes('party') || lower.includes('glück') || lower.includes('freude')) return 'upbeat'
  if (lower.includes('kampf') || lower.includes('challenge') || lower.includes('überwinde')) return 'dramatic'
  return 'motivation'
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { text, mood } = JSON.parse(event.body || '{}')
    const selectedMood = mood || pickMood(text || '')
    const tracks = MUSIC_MAP[selectedMood] || MUSIC_MAP.motivation
    const track = tracks[Math.floor(Math.random() * tracks.length)]

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: track.url, name: track.name, mood: selectedMood, duration: track.duration })
    }
  } catch (error) {
    console.error('[MUSIC] Error:', error.message)
    const fallback = MUSIC_MAP.motivation[0]
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fallback.url, name: fallback.name, mood: 'motivation', duration: fallback.duration })
    }
  }
}
