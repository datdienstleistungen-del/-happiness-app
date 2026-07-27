import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const SITE_URL = 'https://happiness-eu.netlify.app'

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function generateHTML(profile) {
  const schemaType = profile.profile_type === 'business' ? 'Organization' : 'Person'
  const platforms = Array.isArray(profile.platforms) ? profile.platforms : []
  const platformLinks = platforms.map(p => {
    const name = typeof p === 'string' ? p : p.name || ''
    const handle = typeof p === 'string' ? '' : p.handle || ''
    if (!name) return ''
    const url = handle.startsWith('http') ? handle : `https://${name}.com/${handle.replace('@', '')}`
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`
  }).filter(Boolean).join(' · ')

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": profile.display_name,
    "description": profile.bio,
    "url": `${SITE_URL}/creator/${profile.slug}`,
    "sameAs": platforms.map(p => {
      const name = typeof p === 'string' ? p : p.name || ''
      const handle = typeof p === 'string' ? '' : p.handle || ''
      if (!name || !handle) return null
      return handle.startsWith('http') ? handle : `https://${name}.com/${handle.replace('@', '')}`
    }).filter(Boolean)
  }

  if (profile.niche) jsonLd.description += ` | Nische: ${profile.niche}`
  if (profile.offer) jsonLd.description += ` | Angebot: ${profile.offer}`
  if (profile.location) jsonLd.address = { "@type": "PostalAddress", "addressLocality": profile.location }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(profile.display_name)} — ${escapeHtml(profile.niche || profile.profile_type)} | H.I.T.</title>
  <meta name="description" content="${escapeHtml(profile.bio || profile.display_name + ' auf H.I.T.')}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${SITE_URL}/creator/${profile.slug}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f1a; color: #fff; min-height: 100vh; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 32px; }
    .name { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .niche { font-size: 14px; color: #00d4ff; margin-bottom: 4px; }
    .type { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); }
    .bio { font-size: 16px; line-height: 1.6; color: rgba(255,255,255,0.85); margin-bottom: 24px; text-align: center; }
    .section { margin-bottom: 20px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
    .offer { background: rgba(0,212,255,0.08); border-left: 3px solid #00d4ff; padding: 14px; border-radius: 0 8px 8px 0; font-size: 14px; color: rgba(255,255,255,0.9); }
    .platforms { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .platforms a { background: rgba(255,255,255,0.08); padding: 6px 14px; border-radius: 20px; font-size: 13px; color: #00d4ff; text-decoration: none; transition: background 0.2s; }
    .platforms a:hover { background: rgba(0,212,255,0.15); }
    .location { font-size: 14px; color: rgba(255,255,255,0.5); text-align: center; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
    .footer a { color: rgba(0,212,255,0.5); text-decoration: none; font-size: 12px; }
    .footer a:hover { color: #00d4ff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="name">${escapeHtml(profile.display_name)}</h1>
      ${profile.niche ? `<p class="niche">${escapeHtml(profile.niche)}</p>` : ''}
      <p class="type">${escapeHtml(profile.profile_type === 'business' ? 'Unternehmen' : 'Creator')}</p>
    </div>
    ${profile.bio ? `<p class="bio">${escapeHtml(profile.bio)}</p>` : ''}
    ${profile.offer ? `
    <div class="section">
      <p class="label">Angebot</p>
      <div class="offer">${escapeHtml(profile.offer)}</div>
    </div>` : ''}
    ${platformLinks ? `
    <div class="section">
      <p class="label">Plattformen</p>
      <div class="platforms">${platformLinks}</div>
    </div>` : ''}
    ${profile.location ? `<p class="location">📍 ${escapeHtml(profile.location)}</p>` : ''}
    <div class="footer">
      <a href="${SITE_URL}">powered by H.I.T. — happiness-eu.netlify.app</a>
    </div>
  </div>
</body>
</html>`
}

export const handler = async (event) => {
  const slug = event.path?.split('/creator/')?.[1]

  if (!slug) {
    return { statusCode: 404, body: 'Not found' }
  }

  try {
    const { data, error } = await supabase
      .from('public_creator_profiles')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html><html><head><title>404</title></head><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:#fff;">
          <h1>Profil nicht gefunden</h1>
          <p style="color:rgba(255,255,255,0.5);">Dieses Profil existiert nicht oder wurde nicht veröffentlicht.</p>
          <a href="${SITE_URL}" style="color:#00d4ff;">Zurück zu H.I.T.</a>
        </body></html>`
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      body: generateHTML(data)
    }
  } catch (e) {
    return { statusCode: 500, body: 'Internal error' }
  }
}
