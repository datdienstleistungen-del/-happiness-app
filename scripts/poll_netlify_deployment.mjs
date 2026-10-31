import https from 'https';

function checkEndpoint(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');
        let parsed = null;
        if (isJson) {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            // parse error
          }
        }
        resolve({
          url,
          statusCode: res.statusCode,
          contentType,
          isJson,
          byteLength: data.length,
          itemCount: parsed?.events?.length ?? parsed?.runs?.length ?? null,
          generatedAt: parsed?.generated_at ?? parsed?.last_updated ?? null,
          samplePreview: isJson ? JSON.stringify(parsed).slice(0, 150) : data.slice(0, 150)
        });
      });
    }).on('error', (err) => {
      resolve({ url, error: err.message });
    });
  });
}

async function main() {
  console.log(`[${new Date().toISOString()}] Checking Netlify live endpoints...`);
  const urls = [
    'https://nexus-hit.netlify.app/data/continuous_radar_events.json',
    'https://nexus-hit.netlify.app/data/continuous_radar_history.json',
    'https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events',
    'https://nexus-hit.netlify.app/.netlify/functions/nexus-radar-events?view=history'
  ];

  for (const u of urls) {
    const res = await checkEndpoint(u);
    console.log('----------------------------------------------------');
    console.log(`URL:          ${res.url}`);
    console.log(`Status:       ${res.statusCode}`);
    console.log(`Content-Type: ${res.contentType}`);
    console.log(`Is JSON:      ${res.isJson}`);
    console.log(`Bytes:        ${res.byteLength}`);
    if (res.itemCount !== null) console.log(`Item Count:   ${res.itemCount}`);
    if (res.generatedAt) console.log(`Timestamp:    ${res.generatedAt}`);
    if (!res.isJson) console.log(`HTML Preview: ${res.samplePreview.replace(/\r?\n|\r/g, ' ')}`);
  }
}

main();
