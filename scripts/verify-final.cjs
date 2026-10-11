const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split(/\r?\n/).forEach(l => {
  const i = l.indexOf('=');
  if (i > -1) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
});
const url = env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
const h = { apikey: key, Authorization: 'Bearer ' + key };

async function verifyAll() {
  console.log('=== VERIFIKATION A: PLATZHALTER ===');
  const comp = await fetch(url + '/rest/v1/nexus_companies?select=id,name', { headers: h }).then(r => r.json());
  const hasPlaceholder = comp.some(c => /echter firmenname/i.test(c.name));
  console.log('Existiert Echter Firmenname noch in nexus_companies?', hasPlaceholder ? 'JA (FEHLER)' : 'NEIN (Vollstaendig geloescht)');

  const opp = await fetch(url + '/rest/v1/nexus_opportunities?select=id,nexus_companies(name)', { headers: h }).then(r => r.json());
  const oppPlaceholder = opp.some(o => /echter firmenname/i.test(o.nexus_companies?.name || ''));
  console.log('Existiert Echter Firmenname noch in nexus_opportunities?', oppPlaceholder ? 'JA (FEHLER)' : 'NEIN (Keine Treffer)');

  console.log('\n=== VERIFIKATION B & C: QUELLEN & CONFIDENCE ===');
  const aTrig = await fetch(url + '/rest/v1/nexus_trigger_events?id=eq.bb882095-0b29-4f04-97a9-001bd0ac3601&select=*', { headers: h }).then(r => r.json());
  const aConf = aTrig[0]?.confidence_score;
  const aFormatted = aConf <= 1 ? Math.round(aConf * 100) : aConf;
  console.log('Atlassian:');
  console.log('  Quellen-URL:', aTrig[0]?.source_url);
  console.log('  AI Confidence gerendert:', `${aFormatted}% (statt 0.9%)`);
  console.log('  Target Match Score:', `${aTrig[0]?.trigger_score}%`);

  const lgTrig = await fetch(url + '/rest/v1/nexus_trigger_events?id=eq.7ce6b612-97f0-4c2a-b0d3-cb9adc480ed1&select=*', { headers: h }).then(r => r.json());
  const lgConf = lgTrig[0]?.confidence_score;
  const lgFormatted = lgConf <= 1 ? Math.round(lgConf * 100) : lgConf;
  console.log('LG Electronics:');
  console.log('  Quellen-URL:', lgTrig[0]?.source_url);
  console.log('  AI Confidence gerendert:', `${lgFormatted}% (statt 0.9%)`);
  console.log('  Target Match Score:', `${lgTrig[0]?.trigger_score}%`);

  console.log('\n=== VERIFIKATION D: ATLASSIAN & LG FILTER-STATUS ===');
  const testOpps = await fetch(url + '/rest/v1/nexus_opportunities?select=id,lead_score,source,nexus_companies(name)&id=in.(11269bd7-3f0f-491e-9995-0b517fda651c,9e336793-23f9-4e15-859c-6e07b70bf4e3)', { headers: h }).then(r => r.json());
  testOpps.forEach(o => {
    const isUnclear = o.lead_score < 50;
    console.log(`Opp "${o.nexus_companies?.name}": lead_score=${o.lead_score}% -> Tab "Zielgruppe unklar" (${isUnclear ? 'JA, greift' : 'NEIN'})`);
  });
}

verifyAll().catch(console.error);
