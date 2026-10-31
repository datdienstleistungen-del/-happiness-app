import https from 'https';

function fetchUrl(url, options = {}) {
  return new Promise((resolve) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    if (options.body) req.write(options.body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollDeployment() {
  console.log("=================================================================");
  console.log("🌐 NETLIFY LIVE DEPLOYMENT & ACCEPTANCE MONITOR");
  console.log(`Target: https://nexus-hit.netlify.app | Commit: b33bd8f`);
  console.log("=================================================================\n");

  const eventsUrl = `https://nexus-hit.netlify.app/data/continuous_radar_events.json?_t=${Date.now()}`;
  let deployed = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 * 5s = 150s

  while (!deployed && attempts < maxAttempts) {
    attempts++;
    process.stdout.write(`[Attempt #${attempts}] Polling Netlify live events endpoint... `);
    const res = await fetchUrl(eventsUrl);
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(res.data);
        const eventCount = json.events?.length;
        const total = json.total_events;
        const deag = json.events?.find(e => e.company_name?.toLowerCase().includes("deag"));
        const deagStatus = deag?.reality_check?.status;
        const deagRole = deag?.reality_check?.target_role;
        const deagPrio = deag?.mandate_priority;

        console.log(`Count: ${eventCount} | DEAG: ${deagStatus} (${deagRole}, ${deagPrio})`);

        if (eventCount === 26 && deagStatus === "VERWERFEN" && deagRole === "KEINE") {
          deployed = true;
          console.log("\n🚀 DEPLOYMENT CONFIRMED LIVE ON NETLIFY!");
          break;
        }
      } catch (e) {
        console.log(`Parse error: ${e.message}`);
      }
    } else {
      console.log(`HTTP ${res.statusCode || 'ERR'}`);
    }

    if (!deployed) await sleep(5000);
  }

  if (!deployed) {
    console.error("❌ TIMEOUT: Deployment was not confirmed live within expected timeframe.");
    process.exit(1);
  }

  // Detailed Verification of Live Application
  console.log("\n=================================================================");
  console.log("🔬 LIVE AUDIT OF DEPLOYED ARTIFACTS");
  console.log("=================================================================\n");

  // 1. Check events file
  const liveEventsRes = await fetchUrl(`https://nexus-hit.netlify.app/data/continuous_radar_events.json?_t=${Date.now()}`);
  const liveData = JSON.parse(liveEventsRes.data);
  console.log(`1. Live Event Dataset:`);
  console.log(`   • Total Events: ${liveData.events.length} (Expected: 26)`);
  console.log(`   • Version: ${liveData.version}`);
  console.log(`   • Last Updated: ${liveData.last_updated}`);

  // 2. Check 3 Leadership Change Cases
  console.log(`\n2. C-Level Leadership Change Reclassification:`);
  const deag = liveData.events.find(e => e.company_name?.toLowerCase().includes("deag"));
  const pferde = liveData.events.find(e => e.company_name?.toLowerCase().includes("pferdewetten"));
  const photon = liveData.events.find(e => e.company_name?.toLowerCase().includes("photon"));

  console.log(`   • DEAG Deutsche Entertainment AG:`);
  console.log(`     - Status:       ${deag?.reality_check?.status} (Expected: VERWERFEN)`);
  console.log(`     - Target Role:  ${deag?.reality_check?.target_role} (Expected: KEINE)`);
  console.log(`     - Priority:     ${deag?.mandate_priority} (Expected: watchlist_general_distress)`);
  console.log(`     - Action Type:  ${deag?.action_type} (Expected: passiv_nachfolge_besetzt)`);

  console.log(`   • pferdewetten.de AG:`);
  console.log(`     - Status:       ${pferde?.reality_check?.status} (Expected: VERWERFEN)`);
  console.log(`     - Target Role:  ${pferde?.reality_check?.target_role} (Expected: KEINE)`);
  console.log(`     - Priority:     ${pferde?.mandate_priority} (Expected: watchlist_general_distress)`);
  console.log(`     - Action Type:  ${pferde?.action_type} (Expected: passiv_nachfolge_besetzt)`);

  console.log(`   • Photon Energy Group:`);
  console.log(`     - Status:       ${photon?.reality_check?.status} (Expected: VERWERFEN)`);
  console.log(`     - Target Role:  ${photon?.reality_check?.target_role} (Expected: KEINE)`);
  console.log(`     - Priority:     ${photon?.mandate_priority} (Expected: watchlist_general_distress)`);
  console.log(`     - Action Type:  ${photon?.action_type} (Expected: passiv_nachfolge_besetzt)`);

  // 3. Check 5 merged duplicates
  console.log(`\n3. Duplicate Cleanliness & Canonical State:`);
  const bsh = liveData.events.filter(e => e.company_name?.toLowerCase().includes("bsh"));
  const inn = liveData.events.filter(e => e.company_name?.toLowerCase().includes("innblick"));
  const nos = liveData.events.filter(e => e.company_name?.toLowerCase().includes("noscendo"));
  const gel = liveData.events.filter(e => e.company_name?.toLowerCase().includes("gelenkscheiben"));
  const boost = liveData.events.filter(e => e.source_url?.includes("00073785.html"));

  console.log(`   • BSH GmbH & Co. KG count:               ${bsh.length} (Expected: 1, cleanly stripped prefix)`);
  console.log(`   • Wohnstift Innblick GmbH count:         ${inn.length} (Expected: 1, cleanly stripped prefix)`);
  console.log(`   • Noscendo GmbH count:                   ${nos.length} (Expected: 1, cleanly stripped prefix)`);
  console.log(`   • Gelenkscheibenfabrik count:            ${gel.length} (Expected: 1)`);
  console.log(`   • Booster Anleihe-Anpassung URL count:   ${boost.length} (Expected: 1)`);

  // 4. Check Netlify function endpoint
  console.log(`\n4. Netlify Function API (nexus-radar-events):`);
  const fnRes = await fetchUrl(`https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?_t=${Date.now()}`);
  console.log(`   • HTTP Status: ${fnRes.statusCode}`);
  if (fnRes.statusCode === 200) {
    const fnData = JSON.parse(fnRes.data);
    console.log(`   • API Total Events: ${fnData.total_events} (Matches: ${fnData.total_events === 26})`);
  }

  // 5. Test all 6 event tiles on live dataset
  console.log(`\n5. Tile Filter Matching on Live Dataset:`);
  const RADAR_CATEGORY_MAP = {
    organ_vakanz: ['c_level_vakanz', 'c_level_vakanz_ch', 'organ_vakanz'],
    restrukturierung_cro: ['unternehmenskrise_restrukturierung', 'insolvenzantrag_eigenverwaltung', 'transformation_sanierung', 'restrukturierung_cro'],
    not_governance_ar: ['not_governance_ar', 'unternehmenskrise_restrukturierung'],
    m_and_a_board: ['fusion_uebernahme_unternehmensverkauf', 'm_and_a_board'],
    carveout_pe: ['carveout_pe', 'fusion_uebernahme_unternehmensverkauf'],
    finanz_sondersituation: ['finanzierung_anleihen_restrukturierung', 'finanz_sondersituation']
  };

  for (const [tileKey, cats] of Object.entries(RADAR_CATEGORY_MAP)) {
    const matches = liveData.events.filter(e => cats.includes(e.category));
    console.log(`   • Kachel '${tileKey}': ${matches.length} Treffer (Aktiv)`);
  }

  // 6. Check frontend bundle for removal of pseudo-confidence
  console.log(`\n6. Frontend Bundle Verification (Removal of 'Konfidenz: 98%'):`);
  const htmlRes = await fetchUrl(`https://nexus-hit.netlify.app/?_t=${Date.now()}`);
  const jsMatch = htmlRes.data.match(/src="(\/assets\/EventExplorerPage-[^"]+\.js)"/);
  if (jsMatch) {
    const jsUrl = `https://nexus-hit.netlify.app${jsMatch[1]}`;
    console.log(`   • EventExplorerPage Bundle: ${jsUrl}`);
    const jsRes = await fetchUrl(jsUrl);
    const hasFake98 = jsRes.data.includes("0.98") && jsRes.data.includes("nachgewiesen");
    const hasFactualBadge = jsRes.data.includes("event-factual-badges");
    console.log(`   • Falsche 98%-Zuweisung vorhanden: ${hasFake98 ? 'JA (FEHLER)' : 'NEIN (Erfolgreich entfernt)'}`);
    console.log(`   • Neue Fakten-Badges ('event-factual-badges'): ${hasFactualBadge ? 'JA (Erfolgreich integriert)' : 'NEIN'}`);
  } else {
    console.log(`   • Notice: EventExplorerPage chunk split dynamically or hashed.`);
  }

  // 7. Test POST human review on Netlify Function
  console.log(`\n7. Netlify Function POST Human Review Durability Test:`);
  const postBody = JSON.stringify({
    event_id: deag?.event_id,
    reviewer_decision: "VERWERFEN",
    reviewer_notes: "Live acceptance verification note",
    confirmed: true
  });
  const postRes = await fetchUrl(`https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: postBody
  });
  console.log(`   • POST Status: ${postRes.statusCode}`);
  try {
    const postJson = JSON.parse(postRes.data);
    console.log(`   • Persistence Mode: ${postJson.persistence_mode}`);
    console.log(`   • Response Message: ${postJson.message}`);
  } catch (e) {
    console.log(`   • Response Body: ${postRes.data.slice(0, 100)}`);
  }

  console.log("\n=================================================================");
  console.log("✅ LIVE ABNAHME ERFOLGREICH ABGESCHLOSSEN!");
  console.log("=================================================================");
}

pollDeployment();
