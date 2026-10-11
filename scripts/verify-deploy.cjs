async function verifyLive() {
  const r = await fetch('https://nexus-hit.netlify.app/assets/index-DRzsOMoB.js');
  const js = await r.text();
  console.log('Live index bundle size:', js.length);

  const swMatch = js.match(/SalesWorkspacePage-[A-Za-z0-9_-]+\.js/);
  console.log('SalesWorkspacePage chunk:', swMatch ? swMatch[0] : 'not found');
  if (swMatch) {
    const swRes = await fetch('https://nexus-hit.netlify.app/assets/' + swMatch[0]);
    const swJs = await swRes.text();
    console.log('Live SalesWorkspace contains "isPlaceholderCompany":', swJs.includes('isPlaceholderCompany'));
    console.log('Live SalesWorkspace contains "Zielgruppe unklar":', swJs.includes('Zielgruppe unklar'));
    console.log('Live SalesWorkspace contains "KI-Konfidenz":', swJs.includes('KI-Konfidenz'));
    console.log('Live SalesWorkspace contains "ws-source-warning":', swJs.includes('ws-source-warning'));
  }

  const radarMatch = js.match(/NexusLeadRadarPage-[A-Za-z0-9_-]+\.js/);
  console.log('NexusLeadRadarPage chunk:', radarMatch ? radarMatch[0] : 'not found');
  if (radarMatch) {
    const radarRes = await fetch('https://nexus-hit.netlify.app/assets/' + radarMatch[0]);
    const radarJs = await radarRes.text();
    console.log('Live LeadRadar contains "Zielgruppe unklar":', radarJs.includes('Zielgruppe unklar'));
    console.log('Live LeadRadar contains "badge-expired":', radarJs.includes('badge-expired'));
  }
}

verifyLive().catch(console.error);
