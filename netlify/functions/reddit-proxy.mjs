// netlify/functions/reddit-proxy.mjs
// Proxies RSS feeds from Reddit to bypass CORS and User-Agent blocks

export default async function handler(request) {
  const path = request.url.split('/api/reddit-proxy/')[1]
  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 })
  }

  const targetUrl = `https://www.reddit.com/${path}`
  console.log('[reddit-proxy] Fetching:', targetUrl)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    })
    clearTimeout(timeout)

    console.log('[reddit-proxy] Response:', res.status, targetUrl)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Reddit returned ${res.status}` }), { status: res.status })
    }

    const xml = await res.text()
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (err) {
    console.error('[reddit-proxy] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 502 })
  }
}
