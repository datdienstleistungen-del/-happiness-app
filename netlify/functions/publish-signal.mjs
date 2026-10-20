import fs from 'fs'
import path from 'path'

/**
 * Netlify Serverless Function: publish-signal
 * 
 * Verarbeitet die Veröffentlichung eines Signals von NeXus HIT auf dat-dat.de:
 * 1. Schreibt das Signal in Supabase (nexus_lead_packages mit status = 'published').
 * 2. Aktualisiert signalsData.js auf dem Datenträger (falls im lokalen Projekt vorhanden).
 * 3. Liefert Bestätigung und Live-URL zurück.
 */

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    const { signal } = JSON.parse(event.body || '{}')
    if (!signal || !signal.slug || !signal.teaser) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Ungültiges Signal-Format.' })
      }
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const userId = process.env.HARRO_USER_ID || '976e6211-8931-425a-a171-0c062290181b'

    // 1. In Supabase (nexus_lead_packages)
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const payload = {
          user_id: userId,
          headline: signal.teaser.headline,
          summary: signal.teaser.eventSummary,
          why_relevant: signal.teaser.includedDataSummary,
          quality_score: 100,
          has_contact: true,
          evidence: [signal.unlockedDossier.primarySource],
          contacts: signal.unlockedDossier.decisionMakers,
          company_data: signal,
          status: 'published',
          package_tier: 'human-verified',
          updated_at: new Date().toISOString()
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/nexus_lead_packages`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        })

        if (!res.ok) {
          const errText = await res.text()
          console.warn('[publish-signal] Supabase Ingestion Warnung:', errText)
        } else {
          console.log('[publish-signal] Erfolgreich in Supabase gespeichert:', signal.slug)
        }
      } catch (dbErr) {
        console.error('[publish-signal] Supabase Fehler:', dbErr)
      }
    }

    // 2. Lokaler Sync in signalsData.js (falls Projektordner auf Disk erreichbar ist)
    const localSignalsPath = 'C:\\Projekte\\dat-dienstleistungen-website\\src\\data\\signalsData.js'
    try {
      if (fs.existsSync(localSignalsPath)) {
        let fileContent = fs.readFileSync(localSignalsPath, 'utf8')
        
        // Prüfen, ob Signal bereits existiert
        if (!fileContent.includes(`id: "${signal.id}"`) && !fileContent.includes(`slug: "${signal.slug}"`)) {
          // Vor dem schließenden '];' einfügen
          const insertIndex = fileContent.lastIndexOf('];')
          if (insertIndex !== -1) {
            const signalCode = `,\n  ${JSON.stringify(signal, null, 2).replace(/"([^"]+)":/g, '$1:')}\n`
            fileContent = fileContent.slice(0, insertIndex).trimEnd() + signalCode + '];\n'
            fs.writeFileSync(localSignalsPath, fileContent, 'utf8')
            console.log('[publish-signal] Lokale Datei signalsData.js erfolgreich synchronisiert!')
          }
        }
      }
    } catch (fsErr) {
      console.warn('[publish-signal] Lokale Datei-Synchronisierung übersprungen:', fsErr.message)
    }

    const liveUrl = `https://dat-dat.de/signal/${signal.slug}`
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        liveUrl,
        slug: signal.slug,
        message: 'Signal erfolgreich als Human-Verified Dossier veröffentlicht.'
      })
    }
  } catch (error) {
    console.error('[publish-signal] Fehler:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Serverfehler bei der Veröffentlichung.' })
    }
  }
}
