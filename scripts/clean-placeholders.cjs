const fs = require('fs');
let envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) return;
  const idx = clean.indexOf('=');
  if (idx > -1) {
    const k = clean.slice(0, idx).trim();
    let v = clean.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const placeholderCompanyIds = [
  '39d0a3ae-02ed-46e6-9ba0-315132794c92',
  '81f1d92a-8190-4505-963b-b10a1cc9dd1c'
];

async function deleteFromTable(table, queryParam) {
  const res = await fetch(`${url}/rest/v1/${table}?${queryParam}`, {
    method: 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'return=representation'
    }
  });
  const data = await res.json().catch(() => []);
  console.log(`Deleted from ${table} (${queryParam}):`, Array.isArray(data) ? data.length : data);
}

async function cleanPlaceholders() {
  console.log('=== Cleaning placeholder data from Supabase ===');

  for (const cId of placeholderCompanyIds) {
    // 1. Delete opportunities linked to company
    await deleteFromTable('nexus_opportunities', `company_id=eq.${cId}`);

    // 2. Delete triggers linked to company
    await deleteFromTable('nexus_trigger_events', `company_id=eq.${cId}`);

    // 3. Delete contacts linked to company
    await deleteFromTable('nexus_contacts', `company_id=eq.${cId}`);

    // 4. Delete company offerings link
    await deleteFromTable('nexus_company_offerings', `company_id=eq.${cId}`);

    // 5. Delete company itself
    await deleteFromTable('nexus_companies', `id=eq.${cId}`);
  }

  // Also clean any trigger with the placeholder content
  await deleteFromTable('nexus_trigger_events', `content=ilike.*Was passiert bei dieser Stellenanzeige*`);

  // Clean scan jobs containing "Echter Firmenname" in partial_results
  const jobsRes = await fetch(`${url}/rest/v1/nexus_scan_jobs?select=id,partial_results`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const jobs = await jobsRes.json();
  for (const job of jobs) {
    const str = JSON.stringify(job.partial_results || '');
    if (str.includes('Echter Firmenname') || str.includes('Echter Firmennamen')) {
      const filteredResults = (job.partial_results || []).map(r => ({
        ...r,
        triggers: (r.triggers || []).filter(t => {
          const fn = (t.firmenname || '').toLowerCase();
          return !fn.includes('echter firmenname');
        })
      }));
      await fetch(`${url}/rest/v1/nexus_scan_jobs?id=eq.${job.id}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ partial_results: filteredResults })
      });
      console.log(`Cleaned scan job: ${job.id}`);
    }
  }

  console.log('=== Cleanup complete ===');
}

cleanPlaceholders().catch(console.error);
