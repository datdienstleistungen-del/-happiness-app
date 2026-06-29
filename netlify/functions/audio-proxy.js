exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {}

  const tracks = {
    epic: 'https://cdn.pixabay.com/audio/2022/10/14/audio_2af9e5748c.mp3',
    calm: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c38.mp3',
    piano: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    upbeat: 'https://cdn.pixabay.com/audio/2023/10/30/audio_3713e23867.mp3',
    ambient: 'https://cdn.pixabay.com/audio/2022/01/20/audio_d1718ab41b.mp3',
  }

  const url = tracks[id]
  if (!url) {
    return { statusCode: 404, body: 'Track not found' }
  }

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch audio')

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: base64,
      isBase64Encoded: true
    }
  } catch (error) {
    console.error('Audio proxy error:', error)
    return { statusCode: 500, body: 'Failed to load audio' }
  }
}
