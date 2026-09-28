import { test, expect } from '@playwright/test'
import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'

// supabase-js initialisiert realtime-js beim createClient; in Node fehlt
// ein globales WebSocket-Konstrukt -> ws als Polyfill (wie in den Temp-Skripten).
globalThis.WebSocket = WebSocket

// Deployed-E2E fuer nexus-generate-strategies (aus Temp/test-strategies-deployed.mjs).
// Braucht TEST_USER_EMAIL, TEST_USER_PASSWORD, SUPABASE_SERVICE_KEY.
// In CI nur ausgefuehrt, wenn die Secrets gesetzt sind (siehe .github/workflows/ci.yml).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SITE_URL = process.env.E2E_SITE_URL || 'https://nexus-hit.netlify.app'

test.describe('API: nexus-generate-strategies', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD || !SERVICE_KEY,
    'TEST_USER_EMAIL/TEST_USER_PASSWORD/SUPABASE_SERVICE_KEY fehlen'
  )

  let offeringId = null
  let token = null
  let userId = null
  let admin = null

  test.beforeAll(async () => {
    const user = createClient(SUPABASE_URL, ANON_KEY)
    const { data: auth, error } = await user.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    })
    if (error) throw new Error(`Login fehlgeschlagen: ${error.message}`)
    token = auth.session.access_token
    userId = auth.user.id
    admin = createClient(SUPABASE_URL, SERVICE_KEY)
  })

  test('generiert Strategien ueber die Live-URL (200 + mind. 1 Strategie)', async ({ request }) => {
    const { data: created, error } = await admin
      .from('nexus_offerings')
      .insert({
        user_id: userId,
        offering_name: 'E2E Strategien Test (CI)',
        target_audience: 'Mittelstaendische IT-Unternehmen im DACH-Raum',
        target_markets: ['Deutschland'],
        ai_understanding: {
          offering_name: 'E2E Test',
          target_audience: 'IT-Unternehmen',
          demand_contexts: [{ signal: 'CRM gesucht', context: 'Modernisierung' }],
        },
      })
      .select('id')
      .single()
    expect(error, `Offering-Anlage fehlgeschlagen: ${error?.message}`).toBeNull()
    offeringId = created.id

    const aiUnderstanding = {
      offering_name: 'NeXus Test CRM',
      target_audience: 'Wachsende IT-Unternehmen im DACH-Raum',
      demand_contexts: [
        { signal: 'suchen moderne Vertriebssoftware', context: 'CRM-Modernisierung im Mittelstand' },
        { signal: 'bauen Inside-Sales-Teams auf', context: 'Skalierung der Kaltakquise' },
      ],
      what_is_NOT_sold: ['B2C-Software'],
    }

    const started = Date.now()
    const res = await request.post(`${SITE_URL}/.netlify/functions/nexus-generate-strategies`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { offeringId, aiUnderstanding, targetMarkets: ['Deutschland'], uiLanguage: 'de' },
      timeout: 30000,
    })
    const elapsed = Date.now() - started
    const body = await res.json().catch(() => ({}))
    console.log(`strategies handler: ${res.status()} in ${elapsed}ms`)

    expect(res.status()).toBe(200)
    expect(Array.isArray(body.strategies)).toBe(true)
    expect(body.strategies.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(26000)
  })

  test.afterAll(async () => {
    if (admin && offeringId) {
      await admin.from('nexus_signal_strategies').delete().eq('offering_id', offeringId)
      await admin.from('nexus_offerings').delete().eq('id', offeringId)
      console.log('cleanup done:', offeringId)
    }
  })
})
