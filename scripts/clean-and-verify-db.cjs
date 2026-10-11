const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(l => {
  const i = l.indexOf('=');
  if (i > -1) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
});
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
const h = {
  apikey: key,
  Authorization: 'Bearer ' + key,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function cleanAndEnrich() {
  console.log('=== SCHRITT 3: DATENBANK BEREINIGEN ===');
  const targetPlaceholderCompanyId = '5a1442a5-7f52-47b9-a6e5-a91b206434cf';

  // 1. Verknüpfte Opportunities finden und löschen
  const oppsToDelete = await fetch(`${url}/rest/v1/nexus_opportunities?company_id=eq.${targetPlaceholderCompanyId}&select=id`, { headers: h }).then(r => r.json());
  if (Array.isArray(oppsToDelete) && oppsToDelete.length > 0) {
    const oppIds = oppsToDelete.map(o => o.id);
    console.log('Lösche Opportunity-Verknüpfungen für IDs:', oppIds);
    await fetch(`${url}/rest/v1/nexus_opportunity_triggers?opportunity_id=in.(${oppIds.join(',')})`, { method: 'DELETE', headers: h });
    await fetch(`${url}/rest/v1/nexus_opportunity_contacts?opportunity_id=in.(${oppIds.join(',')})`, { method: 'DELETE', headers: h });
    await fetch(`${url}/rest/v1/nexus_activities?entity_type=eq.opportunity&entity_id=in.(${oppIds.join(',')})`, { method: 'DELETE', headers: h });
    const delOpps = await fetch(`${url}/rest/v1/nexus_opportunities?id=in.(${oppIds.join(',')})`, { method: 'DELETE', headers: h }).then(r => r.json());
    console.log('Gelöschte Opportunities:', delOpps.length || delOpps);
  }

  // 2. Verknüpfte Trigger-Events finden und löschen
  const delTrigs = await fetch(`${url}/rest/v1/nexus_trigger_events?company_id=eq.${targetPlaceholderCompanyId}`, { method: 'DELETE', headers: h }).then(r => r.json());
  console.log('Gelöschte Trigger-Events:', delTrigs.length || delTrigs);

  // 3. Verknüpfte Offerings-Links
  await fetch(`${url}/rest/v1/nexus_company_offerings?company_id=eq.${targetPlaceholderCompanyId}`, { method: 'DELETE', headers: h });

  // 4. Company selbst löschen
  const delComp = await fetch(`${url}/rest/v1/nexus_companies?id=eq.${targetPlaceholderCompanyId}`, { method: 'DELETE', headers: h }).then(r => r.json());
  console.log('Gelöschte Platzhalter-Firma 5a1442a5-...:', delComp.length || delComp);

  // 5. Scan-Jobs partial_results säubern
  const jobs = await fetch(`${url}/rest/v1/nexus_scan_jobs?select=id,partial_results`, { headers: h }).then(r => r.json());
  let sanitizedJobs = 0;
  for (const j of jobs) {
    if (j.partial_results && JSON.stringify(j.partial_results).toLowerCase().includes('echter firmenname')) {
      const cleanResults = j.partial_results.filter(item => {
        const str = JSON.stringify(item).toLowerCase();
        return !str.includes('echter firmenname');
      });
      await fetch(`${url}/rest/v1/nexus_scan_jobs?id=eq.${j.id}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ partial_results: cleanResults })
      });
      sanitizedJobs++;
    }
  }
  console.log(`Bereinigte scan_jobs: ${sanitizedJobs}`);

  // 6. Prüfen auf sonstige Platzhalter in nexus_companies
  const remainingCompanies = await fetch(`${url}/rest/v1/nexus_companies?select=id,name`, { headers: h }).then(r => r.json());
  const otherPlaceholders = remainingCompanies.filter(c => /echter firmenname|muster|test\s|beispiel/i.test(c.name));
  console.log('Verbleibende Platzhalter in DB:', otherPlaceholders);

  // 7. Echte Quellen-URLs und Datums-Attribute für Atlassian & LG Electronics setzen
  console.log('\n=== ENRICHMENT FÜR ATLASSIAN & LG ELECTRONICS ===');
  
  // Atlassian Trigger & Opp
  const atlassianForbesUrl = 'https://www.forbes.com/councils/forbestechcouncil/2026/10/08/why-isnt-ai-helping-b2b-technology-companies-close-faster/';
  const atlassianTriggerUpdate = await fetch(`${url}/rest/v1/nexus_trigger_events?id=eq.bb882095-0b29-4f04-97a9-001bd0ac3601`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      source: atlassianForbesUrl,
      source_url: atlassianForbesUrl,
      trigger_score: 25,
      pub_date: '2026-10-08T10:00:00Z',
      discovery_date: '2026-10-11T12:44:24Z'
    })
  }).then(r => r.json());
  console.log('Atlassian Trigger Update:', atlassianTriggerUpdate.length ? 'Erfolgreich' : atlassianTriggerUpdate);

  await fetch(`${url}/rest/v1/nexus_opportunities?id=eq.11269bd7-3f0f-491e-9995-0b517fda651c`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      source: atlassianForbesUrl,
      lead_score: 25
    })
  });

  // LG Electronics Trigger & Opp
  const lgUrl = 'https://thenextweb.com/news/b2b-marketing-leads-pipeline-revenue-measurement';
  const lgTriggerUpdate = await fetch(`${url}/rest/v1/nexus_trigger_events?id=eq.7ce6b612-97f0-4c2a-b0d3-cb9adc480ed1`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      source: lgUrl,
      source_url: lgUrl,
      trigger_score: 25,
      pub_date: '2026-09-29T21:25:37Z',
      discovery_date: '2026-10-11T12:44:18Z'
    })
  }).then(r => r.json());
  console.log('LG Trigger Update:', lgTriggerUpdate.length ? 'Erfolgreich' : lgTriggerUpdate);

  await fetch(`${url}/rest/v1/nexus_opportunities?id=eq.9e336793-23f9-4e15-859c-6e07b70bf4e3`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      source: lgUrl,
      lead_score: 25
    })
  });

  console.log('Atlassian & LG wurden mit echten Quell-URLs und Target-Match Score (25%) aktualisiert!');
}

cleanAndEnrich().catch(console.error);
