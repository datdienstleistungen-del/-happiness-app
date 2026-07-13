const https = require('https')
const fs = require('fs')
const path = require('path')

const CLOUDINARY_CLOUD = 'h3lhvkua'
const CLOUDINARY_PRESET = 'happiness_videos'
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_KEY = 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'

const SUBREDDITS = [
  'funny',
  'unexpected',
  'therewasanattempt',
  'animalsbeingderps',
  'yesyesyesno',
  'instant_regret',
  'holdmybeer',
  'PeopleFuckingDying',
  'AnimalsBeingJerks',
  'WTF'
]

const USER_IDS = [
  '5ff67787-c948-49a6-b7fe-87d41b7bea9f',
  '028857e8-60da-42b8-8aed-944bca331f89',
  '14e2bbe2-d6ef-4cbf-b988-693116c5557a',
  'c91868d9-e414-46ef-be4a-968e58fee654',
  '976e6211-8931-425a-a171-0c062290181b',
  'c5e8b409-52e4-4203-8fb9-11e10bc5dc2b',
  '27abdb37-2fb5-48db-8ddd-7768b470c0a9'
]

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'HappinessApp/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON parse: ' + data.substring(0, 200))) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : require('http')
      mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve(dest) })
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

function uploadToCloudinary(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now()
    const fileData = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)

    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n${CLOUDINARY_PRESET}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`
    )
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
    const body = Buffer.concat([header, fileData, footer])

    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.secure_url) resolve(json.secure_url)
          else reject(new Error('Upload: ' + (json.error?.message || data.substring(0, 200))))
        } catch (e) { reject(new Error('Upload parse: ' + data.substring(0, 200))) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function insertVideo(url, caption, userId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ video_url: url, caption, user_id: userId, file_path: 'reddit' })
    const req = https.request({
      hostname: 'irumowvmhvrofezwvnop.supabase.co',
      path: '/rest/v1/videos',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`DB ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const count = parseInt(process.argv[2]) || 10
  console.log(`\nSuche lustige Videos von Reddit... (Ziel: ${count})\n`)

  const candidates = []

  for (const sub of SUBREDDITS) {
    if (candidates.length >= count * 3) break
    try {
      const url = `https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`
      const res = await fetchJSON(url)
      const posts = res?.data?.children || []

      for (const post of posts) {
        const p = post.data
        if (!p.is_video && !p.is_reddit_media && !p.url?.includes('.mp4')) continue
        if (p.over_18) continue
        if (p.score < 500) continue

        let videoUrl = null
        if (p.is_video && p.media?.reddit_video) {
          videoUrl = p.media.reddit_video.fallback_url
        } else if (p.is_reddit_media && p.media?.reddit_video) {
          videoUrl = p.media.reddit_video.fallback_url
        } else if (p.url?.includes('.mp4')) {
          videoUrl = p.url
        }

        if (videoUrl) {
          candidates.push({
            url: videoUrl,
            caption: p.title.replace(/^[^a-zA-ZäöüÄÖÜ]+/, '').substring(0, 120),
            subreddit: sub,
            score: p.score
          })
        }
      }
      console.log(`  r/${sub}: ${candidates.length} Videos gesammelt`)
      await sleep(1500)
    } catch (e) {
      console.error(`  r/${sub}: FEHLER - ${e.message}`)
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = candidates.slice(0, count)
  console.log(`\n${selected.length} Videos ausgewaehlt. Starte Upload...\n`)

  let uploaded = 0
  for (const vid of selected) {
    const tmpFile = path.join(__dirname, `tmp_reddit_${Date.now()}.mp4`)
    try {
      process.stdout.write(`  [${uploaded + 1}/${selected.length}] ${vid.subreddit} (${vid.score} pts)`)
      process.stdout.write(' Download...')
      await downloadFile(vid.url, tmpFile)

      const sizeMB = (fs.statSync(tmpFile).size / 1024 / 1024)
      if (sizeMB > 100) {
        console.log(' Zu gross, ueberspringe')
        fs.unlinkSync(tmpFile)
        continue
      }

      process.stdout.write(` ${(sizeMB).toFixed(1)}MB Upload...`)
      const cloudUrl = await uploadToCloudinary(tmpFile)
      const userId = USER_IDS[uploaded % USER_IDS.length]
      process.stdout.write(' DB...')
      await insertVideo(cloudUrl, vid.caption, userId)
      console.log(' OK')
      uploaded++
    } catch (e) {
      console.log(' FEHLER: ' + e.message)
    } finally {
      try { fs.unlinkSync(tmpFile) } catch (e) {}
    }
    await sleep(1000)
  }

  console.log(`\n${uploaded}/${selected.length} Videos hochgeladen!`)
}

main().catch(e => console.error('Fatal:', e))
