exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { query, count = 5 } = JSON.parse(event.body)

    const pexelsKey = process.env.PEXELS_API_KEY

    if (pexelsKey) {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        { headers: { Authorization: pexelsKey } }
      )
      if (response.ok) {
        const data = await response.json()
        const images = data.photos?.map(p => ({
          url: p.src.large2x || p.src.large || p.src.medium,
          thumb: p.src.medium,
          width: p.width,
          height: p.height,
          alt: p.alt || query
        })) || []
        if (images.length > 0) {
          return ok({ images, source: 'pexels' })
        }
      }
    }

    return ok({ images: getDefaultImages(query), source: 'demo' })
  } catch (error) {
    console.error('Image search error:', error)
    return ok({ images: getDefaultImages('nature'), source: 'demo' })
  }
}

function ok(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  }
}

function getDefaultImages(query) {
  const categories = {
    motivation: [
      { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80', alt: 'Berge' },
      { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop&q=80', alt: 'Sonne' },
      { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop&q=80', alt: 'See' },
      { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop&q=80', alt: 'Wald' },
      { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&q=80', alt: 'Licht' },
    ],
    fitness: [
      { url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&h=1080&fit=crop&q=80', alt: 'Gym' },
      { url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1920&h=1080&fit=crop&q=80', alt: 'Training' },
      { url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1920&h=1080&fit=crop&q=80', alt: 'Laufen' },
      { url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1920&h=1080&fit=crop&q=80', alt: 'Kraft' },
      { url: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&h=1080&fit=crop&q=80', alt: 'Yoga' },
    ],
    wellness: [
      { url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&h=1080&fit=crop&q=80', alt: 'Meditation' },
      { url: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=1920&h=1080&fit=crop&q=80', alt: 'Yoga' },
      { url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1920&h=1080&fit=crop&q=80', alt: 'Entspannung' },
      { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&q=80', alt: 'Strand' },
      { url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1920&h=1080&fit=crop&q=80', alt: 'Natur' },
    ],
    dankbarkeit: [
      { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop&q=80', alt: 'Natur' },
      { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop&q=80', alt: 'Wald' },
      { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&h=1080&fit=crop&q=80', alt: 'See' },
      { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&q=80', alt: 'Licht' },
      { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop&q=80', alt: 'Berge' },
    ],
    liebe: [
      { url: 'https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?w=1920&h=1080&fit=crop&q=80', alt: 'Sonnenuntergang' },
      { url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1920&h=1080&fit=crop&q=80', alt: 'Zusammen' },
      { url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1920&h=1080&fit=crop&q=80', alt: 'Herzen' },
      { url: 'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=1920&h=1080&fit=crop&q=80', alt: 'Kerzen' },
      { url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1920&h=1080&fit=crop&q=80', alt: 'Blumen' },
    ],
  }

  const key = query?.toLowerCase() || 'motivation'
  for (const [k, imgs] of Object.entries(categories)) {
    if (key.includes(k)) return imgs
  }
  return categories.motivation
}
