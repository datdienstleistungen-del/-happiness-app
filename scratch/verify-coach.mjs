import { handler as chatHandler } from '../netlify/functions/coach-chat.mjs'
import { handler as consentHandler } from '../netlify/functions/coach-consent.mjs'

// Mock environment variables for local test if not set
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://irumowvmhvrofezwvnop.supabase.co'

async function runTest() {
  const visitorId = 'verify_visitor_' + Math.random().toString(36).substring(2, 8)
  console.log(`Starting local verification with visitorId: ${visitorId}`)

  // 1. Send chat message WITHOUT consent
  console.log('\n--- Test 1: Senden ohne Consent ---')
  const event1 = {
    httpMethod: 'POST',
    body: JSON.stringify({
      visitor_id: visitorId,
      message: 'Hallo! Wer bist du?'
    }),
    headers: {}
  }
  
  const res1 = await chatHandler(event1)
  console.log('Status Code:', res1.statusCode)
  const body1 = JSON.parse(res1.body)
  console.log('Response Body:', body1)

  if (res1.statusCode !== 200 || !body1.response) {
    throw new Error('Test 1 fehlgeschlagen: Konnte keine Antwort generieren')
  }
  console.log('Test 1 erfolgreich!')

  // 2. Grant consent via consent handler
  console.log('\n--- Test 2: Consent erteilen ---')
  const consentEvent = {
    httpMethod: 'POST',
    body: JSON.stringify({
      visitor_id: visitorId
    }),
    headers: {}
  }

  const resConsent = await consentHandler(consentEvent)
  console.log('Consent Status Code:', resConsent.statusCode)
  const bodyConsent = JSON.parse(resConsent.body)
  console.log('Consent Response Body:', bodyConsent)

  if (resConsent.statusCode !== 200 || !bodyConsent.success) {
    throw new Error('Test 2 fehlgeschlagen: Konnte Consent nicht eintragen')
  }
  console.log('Test 2 erfolgreich!')

  // 3. Send chat message WITH consent (this should load history and save new messages to DB)
  console.log('\n--- Test 3: Senden mit Consent ---')
  const event2 = {
    httpMethod: 'POST',
    body: JSON.stringify({
      visitor_id: visitorId,
      message: 'Was kann ich heute tun, um mich glücklich zu fühlen?'
    }),
    headers: {}
  }

  const res2 = await chatHandler(event2)
  console.log('Status Code:', res2.statusCode)
  const body2 = JSON.parse(res2.body)
  console.log('Response Body:', body2)

  if (res2.statusCode !== 200 || !body2.response) {
    throw new Error('Test 3 fehlgeschlagen: Konnte keine Antwort mit Consent generieren')
  }
  console.log('Test 3 erfolgreich!')

  // 4. Fetch history via GET request
  console.log('\n--- Test 4: Verlauf abrufen ---')
  const event3 = {
    httpMethod: 'GET',
    queryStringParameters: {
      visitor_id: visitorId
    },
    headers: {}
  }

  const res3 = await chatHandler(event3)
  console.log('Status Code:', res3.statusCode)
  const body3 = JSON.parse(res3.body)
  console.log('Response Body History Count:', body3.history?.length)
  console.log('History Messages:', body3.history)

  if (res3.statusCode !== 200 || !body3.history || body3.history.length === 0) {
    throw new Error('Test 4 fehlgeschlagen: Konnte den gespeicherten Verlauf nicht abrufen')
  }
  console.log('Test 4 erfolgreich!')
  console.log('\nAlle lokalen Funktionstests erfolgreich bestanden! 🎉')
}

runTest().catch(err => {
  console.error('Verifikationsts fehlgeschlagen:', err.message)
  process.exit(1)
})
