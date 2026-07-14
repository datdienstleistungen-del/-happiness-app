// netlify/functions/reddit-proxy.mjs
// Proxies RSS feeds from Reddit — 8s timeout for Netlify Free Tier

export default async function handler(request) {
  const url = new URL(request.url)
  const path = url.pathname.split('/api/reddit-proxy/')[1]

  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400 })
  }

  const targetUrl = `https://www.reddit.com/${path}`
  console.log('[reddit-proxy] Fetching:', targetUrl)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    })
    clearTimeout(timeout)

    console.log('[reddit-proxy] Status:', res.status, 'for', targetUrl)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[reddit-proxy] Reddit error:', res.status, body.substring(0, 200))
      return new Response(JSON.stringify({ error: `Reddit ${res.status}`, detail: body.substring(0, 500) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const xml = await res.text()
    console.log('[reddit-proxy] OK:', xml.length, 'bytes for', targetUrl)

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      }
    })
  } catch (err) {
    console.error('[reddit-proxy] Fetch failed:', err.message, 'for', targetUrl)
    return new Response(JSON.stringify({ error: err.message, url: targetUrl }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
