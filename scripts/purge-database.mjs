import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or Service Key');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function purgeAll() {
  console.log('====================================================');
  console.log('🚀 STARTE AUTOMATISCHE BEREINIGUNG (FULL QUEUE PURGE)');
  console.log('====================================================\n');

  const now = new Date().toISOString();

  // 1. Fetch all active opportunities
  const oppRes = await fetch(`${url}/rest/v1/nexus_opportunities?deleted_at=is.null&select=id,title`, { headers });
  const activeOpps = oppRes.ok ? await oppRes.json() : [];
  console.log(`Gefundene aktive Opportunities: ${activeOpps.length}`);

  if (activeOpps.length > 0) {
    const oppIds = activeOpps.map(o => o.id);

    // 1a. Delete opportunity links
    console.log('Lösche Verknüpfungen (triggers, contacts, activities, packages)...');
    for (const chunk of chunkArray(oppIds, 30)) {
      const idList = chunk.map(id => `"${id}"`).join(',');
      await fetch(`${url}/rest/v1/nexus_opportunity_triggers?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_opportunity_contacts?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_activities?entity_type=eq.opportunity&entity_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_lead_packages?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
    }

    // 1b. Soft-delete + hard delete opportunities
    console.log('Setze deleted_at für alle Opportunities...');
    for (const chunk of chunkArray(oppIds, 30)) {
      const idList = chunk.map(id => `"${id}"`).join(',');
      // Try hard delete first
      const delRes = await fetch(`${url}/rest/v1/nexus_opportunities?id=in.(${idList})`, { method: 'DELETE', headers });
      if (!delRes.ok) {
        // Fallback to soft delete
        await fetch(`${url}/rest/v1/nexus_opportunities?id=in.(${idList})`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ deleted_at: now, review_status: 'rejected' })
        });
      }
    }
  }

  // 2. Fetch all active trigger events
  const trigRes = await fetch(`${url}/rest/v1/nexus_trigger_events?deleted_at=is.null&select=id,title`, { headers });
  const activeTrigs = trigRes.ok ? await trigRes.json() : [];
  console.log(`Gefundene aktive Trigger Events: ${activeTrigs.length}`);

  if (activeTrigs.length > 0) {
    const trigIds = activeTrigs.map(t => t.id);

    // Delete research links
    for (const chunk of chunkArray(trigIds, 30)) {
      const idList = chunk.map(id => `"${id}"`).join(',');
      await fetch(`${url}/rest/v1/nexus_research?trigger_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_opportunity_triggers?trigger_id=in.(${idList})`, { method: 'DELETE', headers });
    }

    // Soft-delete + hard delete triggers
    console.log('Setze deleted_at für alle Trigger Events...');
    for (const chunk of chunkArray(trigIds, 30)) {
      const idList = chunk.map(id => `"${id}"`).join(',');
      const delRes = await fetch(`${url}/rest/v1/nexus_trigger_events?id=in.(${idList})`, { method: 'DELETE', headers });
      if (!delRes.ok) {
        await fetch(`${url}/rest/v1/nexus_trigger_events?id=in.(${idList})`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ deleted_at: now, status: 'archived' })
        });
      }
    }
  }

  // 3. Clear radar hits if any exist
  const hitsRes = await fetch(`${url}/rest/v1/nexus_radar_hits?select=id`, { headers });
  const hits = hitsRes.ok ? await hitsRes.json() : [];
  if (hits.length > 0) {
    console.log(`Lösche ${hits.length} Radar-Hits...`);
    await fetch(`${url}/rest/v1/nexus_radar_hits?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });
  }

  // 4. Verification Check
  console.log('\n--- VERIFIKATION ---');
  const verifyOppRes = await fetch(`${url}/rest/v1/nexus_opportunities?deleted_at=is.null&select=id`, { headers });
  const remainingOpps = verifyOppRes.ok ? await verifyOppRes.json() : [];

  const verifyTrigRes = await fetch(`${url}/rest/v1/nexus_trigger_events?deleted_at=is.null&select=id`, { headers });
  const remainingTrigs = verifyTrigRes.ok ? await verifyTrigRes.json() : [];

  console.log(`Verbleibende aktive Opportunities: ${remainingOpps.length}`);
  console.log(`Verbleibende aktive Trigger-Events: ${remainingTrigs.length}`);

  if (remainingOpps.length === 0 && remainingTrigs.length === 0) {
    console.log('\n✅ ERFOLG: Alle alten/ungültigen Leads & Triggers wurden vollständig und automatisiert aus der aktiven Pipeline entfernt!');
  } else {
    console.warn(`\n⚠️ WARNUNG: Es sind noch ${remainingOpps.length} Opps und ${remainingTrigs.length} Trigs aktiv!`);
  }
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

purgeAll().catch(err => {
  console.error('Fehler bei der Bereinigung:', err);
  process.exit(1);
});
