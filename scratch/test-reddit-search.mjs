async function searchReddit(query) {
  console.log(`Searching Reddit for: "${query}"...`)
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}+site:v.redd.it&limit=15`
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    })
    
    if (!res.ok) {
      throw new Error(`Reddit API status ${res.status}`)
    }
    
    const json = await res.json()
    const posts = json.data?.children || []
    
    const videos = posts
      .map(p => p.data)
      .filter(d => d.is_video && d.media?.reddit_video?.fallback_url)
      .map(d => ({
        id: d.id,
        title: d.title,
        url: d.media.reddit_video.fallback_url.split('?')[0], // strip token query params if they break direct player loading
        thumbnail: d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : '',
        duration: d.media.reddit_video.duration,
        width: d.media.reddit_video.width,
        height: d.media.reddit_video.height,
        subreddit: d.subreddit,
        permalink: `https://reddit.com${d.permalink}`
      }))
      
    console.log(`Found ${videos.length} videos:`)
    console.log(JSON.stringify(videos, null, 2))
  } catch (e) {
    console.error('Error searching Reddit:', e.message)
  }
}

searchReddit('satisfying')
