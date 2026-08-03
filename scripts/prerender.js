import { chromium } from 'playwright';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Die gleichen Routen aus App.jsx
const guideRoutesMap = {
  de: '/de/ratgeber/niemand-zum-reden',
  en: '/en/guide/no-one-to-talk-to',
  es: '/es/guia/nadie-con-quien-hablar',
  fr: '/fr/guide/personne-a-qui-parler',
  it: '/it/guida/nessuno-con-cui-parlare',
  nl: '/nl/gids/niemand-om-mee-te-praten',
  el: '/el/odigos/kaneis-gia-na-miliseis'
};

const PORT = 8080;
const DIST_DIR = path.resolve(__dirname, '../dist');

async function prerender() {
  console.log('🚀 Starte SSG Prerendering für SEO-Landingpages...');

  // 1. Lokalen Server starten, um die gebaute SPA auszuliefern
  const app = express();
  app.use(express.static(DIST_DIR));
  
  // SPA-Fallback für alle nicht gefundenen statischen Routen
  app.use((req, res) => {
    res.sendFile(path.resolve(DIST_DIR, 'index.html'));
  });

  const server = app.listen(PORT, async () => {
    console.log(`🌍 Lokaler Server läuft auf http://localhost:${PORT}`);

    try {
      // 2. Playwright starten (Headless Chrome)
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      // 3. Jede SEO-Route besuchen und HTML abgreifen
      for (const [lang, route] of Object.entries(guideRoutesMap)) {
        const url = `http://localhost:${PORT}${route}`;
        console.log(`\n⏳ Prerendering: ${route}`);

        // Auf die Seite gehen und warten, bis keine Netzwerk-Aktivität mehr herrscht (React hat gerendert)
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // Extra Warten, um sicherzugehen, dass useEffect durch ist
        await page.waitForTimeout(500);

        // Den fertigen HTML-Code des Dokuments auslesen
        const html = await page.content();

        // 4. In die entsprechende Datei speichern
        const routePath = path.resolve(DIST_DIR, route.substring(1)); // '/de/...' -> 'de/...'
        const filePath = path.resolve(routePath, 'index.html');
        
        // Ordnerstruktur erstellen falls nicht vorhanden
        fs.mkdirSync(routePath, { recursive: true });
        
        // Datei schreiben
        fs.writeFileSync(filePath, html, 'utf-8');
        
        console.log(`✅ Gespeichert: dist${route}/index.html`);
      }

      await browser.close();
      console.log('\n🎉 SSG Prerendering erfolgreich abgeschlossen!');
    } catch (err) {
      console.error('❌ Fehler beim Prerendering:', err);
      process.exitCode = 1;
    } finally {
      // 5. Server beenden
      server.close();
    }
  });
}

prerender();
