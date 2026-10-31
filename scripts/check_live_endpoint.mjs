async function checkLive() {
  const endpoints = [
    'https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events',
    'https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?view=history',
    'https://nexus-hit.netlify.app/data/continuous_radar_events.json',
    'https://nexus-hit.netlify.app/data/continuous_radar_history.json'
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const preview = text.slice(0, 160).replace(/\n/g, ' ');
      console.log(`[HTTP ${res.status}] ${url}\n  Length: ${text.length} bytes\n  Preview: ${preview}\n`);
    } catch (e) {
      console.error(`[ERROR] ${url}: ${e.message}\n`);
    }
  }
}
checkLive();
