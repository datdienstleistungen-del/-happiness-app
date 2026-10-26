import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=')
    const k = trimmed.slice(0, idx).trim()
    const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[k] = v
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY

const headers = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function main() {
  const oppId = '35bead11-ba4d-47b4-be1a-21a765b96b29' // cosquare AG

  // Fetch opportunity to get user_id and tags
  const resOpp = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?id=eq.${oppId}&select=*`, {
    headers
  })
  const oppList = await resOpp.json()
  const opp = oppList[0]
  const userId = opp?.user_id || null
  console.log('Opportunity found:', opp?.title, '| User ID:', userId)

  // 1. Activity 1: Schweiz (Top Fifty AG)
  const act1 = {
    user_id: userId,
    entity_type: 'opportunity',
    entity_id: oppId,
    actor_type: 'USER',
    actor_name: 'Harro Goerndt',
    activity_type: 'email_sent',
    description: 'Outreach E-Mail & Blind-Profil versendet: Top Fifty AG · Pierina Tannò (p.tanno@top50interim.com) | Ref: CH-ZG-2026-VR-01 · Exklusivität aktiv bis 09.11.2026 (14 Tage)',
    metadata: {
      recipient: 'Pierina Tannò',
      email: 'p.tanno@top50interim.com',
      organization: 'Top Fifty AG',
      location: 'Baar / Zug, Schweiz 🇨🇭',
      reference_code: 'CH-ZG-2026-VR-01',
      target_company: 'cosquare AG',
      status: 'EXKLUSIV_RESERVIERT',
      protection_until: '2026-11-09T23:59:59.000Z',
      exclusivity_days: 14,
      role: 'Mitglied des Verwaltungsrates (Ersatzbesetzung)',
      subject: 'Vertrauliches Mandats-Signal: Schweizer Technologie-AG (Kanton Zug) · Abruptes Organ-Vakuum (VR Einzelunterschrift) · Ref: CH-ZG-2026-VR-01',
      budget_band: '150.000 – 300.000 CHF (Tagessatz: 2.200 – 2.800 CHF)',
      blind_profile_sent: true
    }
  }

  // 2. Activity 2: UK (BIE Executive)
  const act2 = {
    user_id: userId,
    entity_type: 'opportunity',
    entity_id: oppId,
    actor_type: 'USER',
    actor_name: 'Harro Goerndt',
    activity_type: 'email_sent',
    description: 'Outreach E-Mail & Blind Profile sent: BIE Executive · Byron Tarboton (byron.tarboton@bie-executive.com) | Ref: INT-CH-2026-081 · 48h First-Look UK bis Mittwoch, 28.10.2026, 17:00 BST',
    metadata: {
      recipient: 'Byron Tarboton',
      email: 'byron.tarboton@bie-executive.com',
      organization: 'BIE Executive',
      location: 'London, UK 🇬🇧',
      reference_code: 'INT-CH-2026-081',
      target_company: 'cosquare AG (Großraum Zürich / Zentralschweiz)',
      status: 'FIRST_LOOK_AKTIV',
      first_look_until: '2026-10-28T16:00:00.000Z', // 17:00 BST
      window_hours: 48,
      role: 'Interim Board Director / Crisis Governance Lead',
      subject: 'Confidential Mandate Signal: Swiss Technology AG (Greater Zurich / Central Switzerland) · Abrupt Board / Governance Vacancy · Ref: INT-CH-2026-081',
      budget_band: '150.000 – 300.000 CHF (Daily rate: 2.200 – 2.800 CHF)',
      blind_profile_sent: true
    }
  }

  // Insert both activities
  const resInsert = await fetch(`${supabaseUrl}/rest/v1/nexus_activities`, {
    method: 'POST',
    headers,
    body: JSON.stringify([act1, act2])
  })

  if (!resInsert.ok) {
    const errText = await resInsert.text()
    console.error('Failed to insert activities:', resInsert.status, errText)
  } else {
    const inserted = await resInsert.json()
    console.log(`Successfully registered ${inserted.length} activities in nexus_activities:`)
    for (const item of inserted) {
      console.log(` - ID: ${item.id} | ${item.description}`)
    }
  }

  // Update tags and pipeline_stage on opportunity
  const currentTags = opp?.tags || []
  const updatedTags = Array.from(new Set([
    ...currentTags,
    'OUTREACH_CH_TOP_FIFTY',
    'OUTREACH_UK_BIE_EXECUTIVE',
    'CH-ZG-2026-VR-01',
    'INT-CH-2026-081',
    'EXKLUSIV_RESERVIERT',
    'FIRST_LOOK_AKTIV'
  ]))

  const resPatch = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?id=eq.${oppId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      pipeline_stage: 'contacted',
      tags: updatedTags
    })
  })

  if (!resPatch.ok) {
    const errText = await resPatch.text()
    console.error('Failed to patch opportunity tags:', resPatch.status, errText)
  } else {
    console.log('Successfully updated opportunity tags & stage to contacted.')
  }
}

main().catch(console.error)
