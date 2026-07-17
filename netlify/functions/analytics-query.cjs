const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function queryFunnel(startDate, headers) {
  const start = startDate.toISOString()

  const [
    { count: ideas },
    { count: generated },
    { count: copied },
    { count: exported },
    { count: published },
    { data: dailyData },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true })
      .in('event_name', ['goal_submitted', 'quick_result'])
      .gte('created_at', start),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('event_name', 'content_generated')
      .gte('created_at', start),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('event_name', 'copy_action')
      .gte('created_at', start),
    supabase.from('events').select('*', { count: 'exact', head: true })
      .eq('event_name', 'export_to_tool')
      .gte('created_at', start),
    supabase.from('workflows').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', start),
    supabase.from('events').select('created_at, event_name')
      .in('event_name', ['goal_submitted', 'quick_result', 'content_generated', 'copy_action', 'export_to_tool'])
      .gte('created_at', start),
  ])

  const daily = {}
  dailyData?.forEach(d => {
    const date = d.created_at.split('T')[0]
    if (!daily[date]) daily[date] = { date, ideas: 0, generated: 0, copied: 0, exported: 0 }
    if (d.event_name === 'goal_submitted' || d.event_name === 'quick_result') daily[date].ideas++
    if (d.event_name === 'content_generated') daily[date].generated++
    if (d.event_name === 'copy_action') daily[date].copied++
    if (d.event_name === 'export_to_tool') daily[date].exported++
  })

  const ideasCount = ideas || 0
  const publishedCount = published || 0

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      funnel: {
        ideas: ideasCount,
        generated: generated || 0,
        copied: copied || 0,
        exported: exported || 0,
        published: publishedCount,
        conversionRate: ideasCount > 0 ? Math.round((publishedCount / ideasCount) * 1000) / 10 : 0,
      },
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    }),
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  // Auth check
  const authHeader = event.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) }
  }

  // Admin check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin only' }) }
  }

  const params = new URLSearchParams(event.queryStringParameters || {})
  const range = params.get('range') || '7d'
  const view = params.get('view') || 'overview'

  try {
    const now = new Date()
    let startDate
    if (range === '24h') startDate = new Date(now - 24 * 60 * 60 * 1000)
    else if (range === '7d') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)
    else if (range === '30d') startDate = new Date(now - 30 * 24 * 60 * 60 * 1000)
    else startDate = new Date(now - 7 * 24 * 60 * 60 * 1000)

    if (view === 'funnel') {
      return await queryFunnel(startDate, headers)
    }

    // Total events
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())

    // Unique visitors
    const { data: visitorData } = await supabase
      .from('events')
      .select('visitor_id')
      .gte('created_at', startDate.toISOString())

    const uniqueVisitors = new Set(visitorData?.map(v => v.visitor_id) || []).size

    // Events by name
    const { data: eventsByName } = await supabase
      .from('events')
      .select('event_name')
      .gte('created_at', startDate.toISOString())

    const eventCounts = {}
    eventsByName?.forEach(e => {
      eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1
    })

    // Top cities
    const { data: cityData } = await supabase
      .from('events')
      .select('city, country')
      .not('city', 'is', null)
      .gte('created_at', startDate.toISOString())

    const cityCounts = {}
    cityData?.forEach(c => {
      const key = `${c.city}, ${c.country}`
      cityCounts[key] = (cityCounts[key] || 0) + 1
    })

    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    // Daily breakdown
    const { data: dailyData } = await supabase
      .from('events')
      .select('created_at, event_name')
      .gte('created_at', startDate.toISOString())

    const daily = {}
    dailyData?.forEach(d => {
      const date = d.created_at.split('T')[0]
      if (!daily[date]) daily[date] = { date, page_views: 0, goals: 0, copies: 0 }
      daily[date].page_views++
      if (d.event_name === 'goal_submitted' || d.event_name === 'quick_result') daily[date].goals++
      if (d.event_name === 'copy_action') daily[date].copies++
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalEvents: totalEvents || 0,
        uniqueVisitors,
        eventCounts,
        topCities,
        dailyBreakdown: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
        range,
      }),
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
