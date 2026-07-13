const https = require('https')
const fs = require('fs')
const path = require('path')

const CLOUD = 'h3lhvkua'
const PRESET = 'happiness_videos'
const KEY = 'sb_publishable_tArx0o4FeYQ3HthZ7h7hCQ_fTJslkMa'
const USERS = ['5ff67787-c948-49a6-b7fe-87d41b7bea9f','028857e8-60da-42b8-8aed-944bca331f89','14e2bbe2-d6ef-4cbf-b988-693116c5557a','c91868d9-e414-46ef-be4a-968e58fee654','976e6211-8931-425a-a171-0c062290181b','c5e8b409-52e4-4203-8fb9-11e10bc5dc2b','27abdb37-2fb5-48db-8ddd-7768b470c0a9']
const QUERIES = [
  'storm ocean waves big', 'ship heavy sea storm', 'ocean waves crashing',
  'sailing rough water', 'wave hits boat', 'hurricane ocean',
  'dramatic sea storm', 'giant wave surfing', 'boat storm real',
  'ocean rough weather'
]

const CAPTIONS = [
  'Da will ich nicht drauf sein',
  'Das Meer ist gnadenlos',
  'Kein Wunder warum Piraten so verrueckt waren',
  'Niemals aufhoeren das Meer zu respektieren',
  'Das ist pure Kraft',
  'Wie im Film, nur echt',
  'Stell dir vor du waerst da drin',
  'Natur zeigt wer Boss ist',
  'Das schlaegt jede Welle bei uns',
  'Meer ruft, aber ich bleib daheim'
]

function dl(u, d) {
  return new Promise((ok, no) => {
    const f = (url, r) => {
      if (r > 5) return no(new Error('redirect'))
      https.get(url, h => {
        if (h.statusCode >= 300 && h.statusCode < 400) return f(h.headers.location, r + 1)
        if (h.statusCode !== 200) return no(new Error('HTTP ' + h.statusCode))
        const s = fs.createWriteStream(d)
        h.pipe(s)
        s.on('finish', () => { s.close(); ok(d) })
        s.on('error', no)
      }).on('error', no)
    }
    f(u, 0)
  })
}

function cloud(fp) {
  return new Promise((ok, no) => {
    const b = '----P' + Date.now()
    const fd = fs.readFileSync(fp)
    const n = path.basename(fp)
    const body = Buffer.concat([
      Buffer.from('--' + b + '\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n' + PRESET + '\r\n--' + b + '\r\nContent-Disposition: form-data; name="file"; filename="' + n + '"\r\nContent-Type: video/mp4\r\n\r\n'),
      fd,
      Buffer.from('\r\n--' + b + '--\r\n')
    ])
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: '/v1_1/' + CLOUD + '/video/upload',
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + b, 'Content-Length': body.length }
    }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => {
        try {
          const j = JSON.parse(d)
          j.secure_url ? ok(j.secure_url) : no(new Error(d.substring(0, 200)))
        } catch (e) { no(e) }
      })
    })
    req.on('error', no)
    req.write(body)
    req.end()
  })
}

function db(u, c, uid) {
  return new Promise((ok, no) => {
    const body = JSON.stringify({ video_url: u, caption: c, user_id: uid, file_path: 'pexels' })
    const req = https.request({
      hostname: 'irumowvmhvrofezwvnop.supabase.co',
      path: '/rest/v1/videos',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Prefer': 'return=minimal' }
    }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => r.statusCode >= 200 && r.statusCode < 300 ? ok() : no(new Error('DB ' + r.statusCode + ' ' + d)))
    })
    req.on('error', no)
    req.write(body)
    req.end()
  })
}

function pexelsSearch(query) {
  return new Promise((ok, no) => {
    https.get('https://api.pexels.com/videos/search?query=' + encodeURIComponent(query) + '&per_page=8&size=small', {
      headers: { Authorization: 'yOpmDcuJQC8prGO0yxEGjn51H09wG3wIb4OkiTUNvrq3yjAoDUwoeRP0' }
    }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => { try { ok(JSON.parse(d)) } catch (e) { no(e) } })
    }).on('error', no)
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const count = parseInt(process.argv[2]) || 10
  console.log('\nSuche Prank-Videos...\n')

  const candidates = []
  const usedIds = new Set()

  for (const q of QUERIES) {
    try {
      const res = await pexelsSearch(q)
      if (res.videos) {
        for (const v of res.videos) {
          if (usedIds.has(v.id)) continue
          usedIds.add(v.id)
          const hd = v.video_files?.find(f => f.quality === 'hd' && f.file_type === 'video/mp4') || v.video_files?.find(f => f.file_type === 'video/mp4')
          if (hd && v.duration >= 3 && v.duration <= 45) {
            candidates.push({ url: hd.link, dur: v.duration })
          }
        }
      }
      console.log('  "' + q + '" -> ' + (res.videos?.length || 0) + ' Treffer')
      await sleep(300)
    } catch (e) {
      console.error('  "' + q + '" FEHLER: ' + e.message)
    }
  }

  const selected = candidates.slice(0, count)
  console.log('\n' + selected.length + ' Videos. Upload...\n')

  let uploaded = 0
  for (const vid of selected) {
    const tmp = path.join(__dirname, 'tmp_prank_' + Date.now() + '.mp4')
    try {
      process.stdout.write('  [' + (uploaded + 1) + '/' + selected.length + '] ')
      await dl(vid.url, tmp)
      const mb = fs.statSync(tmp).size / 1024 / 1024
      if (mb > 80) { console.log('skip (zu gross)'); fs.unlinkSync(tmp); continue }
      const cloudUrl = await cloud(tmp)
      const caption = CAPTIONS[uploaded % CAPTIONS.length]
      await db(cloudUrl, caption, USERS[uploaded % USERS.length])
      console.log('OK ' + mb.toFixed(1) + 'MB - "' + caption + '"')
      uploaded++
    } catch (e) {
      console.log('FEHLER: ' + e.message)
    } finally {
      try { fs.unlinkSync(tmp) } catch (e) {}
    }
    await sleep(800)
  }

  console.log('\n' + uploaded + '/' + selected.length + ' Prank-Videos hochgeladen!')
}

main().catch(e => console.error('Fatal:', e))
