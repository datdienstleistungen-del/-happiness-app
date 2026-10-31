import https from 'https';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.slice(0, 200) });
        }
      });
    }).on('error', reject);
  });
}

async function verifyLive() {
  console.log('=== NETLIFY LIVE ACCEPTANCE AUDIT ===\n');

  // 1. Static continuous_radar_events.json
  const staticEvents = await fetchJson('https://nexus-hit.netlify.app/data/continuous_radar_events.json');
  console.log('1. Static Events: Status', staticEvents.status, '| Total count:', staticEvents.data?.events?.length);
  
  const events = staticEvents.data?.events || [];
  const hotEvents = events.filter(e => e.freshness_category === 'HOT_FIRST_MOVER');
  const monitoringEvents = events.filter(e => e.freshness_category === 'MONITORING');
  const archiveEvents = events.filter(e => e.freshness_category === 'ARCHIVE');
  console.log('   - HOT_FIRST_MOVER:', hotEvents.length);
  console.log('   - MONITORING:     ', monitoringEvents.length);
  console.log('   - ARCHIVE:        ', archiveEvents.length);

  // Check PAUL Tech AG
  const paul = events.find(e => e.company_name?.includes('PAUL Tech'));
  console.log('\n2. Case PAUL Tech AG:');
  console.log('   - Freshness:', paul?.freshness_category, `(${paul?.age_days}d)`);
  console.log('   - Status:', paul?.reality_check?.status);
  console.log('   - Target Role:', paul?.reality_check?.target_role);
  console.log('   - Mandate Priority:', paul?.mandate_priority);

  // Check ABO Energy
  const abo = events.find(e => e.company_name?.includes('ABO Energy'));
  console.log('\n3. Case ABO Energy:');
  console.log('   - Freshness:', abo?.freshness_category, `(${abo?.age_days}d)`);
  console.log('   - Status:', abo?.reality_check?.status);
  console.log('   - Target Role:', abo?.reality_check?.target_role);
  console.log('   - Counter Indicators:', abo?.reality_check?.counter_indicators?.[0]);

  // Check Wohnstift Innblick
  const wohn = events.find(e => e.company_name?.includes('Wohnstift Innblick'));
  console.log('\n4. Case Wohnstift Innblick:');
  console.log('   - Freshness:', wohn?.freshness_category, `(${wohn?.age_days}d)`);
  console.log('   - Status:', wohn?.reality_check?.status);
  console.log('   - Advisor Mandated Flag:', wohn?.is_advisor_mandated);
  console.log('   - Counter Indicators:', wohn?.reality_check?.counter_indicators);

  // Check DEAG
  const deag = events.find(e => e.company_name?.includes('DEAG'));
  console.log('\n5. Case DEAG Deutsche Entertainment:');
  console.log('   - Status:', deag?.reality_check?.status);
  console.log('   - Target Role:', deag?.reality_check?.target_role);

  // 6. Netlify Function with Freshness Filter
  const fnHot = await fetchJson('https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?freshness=HOT');
  console.log('\n6. Netlify Function (?freshness=HOT):');
  console.log('   - Status:', fnHot.status);
  console.log('   - Returned events count:', fnHot.data?.events?.length);
  const fnHotAllHot = fnHot.data?.events?.every(e => e.freshness_category === 'HOT_FIRST_MOVER');
  console.log('   - All returned items are HOT_FIRST_MOVER:', fnHotAllHot);

  const fnArchive = await fetchJson('https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?freshness=ARCHIVE');
  console.log('\n7. Netlify Function (?freshness=ARCHIVE):');
  console.log('   - Status:', fnArchive.status);
  console.log('   - Returned events count:', fnArchive.data?.events?.length);
  const fnArchiveAllArchive = fnArchive.data?.events?.every(e => e.freshness_category === 'ARCHIVE');
  console.log('   - All returned items are ARCHIVE:', fnArchiveAllArchive);
}

verifyLive();
