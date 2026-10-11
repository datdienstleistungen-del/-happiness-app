const fs = require('fs');

async function main() {
  console.log('=== 1. DEPLOY-STATUS ===');
  try {
    const res = await fetch('https://nexus-hit.netlify.app/');
    const html = await res.text();
    const liveWorkspaceMatch = html.match(/assets\/SalesWorkspacePage-([A-Za-z0-9_-]+)\.js/);
    const liveRadarMatch = html.match(/assets\/NexusLeadRadarPage-([A-Za-z0-9_-]+)\.js/);
    console.log('Live SalesWorkspacePage hash:', liveWorkspaceMatch ? liveWorkspaceMatch[1] : 'not found in root HTML');
    console.log('Live NexusLeadRadarPage hash:', liveRadarMatch ? liveRadarMatch[1] : 'not found in root HTML');

    // Check git commits
    const { execSync } = require('child_process');
    const localCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const gitStatus = execSync('git status -s', { encoding: 'utf8' }).trim();
    console.log('Local HEAD commit:', localCommit);
    console.log('Local uncommitted changes count:', gitStatus.split('\n').filter(Boolean).length);
    console.log('Uncommitted files:\n' + gitStatus);
  } catch (e) {
    console.error('Error checking deploy status:', e.message);
  }

  console.log('\n=== 2. DATENBANK-STATUS ===');
  const envContent = fs.readFileSync('.env', 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const idx = clean.indexOf('=');
    if (idx > -1) {
      env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
    }
  });

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  console.log('Using Supabase URL:', supabaseUrl);
  console.log('Using Key prefix:', supabaseKey ? supabaseKey.slice(0, 15) + '...' : 'none');
  const headers = { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey };


  // Fetch all companies
  const compRes = await fetch(`${supabaseUrl}/rest/v1/nexus_companies?select=id,name,domain,created_at`, { headers });
  const companies = await compRes.json();
  console.log('Anzahl nexus_companies:', companies.length);
  const placeholders = companies.filter(c => /echter firmenname|muster|test/i.test(c.name));
  console.log('Gefundene Platzhalter-Firmen:', placeholders);
  console.log('Alle Firmen in nexus_companies:', companies.map(c => ({ id: c.id, name: c.name })));

  // Fetch opportunities
  const oppRes = await fetch(`${supabaseUrl}/rest/v1/nexus_opportunities?select=id,company_id,pipeline_stage,lead_score,source,created_at,nexus_companies(name)`, { headers });
  const opportunities = await oppRes.json();
  console.log('Anzahl nexus_opportunities:', opportunities.length);
  console.log('Opportunities Details:', JSON.stringify(opportunities, null, 2));

  // Fetch trigger events
  const trigRes = await fetch(`${supabaseUrl}/rest/v1/nexus_trigger_events?select=*`, { headers });
  const triggers = await trigRes.json();
  if (Array.isArray(triggers)) {
    console.log('Anzahl nexus_trigger_events:', triggers.length);
    console.log('Trigger Events Details:', JSON.stringify(triggers, null, 2));
  } else {
    console.log('nexus_trigger_events Response:', triggers);
  }

  // Check if nexus_events exists!
  const eventsRes = await fetch(`${supabaseUrl}/rest/v1/nexus_events?select=*`, { headers });
  const events = await eventsRes.json();
  if (Array.isArray(events)) {
    console.log('Anzahl nexus_events:', events.length);
    console.log('nexus_events Details:', JSON.stringify(events, null, 2));
  } else {
    console.log('nexus_events Response:', events);
  }

  // Fetch radar hits
  const hitRes = await fetch(`${supabaseUrl}/rest/v1/nexus_radar_hits?select=*`, { headers });
  const hits = await hitRes.json();
  if (Array.isArray(hits)) {
    console.log('Anzahl nexus_radar_hits:', hits.length);
    console.log('Radar Hits:', JSON.stringify(hits, null, 2));
  } else {
    console.log('nexus_radar_hits Response:', hits);
  }

  // Fetch scan jobs
  const jobRes = await fetch(`${supabaseUrl}/rest/v1/nexus_scan_jobs?select=*&limit=10`, { headers });
  const jobs = await jobRes.json();
  if (Array.isArray(jobs)) {
    console.log('Anzahl nexus_scan_jobs:', jobs.length);
    jobs.forEach(j => {
      console.log(`Job ${j.id} status=${j.status} query=${j.target_query}`);
      if (j.partial_results) {
        console.log(`Job ${j.id} partial_results preview:`, JSON.stringify(j.partial_results).slice(0, 300));
      }
    });
  } else {
    console.log('nexus_scan_jobs Response:', jobs);
  }

  // Also check raw_events if exists
  const rawEventsRes = await fetch(`${supabaseUrl}/rest/v1/nexus_raw_events?select=*&limit=10`, { headers });
  const rawEvents = await rawEventsRes.json();
  if (Array.isArray(rawEvents)) {
    console.log('Anzahl nexus_raw_events:', rawEvents.length);
    console.log('raw_events:', JSON.stringify(rawEvents, null, 2));
  } else {
    console.log('nexus_raw_events Response:', rawEvents);
  }

  console.log('\n=== 3. QUELLEN-STATUS & 4. CONFIDENCE & 5. FILTER ===');
  // Check users table or auth
  const authUsersRes = await fetch(`${supabaseUrl}/rest/v1/nexus_users?select=*`, { headers });
  const nUsers = await authUsersRes.json();
  console.log('nexus_users count:', Array.isArray(nUsers) ? nUsers.length : nUsers);

  // Search everywhere for Atlassian and LG Electronics
  console.log('Searching for Atlassian and LG across all data...');
  const searchStr = (obj) => JSON.stringify(obj || '').toLowerCase();
  
  if (Array.isArray(companies)) {
    console.log('Companies matching Atlassian/LG:', companies.filter(c => searchStr(c).includes('atlassian') || searchStr(c).includes('lg')));
  }
  if (Array.isArray(opportunities)) {
    console.log('Opportunities matching Atlassian/LG:', opportunities.filter(o => searchStr(o).includes('atlassian') || searchStr(o).includes('lg')));
  }
  if (Array.isArray(triggers)) {
    console.log('Triggers matching Atlassian/LG:', triggers.filter(t => searchStr(t).includes('atlassian') || searchStr(t).includes('lg')));
  }
  if (Array.isArray(hits)) {
    console.log('Hits matching Atlassian/LG:', hits.filter(h => searchStr(h).includes('atlassian') || searchStr(h).includes('lg')));
  }
  if (Array.isArray(jobs)) {
    console.log('Jobs matching Atlassian/LG:', jobs.filter(j => searchStr(j).includes('atlassian') || searchStr(j).includes('lg')));
  }
}

main().catch(console.error);

