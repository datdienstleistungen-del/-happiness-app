import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { guideContent } from '../src/content/guide-loneliness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const guideRoutesMap = {
  de: '/de/ratgeber/niemand-zum-reden',
  en: '/en/guide/no-one-to-talk-to',
  es: '/es/guia/nadie-con-quien-hablar',
  fr: '/fr/guide/personne-a-qui-parler',
  it: '/it/guida/nessuno-con-cui-parlare',
  nl: '/nl/gids/niemand-om-mee-te-praten',
  el: '/el/odigos/kaneis-gia-na-miliseis'
};

const LANGUAGES = Object.keys(guideRoutesMap);
const DEFAULT_LANG = 'en';

const DIST_DIR = path.resolve(__dirname, '../dist');
const indexHtmlPath = path.resolve(DIST_DIR, 'index.html');

function prerender() {
  console.log('🚀 Starte superschnelles SSG (ohne Headless Browser)...');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ dist/index.html nicht gefunden. Bitte zuerst bauen.');
    process.exitCode = 1;
    return;
  }

  const baseHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

  for (const [lang, route] of Object.entries(guideRoutesMap)) {
    console.log(`⏳ Generiere statisches HTML für: ${route}`);
    
    let html = baseHtml;
    const content = guideContent[lang];

    if (!content) {
      console.error(`Kein Content für ${lang} gefunden!`);
      continue;
    }

    // 1. Title ersetzen (RegEx findet das bestehende Title-Tag)
    html = html.replace(/<title>(.*?)<\/title>/i, `<title>${content.seo.title}</title>`);
    
    // 2. Meta-Description ersetzen
    html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${content.seo.description}">`);
    
    // 3. Hreflang Tags generieren und einfügen
    const hreflangTags = LANGUAGES.map(l => {
      const url = `https://happiness-eu.netlify.app${guideRoutesMap[l]}`;
      return `<link rel="alternate" hreflang="${l}" href="${url}" />`;
    });
    
    // x-default (Englisch)
    const xDefaultUrl = `https://happiness-eu.netlify.app${guideRoutesMap[DEFAULT_LANG]}`;
    hreflangTags.push(`<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`);
    
    // Füge die hreflang Tags kurz vor dem </head> ein
    html = html.replace('</head>', `${hreflangTags.join('\n    ')}\n  </head>`);

    // 4. In die entsprechende Datei speichern
    const routePath = path.resolve(DIST_DIR, route.substring(1)); // '/de/...' -> 'de/...'
    const filePath = path.resolve(routePath, 'index.html');
    
    // Ordnerstruktur erstellen falls nicht vorhanden
    fs.mkdirSync(routePath, { recursive: true });
    
    // Datei schreiben
    fs.writeFileSync(filePath, html, 'utf-8');
    
    console.log(`✅ Gespeichert: dist${route}/index.html`);
  }

  console.log('\n🎉 SSG Prerendering erfolgreich abgeschlossen!');
}

prerender();
