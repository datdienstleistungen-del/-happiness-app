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
    motivation: [
      { url: 'https://cdn.pixabay.com/video/2024/01/19/197387-905037703_large.mp4', thumbnail: '', duration: 15, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2023/11/14/189139-893868591_large.mp4', thumbnail: '', duration: 12, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2020/07/30/45788-444930032_large.mp4', thumbnail: '', duration: 18, width: 1920, height: 1080 }
    ],
    nature: [
      { url: 'https://cdn.pixabay.com/video/2024/02/20/201560-914568892_large.mp4', thumbnail: '', duration: 20, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2023/09/14/180771-864159450_large.mp4', thumbnail: '', duration: 15, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2021/08/20/85615-590008498_large.mp4', thumbnail: '', duration: 10, width: 1920, height: 1080 }
    ],
    dankbarkeit: [
      { url: 'https://cdn.pixabay.com/video/2022/08/18/124174-740902698_large.mp4', thumbnail: '', duration: 16, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2021/11/22/96133-648037089_large.mp4', thumbnail: '', duration: 14, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2020/05/25/40130-424930959_large.mp4', thumbnail: '', duration: 12, width: 1920, height: 1080 }
    ],
    meditation: [
      { url: 'https://cdn.pixabay.com/video/2021/04/22/72192-541029498_large.mp4', thumbnail: '', duration: 20, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2020/08/09/46761-449928498_large.mp4', thumbnail: '', duration: 15, width: 1920, height: 1080 }
    ],
    wellness: [
      { url: 'https://cdn.pixabay.com/video/2021/02/20/65515-514573652_large.mp4', thumbnail: '', duration: 18, width: 1920, height: 1080 },
      { url: 'https://cdn.pixabay.com/video/2020/06/01/40691-428644498_large.mp4', thumbnail: '', duration: 12, width: 1920, height: 1080 }
    ]
  }

  const lowerQuery = query?.toLowerCase() || ''
  for (const [key, videos] of Object.entries(videoMap)) {
    if (lowerQuery.includes(key)) return videos
  }

  return videoMap.motivation
}
