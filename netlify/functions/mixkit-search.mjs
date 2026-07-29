const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body = {}
  try { body = JSON.parse(event.body || '{}') } catch { body = {} }

  const { query, count = 12, vertical = false } = body

  if (!query || !query.trim()) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'query ist erforderlich' }) }
  }

  try {
    let searchUrl = `https://api.mixkit.co/api/v1/videos?query=${encodeURIComponent(query)}&limit=${count}`

    const res = await fetch(searchUrl)
    if (!res.ok) throw new Error(`Mixkit API returned ${res.status}`)

    const data = await res.json()
    let items = data.entries || data || []

    // Filter for vertical (9:16) if requested
    if (vertical) {
      items = items.filter(item => {
        const w = item.width || 0
        const h = item.height || 0
        return h > w // portrait orientation
      })
    }

    const videos = items.slice(0, count).map(item => ({
      id: item.id,
      title: item.title || 'Untitled',
      description: item.description || '',
      url: item.video_files?.[0]?.link || item.url || '',
      thumbnail: item.image || item.screenshot || '',
      width: item.width || 0,
      height: item.height || 0,
      duration: item.duration || 0,
      tags: item.tags || [],
      source: 'mixkit',
      isVertical: (item.height || 0) > (item.width || 0)
    }))

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ videos, total: items.length })
    }
  } catch (e) {
    console.error('[mixkit-search] Error:', e.message)
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Mixkit Suche fehlgeschlagen: ' + e.message })
    }
  }
}
