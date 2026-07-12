// ── H.I.T. Hybrid-Test (Live gegen Produktion) ──

const LIVE_URL = 'https://happiness-eu.netlify.app/.netlify/functions/hit-router'

const tests = [
  { nr: 1,  text: 'Schreib mir einen TikTok-Post über Nachhaltigkeit',                     expPlatform: 'tiktok',      expGoal: 'content_creation' },
  { nr: 2,  text: 'Ich brauche einen Facebook-Post für mein Business',                      expPlatform: 'facebook',    expGoal: 'content_creation' },
  { nr: 3,  text: 'Ich brauche ein Reel für meine Marke',                                   expPlatform: 'tiktok',      expGoal: 'content_creation' },
  { nr: 4,  text: 'Kannst du mein Instagram-Bio optimieren?',                               expPlatform: 'instagram',   expGoal: 'strategy' },
  { nr: 5,  text: 'Wie steigere ich meine YouTube-Views?',                                   expPlatform: 'youtube',     expGoal: 'strategy' },
  { nr: 6,  text: 'Ich möchte einen LinkedIn-Post für Jobwechsel',                          expPlatform: 'linkedin',    expGoal: 'content_creation' },
  { nr: 7,  text: 'Schreib mir eine Anzeige für Kleinanzeigen',                             expPlatform: 'marketplace', expGoal: 'content_creation' },
  { nr: 8,  text: 'Wie verdient man Geld mit TikTok?',                                      expPlatform: 'tiktok',      expGoal: 'monetization' },
  { nr: 9,  text: 'Gib mir Feedback auf meinen letzten Post',                               expPlatform: 'unknown',     expGoal: 'feedback' },
  { nr: 10, text: 'Ich will eine Content-Strategie für Instagram',                          expPlatform: 'instagram',   expGoal: 'strategy' },
  { nr: 11, text: 'Erkläre mir wie YouTube algorithm funktioniert',                         expPlatform: 'youtube',     expGoal: 'learning' },
  { nr: 12, text: 'Ich suche eine Anleitung für TikTok Videos',                             expPlatform: 'tiktok',      expGoal: 'learning' },
  { nr: 13, text: 'Ich brauche Hilfe bei meinem Lebenslauf',                                expPlatform: 'linkedin',    expGoal: 'learning' },
  { nr: 14, text: 'Kannst du mein Thumbnail für YouTube optimieren?',                       expPlatform: 'youtube',     expGoal: 'strategy' },
  { nr: 15, text: 'Schreib mir einen Hashtag-Plan für Instagram',                           expPlatform: 'instagram',   expGoal: 'strategy' },
  { nr: 16, text: 'Ich möchte eine Reel-Idee für mein Restaurant',                         expPlatform: 'tiktok',      expGoal: 'content_creation' },
  { nr: 17, text: 'Was ist der beste Posting-Zeitplan für Facebook?',                       expPlatform: 'facebook',    expGoal: 'strategy' },
  { nr: 18, text: 'Hilf mir bei meinem LinkedIn-Profil',                                    expPlatform: 'linkedin',    expGoal: 'strategy' },
  { nr: 19, text: 'Ich will wissen wie ich auf YouTubeCharts komme',                        expPlatform: 'youtube',     expGoal: 'strategy' },
  { nr: 20, text: 'Schreib mir eine kurze TikTok-Caption',                                  expPlatform: 'tiktok',      expGoal: 'content_creation' },
]

console.log('H.I.T. Hybrid-Test (Live Produktion)')
console.log(`Endpoint: ${LIVE_URL}`)
console.log('='.repeat(85))

let platformCorrect = 0
let goalCorrect = 0
let goalUnknown = 0
const results = []

for (const t of tests) {
  try {
    const res = await fetch(LIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: t.text, mode: 'chat' })
    })
    const data = await res.json()
    const hit = data._hit || {}

    const pOk = hit.platform === t.expPlatform
    const gOk = hit.goal === t.expGoal
    if (pOk) platformCorrect++
    if (gOk) goalCorrect++
    if (hit.goal === 'unknown') goalUnknown++

    results.push({
      nr: t.nr,
      text: t.text.substring(0, 52),
      platform: hit.platform || '?',
      pPct: hit.platformConfidence || 0,
      pOk,
      goal: hit.goal || '?',
      goalPct: hit.goalConfidence || 0,
      goalMethod: hit.goalMethod || '?',
      llmRaw: hit.llmRaw || '-',
      gOk,
      expGoal: t.expGoal,
      httpStatus: res.status
    })

    process.stdout.write(`#${String(t.nr).padStart(2)} `)
  } catch (err) {
    results.push({ nr: t.nr, text: t.text.substring(0, 52), platform: 'ERROR', goal: 'ERROR', gOk: false, pOk: false, expGoal: t.expGoal, goalMethod: 'exception', httpStatus: 0 })
    process.stdout.write(`#${String(t.nr).padStart(2)}E `)
  }

  // Kleine Pause um Rate-Limits zu vermeiden
  await new Promise(r => setTimeout(r, 300))
}

console.log('\n')

// Tabelle
console.log('─'.repeat(105))
console.log(
  '#'.padEnd(3),
  ' Plattform'.padEnd(14),
  'Ziel (LLM)'.padEnd(18),
  '✓'.padEnd(3),
  'LLM Rohtext'.padEnd(30),
  'Text'
)
console.log('─'.repeat(105))

for (const r of results) {
  console.log(
    String(r.nr).padEnd(3),
    ` ${r.platform}`.padEnd(14),
    ` ${r.goal}`.padEnd(18),
    (r.gOk ? '✓' : '✗').padEnd(3),
    ` ${r.llmRaw}`.padEnd(30),
    r.text
  )
}
console.log('─'.repeat(105))

console.log(`\nPlattform (Keyword): ${platformCorrect}/${tests.length} (${Math.round(platformCorrect/tests.length*100)}%)`)
console.log(`Ziel (LLM):         ${goalCorrect}/${tests.length} (${Math.round(goalCorrect/tests.length*100)}%)`)
console.log(`Ziel "unknown":     ${goalUnknown}/${tests.length}`)

const failures = results.filter(r => !r.gOk)
if (failures.length > 0) {
  console.log('\nFehlschläge (Ziel):')
  for (const f of failures) {
    console.log(`  #${f.nr}: erwartet="${f.expGoal}", bekommen="${f.goal}" [${f.goalMethod}] — "${f.text}"`)
  }
}
