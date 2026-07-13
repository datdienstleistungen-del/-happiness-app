const https = require('https')
const fs = require('fs')
const path = require('path')

const CLOUDINARY_CLOUD = 'h3lhvkua'
const CLOUDINARY_PRESET = 'happiness_videos'
const SUPABASE_URL = 'https://irumowvmhvrofezwvnop.supabase.co'
const SUPABASE_KEY = 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'

const USER_IDS = [
  '5ff67787-c948-49a6-b7fe-87d41b7bea9f',
  '028857e8-60da-42b8-8aed-944bca331f89',
  '14e2bbe2-d6ef-4cbf-b988-693116c5557a',
  'c91868d9-e414-46ef-be4a-968e58fee654',
  '976e6211-8931-425a-a171-0c062290181b',
  'c5e8b409-52e4-4203-8fb9-11e10bc5dc2b',
  '27abdb37-2fb5-48db-8ddd-7768b470c0a9'
]

const FUNNY_CATEGORIES = [
  { query: 'funny dance person', caption: 'Jemand muss das gesehen haben' },
  { query: 'surprised face reaction', caption: 'Die Reaktion sagt alles' },
  { query: 'baby laughing', caption: 'Das laechelst du dir ab' },
  { query: 'dog funny trick', caption: 'Cleverer Hund oder was?' },
  { query: 'cat jump fail', caption: 'Katzen denken immer sie koennen fliegen' },
  { query: 'funny acrobatics fail', caption: 'Fast haette er es geschafft' },
  { query: 'party dance funny', caption: 'Jeder kennt diesen einen Typen auf der Party' },
  { query: 'water splash funny', caption: 'Ups, das sollte nicht passieren' },
  { query: 'prank surprise', caption: 'Man lacht immer noch' },
  { query: 'sports fail funny', caption: 'Sport kann so unfair sein' },
  { query: 'baby first steps', caption: 'Der groesste Moment im Leben' },
  { query: 'puppy playing', caption: 'Unwiderstehlich' },
  { query: 'kitten curious', caption: 'Was machst du da?' },
  { query: 'friends laughing', caption: 'Das echte Leben' },
  { query: 'street performer', caption: 'Talent oder Wahnsinn?' }
]

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: 'yOpmDcuJQC8prGO0yxEGjn51H09wG3wIb4OkiTUNvrq3yjAoDUwoeRP0' } }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON: ' + data.substring(0, 200))) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redir = 0) => {
      if (redir > 5) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : require('http')
      mod.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redir + 1)
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
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
    const boundary = '----FB' + Date.now()
    const fileData = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n${CLOUDINARY_PRESET}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: video/mp4\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    }, (res) => {
      let data = ''
      res.on('data', (c) => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (j.secure_url) resolve(j.secure_url)
          else reject(new Error(j.error?.message || data.substring(0, 200)))
        } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function insertVideo(url, caption, userId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ video_url: url, caption, user_id: userId, file_path: 'pexels' })
    const req = https.request({
      hostname: 'irumowvmhvrofezwvnop.supabase.co',
      path: '/rest/v1/videos',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' }
    }, (res) => {
      let data = ''
      res.on('data', (c) => data += c)
      res.on('end', () => { res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`DB ${res.statusCode}: ${data}`)) })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const count = parseInt(process.argv[2]) || 10
  console.log(`\nSuche ${count} lustige Videos von Pexels (bessere Suchbegriffe)...\n`)

  const candidates = []
  const usedIds = new Set()

  for (const cat of FUNNY_CATEGORIES) {
    if (candidates.length >= count * 2) break
    try {
      const res = await fetchJSON(`https://api.pexels.com/videos/search?query=${encodeURIComponent(cat.query)}&per_page=5&size=small`)
      if (res.videos) {
        for (const v of res.videos) {
          if (usedIds.has(v.id)) continue
          usedIds.add(v.id)
          const hd = v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') || v.video_files?.find(f => f.file_type === 'video/mp4')
          if (hd && v.duration >= 3 && v.duration <= 45) {
            candidates.push({ url: hd.link, caption: cat.caption, duration: v.duration, score: v.height * v.width })
          }
        }
      }
      process.stdout.write(`  "${cat.query}" → ${res.videos?.length || 0} Treffer\n`)
      await sleep(250)
    } catch (e) { console.error(`  "${cat.query}" FEHLER: ${e.message}`) }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = candidates.slice(0, count)
  console.log(`\n${selected.length} Videos auserwaehlt. Upload...\n`)

  let uploaded = 0
  for (const vid of selected) {
    const tmp = path.join(__dirname, `tmp_pexels_${Date.now()}.mp4`)
    try {
      process.stdout.write(`  [${uploaded + 1}/${selected.length}] "${vid.caption}"`)
      await downloadFile(vid.url, tmp)
      const mb = (fs.statSync(tmp).size / 1024 / 1024)
      if (mb > 80) { console.log(' zu gross'); fs.unlinkSync(tmp); continue }
      process.stdout.write(` ${(mb).toFixed(1)}MB -> Cloudinary...`)
      const cloudUrl = await uploadToCloudinary(tmp)
      await insertVideo(cloudUrl, vid.caption, USER_IDS[uploaded % USER_IDS.length])
      console.log(' OK')
      uploaded++
    } catch (e) { console.log(' FEHLER: ' + e.message) }
    finally { try { fs.unlinkSync(tmp) } catch(e){} }
    await sleep(800)
  }

  console.log(`\n${uploaded}/${selected.length} Videos hochgeladen!`)
}

main().catch(e => console.error('Fatal:', e))
