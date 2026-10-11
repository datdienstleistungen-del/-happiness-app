const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(line => {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) return;
  const idx = clean.indexOf('=');
  if (idx > -1) env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
});
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
const h = { apikey: key, Authorization: 'Bearer ' + key };

async function investigate() {
  console.log('====================================================');
  console.log('1. DEPLOY-STATUS');
  console.log('====================================================');
  // Check local git vs remote
  const { execSync } = require('child_process');
  const localHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const originMain = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();
  const statusShort = execSync('git status -s', { encoding: 'utf8' }).trim();
  console.log('Local HEAD:   ', localHead);
  console.log('origin/main:  ', originMain);
  console.log('Local status: ', statusShort ? 'Uncommitted changes present!' : 'Clean');
  console.log('Uncommitted files:\n' + statusShort);

  // Check Netlify live headers / commits
  try {
    const netlifyRes = await fetch('https://nexus-hit.netlify.app/');
    console.log('Netlify HTTP Status:', netlifyRes.status);
    console.log('Netlify x-nf-request-id:', netlifyRes.headers.get('x-nf-request-id'));
    console.log('Netlify etag:', netlifyRes.headers.get('etag'));
    console.log('Netlify date:', netlifyRes.headers.get('date'));
    const html = await netlifyRes.text();
    // find script tags
    const scripts = html.match(/\/assets\/[A-Za-z0-9_-]+\.js/g) || [];
    console.log('Live assets loaded by HTML:', scripts);
    
    // Check if live has recent commits or old commits by checking an asset
    if (scripts.length > 0) {
      const assetUrl = 'https://nexus-hit.netlify.app' + scripts[0];
      const assetRes = await fetch(assetUrl);
      const assetJs = await assetRes.text();
      console.log('Asset sample contains "isPlaceholderCompany"?', assetJs.includes('isPlaceholderCompany'));
      console.log('Asset sample contains "target_group_match"?', assetJs.includes('target_group_match'));
    }
  } catch (e) {
    console.error('Error fetching Netlify:', e.message);
  }

  console.log('\n====================================================');
  console.log('2. DATENBANK-STATUS');
  console.log('====================================================');
  // Total counts
  const cCount = await fetch(url + '/rest/v1/nexus_companies?select=count', { headers: { ...h, Prefer: 'count=exact' } }).then(r => r.headers.get('content-range'));
  const oCount = await fetch(url + '/rest/v1/nexus_opportunities?select=count', { headers: { ...h, Prefer: 'count=exact' } }).then(r => r.headers.get('content-range'));
  const tCount = await fetch(url + '/rest/v1/nexus_trigger_events?select=count', { headers: { ...h, Prefer: 'count=exact' } }).then(r => r.headers.get('content-range'));
  console.log('Anzahl nexus_companies:      ', cCount);
  console.log('Anzahl nexus_opportunities:  ', oCount);
  console.log('Anzahl nexus_trigger_events: ', tCount);

  // Search for "Echter Firmenname" and similar placeholders
  const allCompanies = await fetch(url + '/rest/v1/nexus_companies?select=id,name,created_at&limit=500', { headers: h }).then(r => r.json());
  const placeholders = allCompanies.filter(c => /echter firmenname|muster|test|beispiel/i.test(c.name));
  console.log('Platzhalter in nexus_companies:', placeholders);

  // Search opportunities for placeholder names
  const allOpps = await fetch(url + '/rest/v1/nexus_opportunities?select=id,company_id,pipeline_stage,lead_score,source,created_at,nexus_companies(name)&limit=500', { headers: h }).then(r => r.json());
  const placeholderOpps = allOpps.filter(o => /echter firmenname|muster|test|beispiel/i.test(o.nexus_companies?.name || ''));
  console.log('Platzhalter in nexus_opportunities:', placeholderOpps);

  console.log('\n====================================================');
  console.log('3. QUELLEN-STATUS: ATLASSIAN & LG ELECTRONICS');
  console.log('====================================================');
  const atlassianComp = allCompanies.filter(c => /atlassian/i.test(c.name));
  const lgComp = allCompanies.filter(c => /lg/i.test(c.name));
  console.log('Atlassian Company records:', atlassianComp);
  console.log('LG Company records:', lgComp);

  const atlassianOpps = allOpps.filter(o => /atlassian/i.test(o.nexus_companies?.name || ''));
  const lgOpps = allOpps.filter(o => /lg/i.test(o.nexus_companies?.name || ''));
  console.log('Atlassian Opportunities:', JSON.stringify(atlassianOpps, null, 2));
  console.log('LG Opportunities:', JSON.stringify(lgOpps, null, 2));

  // Fetch triggers linked to Atlassian / LG
  const compIds = [...atlassianComp.map(c => c.id), ...lgComp.map(c => c.id)];
  if (compIds.length > 0) {
    const trigs = await fetch(url + `/rest/v1/nexus_trigger_events?company_id=in.(${compIds.join(',')})&select=*`, { headers: h }).then(r => r.json());
    console.log('Trigger events for Atlassian & LG:', JSON.stringify(trigs, null, 2));

    // Also check nexus_opportunity_triggers
    const oppIds = [...atlassianOpps.map(o => o.id), ...lgOpps.map(o => o.id)];
    if (oppIds.length > 0) {
      const oppTrigs = await fetch(url + `/rest/v1/nexus_opportunity_triggers?opportunity_id=in.(${oppIds.join(',')})&select=*,nexus_trigger_events(*)`, { headers: h }).then(r => r.json());
      console.log('Opportunity-Triggers M:N for Atlassian & LG:', JSON.stringify(oppTrigs, null, 2));
    }
  }

  // Check radar hits matching atlassian / lg
  const allHits = await fetch(url + '/rest/v1/nexus_radar_hits?select=*&limit=500', { headers: h }).then(r => r.json());
  const atlassianHits = allHits.filter(h => JSON.stringify(h).toLowerCase().includes('atlassian'));
  const lgHits = allHits.filter(h => JSON.stringify(h).toLowerCase().includes('lg'));
  console.log('Radar Hits matching Atlassian:', atlassianHits.map(h => ({ id: h.id, url: h.url, title: h.title, source: h.source, created_at: h.created_at })));
  console.log('Radar Hits matching LG:', lgHits.map(h => ({ id: h.id, url: h.url, title: h.title, source: h.source, created_at: h.created_at })));

  console.log('\n====================================================');
  console.log('4. CONFIDENCE-STATUS: Woher kommt "AI Confidence: 0.9%"?');
  console.log('====================================================');
  // Check how confidence_score is stored in nexus_trigger_events and nexus_companies
  const sampleTriggersWithConfidence = await fetch(url + '/rest/v1/nexus_trigger_events?select=id,confidence_score,created_at&limit=10', { headers: h }).then(r => r.json());
  console.log('Sample trigger confidence_score in DB:', sampleTriggersWithConfidence);

  console.log('\n====================================================');
  console.log('5. FILTER-STATUS');
  console.log('====================================================');
  console.log('Atlassian opp lead_score / trigger score:');
  atlassianOpps.forEach(o => console.log(`Opp ID ${o.id}: lead_score = ${o.lead_score}, source = ${o.source}`));
  lgOpps.forEach(o => console.log(`Opp ID ${o.id}: lead_score = ${o.lead_score}, source = ${o.source}`));
}

investigate().catch(console.error);
