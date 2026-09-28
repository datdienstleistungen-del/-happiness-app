// CI-Gate: kein Provider-Secret/Key/Dominen-Name im gebauten Frontend-Bundle.
// Regression fuer Phase 1a (2026-09-28): VITE_GROQ_API_KEY lag als gsk_-Klartext im dist/.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'dist', 'assets');

const FORBIDDEN = [
  'openrouter\\.ai',
  'api\\.groq\\.com',
  'api\\.mistral\\.ai',
  'api\\.deepseek\\.com',
  'VITE_GROQ',
  'VITE_OPENROUTER',
  'VITE_MISTRAL',
  'VITE_DEEPSEEK',
  'gsk_',
  'sk-or-',
  'useFallback',
];

let hits = 0;
let files = 0;
try {
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith('.js')) continue;
    files++;
    const content = readFileSync(join(assetsDir, name), 'utf8');
    for (const pattern of FORBIDDEN) {
      const re = new RegExp(pattern, 'gi');
      const matches = content.match(re);
      if (matches) {
        hits += matches.length;
        console.error(`LEAK ${name}: ${matches.length}x /${pattern}/ -> ${matches[0]}`);
      }
    }
  }
} catch (e) {
  console.error(`FEHLER: dist/assets nicht lesbar (${e.message}) - zuerst 'npm run build' ausfuehren.`);
  process.exit(1);
}

if (hits > 0) {
  console.error(`FAIL: ${hits} Leak-Treffer in ${files} Bundles.`);
  process.exit(1);
}
console.log(`OK: 0 Leak-Treffer in ${files} Bundles (${FORBIDDEN.length} Muster).`);
