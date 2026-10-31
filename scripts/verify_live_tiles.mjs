import https from 'https';

const RADAR_CATEGORY_MAP = {
  organ_vakanz: ['c_level_vakanz', 'c_level_vakanz_ch', 'organ_vakanz'],
  restrukturierung_cro: ['unternehmenskrise_restrukturierung', 'insolvenzantrag_eigenverwaltung', 'transformation_sanierung', 'restrukturierung_cro'],
  not_governance_ar: ['not_governance_ar', 'unternehmenskrise_restrukturierung'],
  m_and_a_board: ['fusion_uebernahme_unternehmensverkauf', 'm_and_a_board'],
  carveout_pe: ['carveout_pe', 'fusion_uebernahme_unternehmensverkauf'],
  finanz_sondersituation: ['finanzierung_anleihen_restrukturierung', 'finanz_sondersituation']
};

const TILES = [
  { id: 'organ_vakanz', label: 'C-Level & Organ-Vakanz' },
  { id: 'restrukturierung_cro', label: 'Restrukturierung & CRO' },
  { id: 'not_governance_ar', label: 'Not-Governance & Aufsichtsrat' },
  { id: 'm_and_a_board', label: 'M&A & Distressed Debt' },
  { id: 'carveout_pe', label: 'Carve-Out & PE-HoldCo' },
  { id: 'finanz_sondersituation', label: 'Finanz-Sondersituation' }
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching live events from https://nexus-hit.netlify.app/data/continuous_radar_events.json ...');
  const payload = await fetchJson('https://nexus-hit.netlify.app/data/continuous_radar_events.json');
  const events = payload.events || [];
  console.log(`Successfully retrieved ${events.length} verified events from live Netlify CDN.`);
  console.log(`Generated at: ${payload.generated_at}`);
  console.log('---------------------------------------------------------------------------------');

  for (const tile of TILES) {
    const cats = RADAR_CATEGORY_MAP[tile.id] || [];
    const matched = events.filter(e => cats.includes(e.category));
    const dachMatches = matched.filter(e => ['DE', 'AT', 'CH'].includes((e.country || 'DE').toUpperCase()));
    const plausibelCount = matched.filter(e => e.reality_check?.status === 'MANDAT_PLAUSIBEL').length;
    const beobachtenCount = matched.filter(e => e.reality_check?.status === 'BEOBACHTEN').length;
    const belegtCount = matched.filter(e => e.reality_check?.status === 'MANDAT_BELEGT').length;

    console.log(`[TILE] ${tile.label} (${tile.id}):`);
    console.log(`  -> Treffer Gesamt (Europa):  ${matched.length}`);
    console.log(`  -> Treffer DACH:             ${dachMatches.length}`);
    console.log(`  -> Mandate Reality Check:    ${belegtCount} BELEGT | ${plausibelCount} PLAUSIBEL | ${beobachtenCount} BEOBACHTEN`);
    if (matched.length > 0) {
      console.log(`  -> Beispiel-Signal:          "${matched[0].company_name}" (${matched[0].category}) - ${matched[0].reality_check?.target_role_label || matched[0].reality_check?.status}`);
    }
    console.log('---------------------------------------------------------------------------------');
  }

  console.log('Fetching live history from https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?view=history ...');
  const historyPayload = await fetchJson('https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?view=history');
  console.log(`History Runs: ${historyPayload.runs?.length || 0}`);
  console.log(`Latest Run:   ${historyPayload.latest_run?.run_id} (${historyPayload.latest_run?.status}, ${historyPayload.latest_run?.duration_seconds}s, ${historyPayload.latest_run?.new_events_count} new events)`);
}

run().catch(console.error);
