// netlify/functions/rss-proxy.mjs
// Universal proxy for B2B RSS feeds (Google News, Upwork, Reddit) to bypass CORS

export default async function handler(request) {
  const urlParams = new URL(request.url).searchParams
  const targetUrl = urlParams.get('url')

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400 })
  }

  console.log('[rss-proxy] Fetching:', targetUrl)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s for Netlify free tier

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*;q=0.9',
      }
    })
    clearTimeout(timeout)

    console.log('[rss-proxy] Status:', res.status, 'for', targetUrl)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn('[rss-proxy] Remote error:', res.status, body.substring(0, 200))
      return new Response(JSON.stringify({ error: `Remote ${res.status}`, detail: body.substring(0, 500) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const xml = await res.text()

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      }
    })
  } catch (err) {
    console.error('[rss-proxy] Fetch failed:', err.message, 'for', targetUrl)
    return new Response(JSON.stringify({ error: err.message, url: targetUrl }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
