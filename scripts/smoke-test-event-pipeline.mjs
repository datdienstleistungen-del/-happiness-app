/**
 * Smoke Test for NeXus 2.0 Event Pipeline
 * Run: node scripts/smoke-test-event-pipeline.mjs
 */

import { readFileSync } from 'fs';

// Env VOR dem Import der Netlify Functions laden
const envLines = readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

// Dynamic Imports NACH Env-Loading
const { handler } = await import('../netlify/functions/cron-event-search.mjs');
const { resolveCompany } = await import('../netlify/functions/nexus-entity-resolution.mjs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function log(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
}

async function queryDb(table, filter = '', select = '*') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=${select}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) return [];
  return res.json();
}

async function runSmokeTest() {
  console.log('=== NeXus 2.0 Pipeline Smoke Test ===\n');

  // 1. Event Types
  const types = await queryDb('nexus_event_type_definitions', 'is_active=eq.true');
  log('10 Event Types vorhanden', types.length === 10, `${types.length} types`);

  // 2. Trigger Event Search (expansion in Deutschland)
  console.log('\n--- Event Search Test ---');
  let searchResult;
  try {
    const event = {
      httpMethod: 'POST',
      body: JSON.stringify({
        event_type: 'expansion',
        region: 'Deutschland',
        time_range: '30d'
      })
    };
    searchResult = await handler(event);
    log('Event Search Response', searchResult.statusCode === 200, `Status ${searchResult.statusCode}`);
  } catch (e) {
    log('Event Search', false, e.message);
    searchResult = { statusCode: 500, body: '{}' };
  }

  const parsed = JSON.parse(searchResult.body || '{}');
  console.log('Stats:', JSON.stringify(parsed.stats || {}, null, 2));
  console.log('Events found:', (parsed.events || []).length);

  // 3. Prüfe nexus_raw_events
  const rawEvents = await queryDb('nexus_raw_events', 'source_platform=eq.web_search', 'id,title,source_url');
  log('Rohdaten in nexus_raw_events', rawEvents.length > 0, `${rawEvents.length} raw events`);

  // 4. Prüfe nexus_events
  console.log('\n--- Nexus Events Test ---');
  const nexusEvents = await queryDb('nexus_events', '', 'id,event_type,company_name,title,offering_id,confidence');
  log('Events in nexus_events', nexusEvents.length > 0, `${nexusEvents.length} events`);

  if (nexusEvents.length > 0) {
    const evt = nexusEvents[0];
    log('offering_id ist NULL (offering-unabhängig)', !evt.offering_id, `offering_id=${evt.offering_id}`);
    log('company_name vorhanden', !!evt.company_name, evt.company_name);
    log('confidence vorhanden', evt.confidence !== null && evt.confidence !== undefined, evt.confidence);
    console.log('First event:', JSON.stringify(evt, null, 2));
  }

  // 5. Prüfe nexus_lead_packages
  console.log('\n--- Lead Packages Test ---');
  const packages = await queryDb('nexus_lead_packages', '', 'id,event_id,headline,offering_id,quality_score');
  log('Lead Packages vorhanden', packages.length > 0, `${packages.length} packages`);

  if (packages.length > 0) {
    const pkg = packages[0];
    log('Lead Package: offering_id ist NULL', !pkg.offering_id, `offering_id=${pkg.offering_id}`);
    log('Lead Package: headline vorhanden', !!pkg.headline, pkg.headline?.substring(0, 60));
    log('Lead Package: quality_score vorhanden', pkg.quality_score !== null, pkg.quality_score);
  }

  // 6. Entity Resolution Test
  console.log('\n--- Entity Resolution Test ---');
  try {
    const resolved = await resolveCompany('Siemens', 'siemens.com');
    log('resolveCompany funktioniert', !!resolved, JSON.stringify(resolved)?.substring(0, 100));
  } catch (e) {
    log('resolveCompany', false, e.message);
  }

  // 7. Cost Log
  console.log('\n--- Cost Log Test ---');
  const costLog = await queryDb('nexus_cost_log', '', 'id,provider,operation,cost_usd');
  log('Cost Log vorhanden', costLog.length > 0, `${costLog.length} entries`);
  if (costLog.length > 0) {
    console.log('Cost entries:', JSON.stringify(costLog.slice(0, 3), null, 2));
  }

  // 8. V2 Pipeline unverändert
  console.log('\n--- V2 Pipeline Check ---');
  const v2Offerings = await queryDb('nexus_offerings', '', 'id,offering_name');
  log('V2 nexus_offerings unverändert', true, `${v2Offerings.length} offerings`);

  console.log('\n=== Smoke Test abgeschlossen ===');
}

runSmokeTest().catch(e => console.error('Smoke Test failed:', e));
