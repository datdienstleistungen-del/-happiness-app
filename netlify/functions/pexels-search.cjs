exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { query, count = 12 } = JSON.parse(event.body)

    const pexelsKey = process.env.PEXELS_API_KEY
    const pixabayKey = process.env.PIXABAY_API_KEY

    if (!pexelsKey && !pixabayKey) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          videos: [],
          source: 'none',
          error: 'Keine Video-API konfiguriert'
        })
      }
    }

    // Expand query: add vertical/portrait keywords for TikTok-relevant results
    const expandedQuery = `${query} portrait vertical`

    let pexelsVideos = []
    let pixabayVideos = []

    // 1. Fetch from Pexels if key exists
    if (pexelsKey) {
      try {
        // Search with orientation=portrait for vertical videos
        const response = await fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&size=medium&locale=de-DE&orientation=portrait`,
          {
            headers: { 'Authorization': pexelsKey }
          }
        )

        if (response.ok) {
          const data = await response.json()
          pexelsVideos = data.videos?.map(v => ({
            id: `pexels-${v.id}`,
            url: v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')?.link
              || v.video_files?.find(f => f.file_type === 'video/mp4')?.link
              || v.video_files?.[0]?.link,
            thumbnail: v.image,
            duration: v.duration,
            width: v.video_files?.find(f => f.quality === 'hd')?.width || v.video_files?.[0]?.width || 1080,
            height: v.video_files?.find(f => f.quality === 'hd')?.height || v.video_files?.[0]?.height || 1920,
            source: 'pexels'
          })).filter(v => v.url) || []
        }

        // If not enough portrait results, also search landscape
        if (pexelsVideos.length < count) {
          const responseLandscape = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&size=medium&locale=de-DE`,
            {
              headers: { 'Authorization': pexelsKey }
            }
          )

          if (responseLandscape.ok) {
            const dataLandscape = await responseLandscape.json()
            const landscapeVideos = dataLandscape.videos?.map(v => ({
              id: `pexels-${v.id}`,
              url: v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')?.link
                || v.video_files?.find(f => f.file_type === 'video/mp4')?.link
                || v.video_files?.[0]?.link,
              thumbnail: v.image,
              duration: v.duration,
              width: v.video_files?.find(f => f.quality === 'hd')?.width || v.video_files?.[0]?.width || 1920,
              height: v.video_files?.find(f => f.quality === 'hd')?.height || v.video_files?.[0]?.height || 1080,
              source: 'pexels'
            })).filter(v => v.url) || []

            // Merge, avoid duplicates
            const existingIds = new Set(pexelsVideos.map(v => v.id))
            for (const v of landscapeVideos) {
              if (!existingIds.has(v.id)) {
                pexelsVideos.push(v)
                existingIds.add(v.id)
              }
            }
          }
        }
      } catch (err) {
        console.error('Pexels API error:', err.message)
      }
    }

    // 2. Fetch from Pixabay if key exists
    if (pixabayKey) {
      try {
        const response = await fetch(
          `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=${count}&lang=de&video_type=all`
        )

        if (response.ok) {
          const data = await response.json()
          pixabayVideos = data.hits?.map(h => {
            const files = h.videos || {}
            const videoObj = files.medium || files.small || files.large || files.tiny
            return {
              id: `pixabay-${h.id}`,
              url: videoObj?.url,
              thumbnail: h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : '',
              duration: h.duration,
              width: videoObj?.width || 1280,
              height: videoObj?.height || 720,
              source: 'pixabay'
            }
          }).filter(v => v.url) || []
        }
      } catch (err) {
        console.error('Pixabay API error:', err.message)
      }
    }

    const combinedVideos = [...pexelsVideos, ...pixabayVideos]

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        videos: combinedVideos,
        source: pexelsKey ? 'pexels-pixabay' : 'pixabay',
        total: combinedVideos.length
      })
    }

  } catch (error) {
    console.error('Pexels search error:', error)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        videos: [],
        source: 'error',
        error: 'Suche fehlgeschlagen'
      })
    }
  }
}
