// CI-Gate: Syntax-Check aller Netlify-Functions und ESM-Skripte (node --check).
// Laeuft plattformunabhaengig (kein shell-fore). UI-/JSX-Dateien sind out of scope
// (Vite-Build ist deren Parser).
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectMjs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMjs(full));
    else if (entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

const targets = [
  ...collectMjs(join(root, 'netlify', 'functions')),
  ...collectMjs(join(root, 'scripts')).filter((f) => f.endsWith('.mjs')),
];

let failed = 0;
for (const file of targets) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    failed++;
    console.error(`FAIL ${file}\n${res.stderr}`);
  }
}
if (failed > 0) {
  console.error(`FAIL: ${failed} von ${targets.length} Dateien fehlerhaft.`);
  process.exit(1);
}
console.log(`OK: ${targets.length} Dateien syntaxfehlerfrei.`);
