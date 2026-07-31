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
    const searchUrl = `https://mixkit.co/free-stock-video/${encodeURIComponent(query.toLowerCase().trim())}/`
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!res.ok) throw new Error(`Mixkit Web returned status ${res.status}`)

    const html = await res.text()
    const blocks = html.split('<video ').slice(1)
    const videos = []
    const preflightChecks = []

    for (const block of blocks) {
      if (videos.length >= count) break

      const srcMatch = block.match(/src="([^"]+)"/)
      const videoSrc = srcMatch ? srcMatch[1] : null
      if (!videoSrc) continue

      const idMatch = videoSrc.match(/\/videos\/(\d+)\//)
      const id = idMatch ? idMatch[1] : null
      if (!id) continue

      const titleMatch = block.match(/title="([^"]+)"/) || block.match(/alt="([^"]+)"/)
      let title = titleMatch ? titleMatch[1] : null
      if (!title) {
        const textMatch = block.match(/class="[^"]*item-grid-card__title[^"]*"[^>]*>([\s\S]*?)<\/a>/) ||
                           block.match(/class="[^"]*item-grid-card__header[^"]*"[^>]*>([\s\S]*?)<\/a>/)
        title = textMatch ? textMatch[1].trim() : `Mixkit Video ${id}`
      }

      const hrefMatch = block.match(/href="(\/free-stock-video\/[a-zA-Z0-9_-]+\/)"/)
      const detailsUrl = hrefMatch ? `https://mixkit.co${hrefMatch[1]}` : `https://mixkit.co/free-stock-video/`

      const highQualityUrl = `https://assets.mixkit.co/videos/${id}/${id}-1080.mp4`
      const thumbnail = `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`

      // Filter vertical if vertical is requested
      const isVertical = videoSrc.includes('vertical') || false
      if (vertical && !isVertical) continue

      const videoData = {
        id,
        title,
        description: '',
        url: highQualityUrl,
        previewUrl: videoSrc,
        thumbnail,
        detailsUrl,
        source: 'mixkit',
        isVertical
      }
      videos.push(videoData)

      preflightChecks.push((async () => {
        try {
          const headRes = await fetch(highQualityUrl, { method: 'HEAD' })
          if (!headRes.ok) {
            videoData.url = videoSrc
          }
        } catch {
          videoData.url = videoSrc
        }
      })())
    }

    await Promise.all(preflightChecks)

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ videos, total: videos.length })
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
