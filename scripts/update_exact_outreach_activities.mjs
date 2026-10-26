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

const oppId = '35bead11-ba4d-47b4-be1a-21a765b96b29' // cosquare AG

const emailTextCH = `Sehr geehrte Frau Tannò,

über unseren Mandate Desk identifizieren wir tagesaktuell signifikante Organ-Vakanzen und Führungslücken im europäischen Markt.

Am Standort Zug liegt uns ein akutes Organ-Vakuum bei einer schweizerischen Technologie-AG vor: Ein vollwertiges Mitglied des Verwaltungsrates mit Einzelunterschrift ist per sofort ausgeschieden, ohne dass eine Nachfolge geregelt ist.

Da hier unmittelbarer Handlungsdruck bezüglich Board-Governance, Organvertretung und operativer Handlungsfähigkeit besteht, stellen wir diesen Anlass einem ausgewählten Partner zur Mandatierung zur Verfügung.

Ihnen sichern wir für diesen Fall absolute Exklusivität zu – das Signal wird von uns an keinen weiteren Provider oder Wettbewerber im Schweizer Markt herausgegeben.

Das anonymisierte Blind-Profil zur Ersteinschätzung:

Referenz: CH-ZG-2026-VR-01
Region & Rechtsform: Kanton Zug (Schweiz) · Aktiengesellschaft (AG)
Segment: Digital Commerce / Video-Tech (Scale-up)
Anlass: Akutes Ausscheiden Verwaltungsrat mit Einzelunterschrift per sofort / Vakanz
Bedarf: Interim Board Member / Ad-interim Executive (Governance & Transition)
Status: Vakant / Frei zur Erstansprache

Weitere Informationen zu unserem Mandate Desk finden Sie unter:
https://dat-dat.de

Bei Interesse an den verifizierten Klardaten und Organ-Details für Ihre Mandatsansprache freue ich mich über Ihre kurze Rückmeldung.

Mit freundlichen Grüßen

Harro Goerndt
D.A.T. Dienstleistungen · Executive Mandate Desk
Weserstraße 16 · 26382 Wilhelmshaven`

const emailTextUK = `Dear Mr Tarboton,

Through our European Mandate Desk, we monitor primary statutory registers for acute C-level and board-level transitions across key European jurisdictions.

We have identified an immediate governance and leadership vacancy at a Swiss digital technology corporation (Aktiengesellschaft) located within the greater Zurich / Central Switzerland economic area. A senior board director has stepped down with immediate effect, leaving an unstaffed organ vacancy.

Due to interim governance requirements, we are presenting this event to an established executive interim partner. We grant you exclusive first-look rights for the UK market on this lead until Wednesday, 28 October 2026, 17:00 BST. Should you decline or not confirm by this deadline, exclusivity expires.

Anonymised Mandate Overview:
- Reference: INT-CH-2026-081
- Region & Entity: Greater Zurich Area / Central Switzerland · Swiss Corporation (AG)
- Industry: Software, Digital Platforms & Tech
- Trigger: Unplanned departure of key board director / immediate organ vacancy
- Requirement: Board Member / Executive Transition Management
- Status: Open for primary outreach

Further information about our executive desk:
https://dat-dat.de

To receive the verified corporate entity details, primary filing records, and source documentation, please confirm your interest by replying directly to this email.

Best regards,

Harro Goerndt
D.A.T. Dienstleistungen · Executive Mandate Desk
Weserstraße 16 · 26382 Wilhelmshaven, Germany`

async function main() {
  // 1. Fetch opportunity to get user_id
  const resOpp = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?id=eq.${oppId}&select=*`, {
    headers
  })
  const oppList = await resOpp.json()
  const opp = oppList[0]
  const userId = opp?.user_id || '976e6211-8931-425a-a171-0c062290181b'
  console.log('Opportunity found:', opp?.title, '| User ID:', userId)

  // 2. Delete old email_sent activities for this opportunity to have a clean, non-duplicated audit trail
  const resDel = await fetch(`${supabaseUrl}/rest/v1/nexus_activities?entity_id=eq.${oppId}&activity_type=eq.email_sent`, {
    method: 'DELETE',
    headers
  })
  console.log('Cleared previous email_sent activities status:', resDel.status)

  // 3. Insert exact 1:1 records
  const actCH = {
    user_id: userId,
    entity_type: 'opportunity',
    entity_id: oppId,
    actor_type: 'USER',
    actor_name: 'Harro Goerndt',
    activity_type: 'email_sent',
    created_at: '2026-10-26T10:33:01Z',
    description: 'Original-Ansprache Schweiz versendet: Top Fifty AG · Pierina Tannò (p.tanno@top50interim.com) | Ref: CH-ZG-2026-VR-01 · Exklusivität aktiv bis 09.11.2026 (14 Tage)',
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
      sent_at: '2026-10-26T10:33:01Z',
      subject: 'Diskretes Mandatssignal: Organ-Vakuum VR / C-Level (Raum Zug · Tech-AG)',
      body: emailTextCH,
      role: 'Interim Board Member / Ad-interim Executive (Governance & Transition)',
      segment: 'Digital Commerce / Video-Tech (Scale-up)'
    }
  }

  const actUK = {
    user_id: userId,
    entity_type: 'opportunity',
    entity_id: oppId,
    actor_type: 'USER',
    actor_name: 'Harro Goerndt',
    activity_type: 'email_sent',
    created_at: '2026-10-26T10:59:33Z',
    description: 'Original-Ansprache UK versendet: BIE Executive · Byron Tarboton (byron.tarboton@bie-executive.com) | Ref: INT-CH-2026-081 · 48h First-Look UK bis Mittwoch, 28.10.2026, 17:00 BST',
    metadata: {
      recipient: 'Byron Tarboton',
      email: 'byron.tarboton@bie-executive.com',
      organization: 'BIE Executive',
      location: 'London, UK 🇬🇧',
      reference_code: 'INT-CH-2026-081',
      target_company: 'cosquare AG (Greater Zurich Area / Central Switzerland)',
      status: 'FIRST_LOOK_AKTIV',
      first_look_until: '2026-10-28T16:00:00.000Z',
      window_hours: 48,
      sent_at: '2026-10-26T10:59:33Z',
      subject: 'Mandate Opportunity: Executive / Board Transition (Greater Zurich Area)',
      body: emailTextUK,
      role: 'Board Member / Executive Transition Management',
      industry: 'Software, Digital Platforms & Tech'
    }
  }

  const resInsert = await fetch(`${supabaseUrl}/rest/v1/nexus_activities`, {
    method: 'POST',
    headers,
    body: JSON.stringify([actCH, actUK])
  })

  if (!resInsert.ok) {
    const err = await resInsert.text()
    console.error('Insert error:', resInsert.status, err)
  } else {
    const inserted = await resInsert.json()
    console.log(`Successfully registered ${inserted.length} exact 1:1 original outreach activities:`)
    for (const item of inserted) {
      console.log(` - [${item.created_at}] ${item.description}`)
    }
  }

  // Update Opportunity tags & stage
  const updatedTags = Array.from(new Set([
    ...(opp?.tags || []),
    'OUTREACH_CH_TOP_FIFTY',
    'OUTREACH_UK_BIE_EXECUTIVE',
    'CH-ZG-2026-VR-01',
    'INT-CH-2026-081',
    'EXKLUSIV_RESERVIERT',
    'FIRST_LOOK_AKTIV'
  ]))

  await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?id=eq.${oppId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      pipeline_stage: 'contacted',
      tags: updatedTags
    })
  })
  console.log('Opportunity updated with clean tags.')
}

main().catch(console.error)
