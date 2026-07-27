exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { query, count = 5 } = JSON.parse(event.body)

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
          videos: getDefaultVideos(query),
          source: 'demo'
        })
      }
    }

    let pexelsVideos = []
    let pixabayVideos = []

    // 1. Fetch from Pexels if key exists
    if (pexelsKey) {
      try {
        const response = await fetch(
          `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&size=medium&locale=de-DE`,
          {
            headers: { 'Authorization': pexelsKey }
          }
        )

        if (response.ok) {
          const data = await response.json()
          pexelsVideos = data.videos?.map(v => ({
            id: `pexels-${v.id}`,
            url: v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')?.link
              || v.video_files?.[0]?.link,
            thumbnail: v.image,
            duration: v.duration,
            width: v.video_files?.find(f => f.quality === 'hd')?.width || 1920,
            height: v.video_files?.find(f => f.quality === 'hd')?.height || 1080,
            source: 'pexels'
          })).filter(v => v.url) || []
        }
      } catch (err) {
        console.error('Pexels API error:', err.message)
      }
    }

    // 2. Fetch from Pixabay if key exists
    if (pixabayKey) {
      try {
        const response = await fetch(
          `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(query)}&per_page=${count}&lang=de`
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

    if (combinedVideos.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          videos: getDefaultVideos(query),
          source: 'demo'
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
      body: JSON.stringify({ videos: combinedVideos, source: pexelsKey ? 'pexels-pixabay' : 'pixabay' })
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
        videos: getDefaultVideos('nature'),
        source: 'demo'
      })
    }
  }
}

function getDefaultVideos(query) {
  const videoMap = {
    prank: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/dog.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/dog.jpg', duration: 13, width: 540, height: 960 },
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/elephants.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/elephants.jpg', duration: 52, width: 540, height: 960 }
    ],
    fussball: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/finish_line.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/finish_line.jpg', duration: 5, width: 540, height: 960 }
    ],
    comedy: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/dog.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/dog.jpg', duration: 13, width: 540, height: 960 }
    ],
    motivation: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/mountains.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/mountains.jpg', duration: 9, width: 540, height: 960 }
    ],
    nature: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/mountains.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/mountains.jpg', duration: 9, width: 540, height: 960 }
    ],
    dankbarkeit: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/elephants.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/elephants.jpg', duration: 52, width: 540, height: 960 }
    ],
    meditation: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/mountains.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/mountains.jpg', duration: 9, width: 540, height: 960 }
    ],
    wellness: [
      { url: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_540,h_960/dog.mp4', thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,g_auto,w_180,h_320,so_0/dog.jpg', duration: 13, width: 540, height: 960 }
    ]
  }

  const lowerQuery = query?.toLowerCase() || ''
  if (lowerQuery.includes('prank')) return videoMap.prank
  if (lowerQuery.includes('fussball') || lowerQuery.includes('fußball') || lowerQuery.includes('soccer') || lowerQuery.includes('football')) return videoMap.fussball
  if (lowerQuery.includes('comedy') || lowerQuery.includes('funny') || lowerQuery.includes('lustig') || lowerQuery.includes('kurios') || lowerQuery.includes('lachen')) return videoMap.comedy
  
  for (const [key, videos] of Object.entries(videoMap)) {
    if (lowerQuery.includes(key)) return videos
  }

  return videoMap.motivation
}
