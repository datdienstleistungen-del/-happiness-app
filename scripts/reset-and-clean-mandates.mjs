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

async function resetTables() {
  console.log('===============================================================');
  console.log('🧹 MANDATE DESK: WERKSEINSTELLUNG & DATENBANK-RESET');
  console.log('===============================================================\n');

  // 1. Zähle bestehende Datensätze
  const countTable = async (table) => {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?select=id`, { headers });
      if (!res.ok) return 0;
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  };

  const oppCount = await countTable('nexus_opportunities');
  const triggerCount = await countTable('nexus_trigger_events');
  const oppTrigCount = await countTable('nexus_opportunity_triggers');
  const oppContactCount = await countTable('nexus_opportunity_contacts');
  const leadPkgCount = await countTable('nexus_lead_packages');

  console.log(`Vor Bereinigung:`);
  console.log(`- nexus_opportunities: ${oppCount}`);
  console.log(`- nexus_trigger_events: ${triggerCount}`);
  console.log(`- nexus_opportunity_triggers: ${oppTrigCount}`);
  console.log(`- nexus_opportunity_contacts: ${oppContactCount}`);
  console.log(`- nexus_lead_packages: ${leadPkgCount}`);

  // 2. Lösche Fremdschlüssel-Tabellen
  console.log('\nLösche abhängige Verknüpfungstabellen...');
  await fetch(`${url}/rest/v1/nexus_opportunity_triggers?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });
  await fetch(`${url}/rest/v1/nexus_opportunity_contacts?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });
  await fetch(`${url}/rest/v1/nexus_lead_packages?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });

  // 3. Lösche nexus_opportunities
  console.log('Setze nexus_opportunities zurück...');
  const delOpp = await fetch(`${url}/rest/v1/nexus_opportunities?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });
  if (!delOpp.ok) {
    console.warn('DELETE nexus_opportunities Status:', delOpp.status, await delOpp.text());
  }

  // 4. Lösche nexus_trigger_events
  console.log('Setze nexus_trigger_events zurück...');
  const delTrig = await fetch(`${url}/rest/v1/nexus_trigger_events?id=neq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE', headers });
  if (!delTrig.ok) {
    console.warn('DELETE nexus_trigger_events Status:', delTrig.status, await delTrig.text());
  }

  // 5. Nachprüfung
  const oppCountAfter = await countTable('nexus_opportunities');
  const triggerCountAfter = await countTable('nexus_trigger_events');

  console.log('\n===============================================================');
  console.log('✅ WERKSEINSTELLUNG ABGESCHLOSSEN');
  console.log(`- nexus_opportunities: ${oppCountAfter} verbleibend`);
  console.log(`- nexus_trigger_events: ${triggerCountAfter} verbleibend`);
  console.log('Die Tabellen sind nun vollständig bereit für frische Primärquellen aus run_ingest.py (EQS, SHAB, LSE, CNMV).');
  console.log('===============================================================\n');
}

resetTables().catch(err => {
  console.error('Fehler beim Tabellen-Reset:', err);
  process.exit(1);
});
