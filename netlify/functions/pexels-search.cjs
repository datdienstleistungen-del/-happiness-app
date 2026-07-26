exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { query, count = 5 } = JSON.parse(event.body)

    const apiKey = process.env.PEXELS_API_KEY

    if (!apiKey) {
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

    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&size=medium`,
      {
        headers: { 'Authorization': apiKey }
      }
    )

    if (!response.ok) {
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

    const data = await response.json()
    const videos = data.videos?.map(v => ({
      id: v.id,
      url: v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4')?.link
        || v.video_files?.[0]?.link,
      thumbnail: v.image,
      duration: v.duration,
      width: v.video_files?.find(f => f.quality === 'hd')?.width || 1920,
      height: v.video_files?.find(f => f.quality === 'hd')?.height || 1080
    })).filter(v => v.url) || []

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ videos, source: 'pexels' })
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
