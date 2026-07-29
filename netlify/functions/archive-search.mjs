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

  const { query, count = 12 } = body

  if (!query || !query.trim()) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'query ist erforderlich' }) }
  }

  try {
    const searchQuery = `${query} mediatype:movies`
    const fields = ['identifier', 'title', 'description', 'item_size', 'avg_rating', 'date']
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchQuery)}&fl[]=${fields.join('&fl[]=')}&output=json&rows=${count}&sort[]=downloads+desc`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Archive API returned ${res.status}`)

    const data = await res.json()
    const docs = data.response?.docs || []

    const videos = docs.map(doc => ({
      id: doc.identifier,
      title: doc.title || doc.identifier,
      description: doc.description || '',
      url: `https://archive.org/details/${doc.identifier}`,
      downloadUrl: `https://archive.org/download/${doc.identifier}`,
      date: doc.date || '',
      rating: doc.avg_rating || 0,
      source: 'archive'
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
