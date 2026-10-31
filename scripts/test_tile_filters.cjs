const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/research/continuous_radar_events.json', 'utf8'));
const events = data.events;

const RADAR_CATEGORY_MAP = {
  organ_vakanz: ['c_level_vakanz', 'c_level_vakanz_ch', 'organ_vakanz'],
  restrukturierung_cro: ['unternehmenskrise_restrukturierung', 'insolvenzantrag_eigenverwaltung', 'transformation_sanierung', 'restrukturierung_cro'],
  not_governance_ar: ['not_governance_ar', 'unternehmenskrise_restrukturierung'],
  m_and_a_board: ['fusion_uebernahme_unternehmensverkauf', 'm_and_a_board'],
  carveout_pe: ['carveout_pe', 'fusion_uebernahme_unternehmensverkauf'],
  finanz_sondersituation: ['finanzierung_anleihen_restrukturierung', 'finanz_sondersituation']
};

const regions = ['EU_UK', 'DACH', 'UK_IRL', 'WEST_EU', 'SOUTH_EU'];

console.log('=== MATCH TEST ACROSS 6 TILES & 5 REGIONS (29 events total) ===');
for (const [tileKey, cats] of Object.entries(RADAR_CATEGORY_MAP)) {
  console.log('\nTILE: ' + tileKey);
  for (const reg of regions) {
    const matched = events.filter(e => {
      const catMatch = cats.includes(e.category);
      const c = (e.country || 'DE').toUpperCase();
      let regMatch = true;
      if (reg === 'DACH') regMatch = ['DE', 'AT', 'CH'].includes(c);
      else if (reg === 'UK_IRL') regMatch = ['UK', 'GB', 'IE'].includes(c);
      else if (reg === 'WEST_EU') regMatch = ['FR', 'BE', 'NL', 'LU'].includes(c);
      else if (reg === 'SOUTH_EU') regMatch = ['ES', 'IT', 'PT'].includes(c);
      return catMatch && regMatch;
    });
    console.log('  Region ' + reg.padEnd(10) + ': ' + matched.length + ' matched');
  }
}
