const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

async function getBestMp4(identifier) {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}/files`)
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.result || []
    
    const mp4s = result
      .filter(f => f.name?.endsWith('.mp4') && f.format)
      .sort((a, b) => {
        const aRes = parseInt(a.name.match(/(\d+)p/)?.[1] || '0')
        const bRes = parseInt(b.name.match(/(\d+)p/)?.[1] || '0')
        return bRes - aRes
      })
    
    return mp4s[0]?.name || null
  } catch {
    return null
  }
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

  const { query, count = 12 } = body

  if (!query || !query.trim()) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'query ist erforderlich' }) }
  }

  try {
    const searchQuery = `(${query}) AND mediatype:movies AND (licenseurl:*publicdomain* OR licenseurl:*creativecommons*)`
    const fields = ['identifier', 'title', 'description', 'item_size', 'avg_rating', 'date']
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}&fl[]=${fields.join('&fl[]=')}&output=json&rows=${count}&sort[]=downloads+desc`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Archive API returned ${res.status}`)

    const data = await res.json()
    const docs = data.response?.docs || []

    const videos = await Promise.all(docs.map(async (doc) => {
      const bestMp4 = await getBestMp4(doc.identifier)
      const directVideoUrl = bestMp4 ? `https://archive.org/download/${doc.identifier}/${bestMp4}` : null
      
      return {
        id: doc.identifier,
        title: doc.title || doc.identifier,
        description: doc.description || '',
        url: directVideoUrl || `https://archive.org/details/${doc.identifier}`,
        downloadUrl: directVideoUrl || `https://archive.org/download/${doc.identifier}`,
        detailsUrl: `https://archive.org/details/${doc.identifier}`,
        date: doc.date || '',
        rating: doc.avg_rating || 0,
        source: 'archive',
        hasVideo: !!directVideoUrl
      }
    }))

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ videos, total: data.response?.numFound || 0 })
    }
  } catch (e) {
    console.error('[archive-search] Error:', e.message)
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internet Archive Suche fehlgeschlagen: ' + e.message })
    }
  }
}
