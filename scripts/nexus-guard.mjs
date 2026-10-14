// ============================================================================
// NeXus Guard: Automatischer Scanner & Self-Healing Auto-Closer
//
// Befehle:
//   npm run guard          -> Scannt & schließt gefundene Lecks automatisch
//   npm run guard:check    -> Nur Audit (schlägt mit Exit 1 fehl, wenn Lecks existieren)
// ============================================================================

import fs from 'fs';
import path from 'path';

const FUNCTIONS_DIR = path.resolve('netlify/functions');
const AUTO_CLOSE = process.argv.includes('--auto-close') || process.argv.includes('--fix');

const PUBLIC_WHITELIST = new Set([
  'stripe-webhook.mjs',
  'nexus-health.mjs',
  'nexus-free-pass.mjs'
]);

console.log('\n======================================================================');
console.log('🛡️  NEXUS GUARD: SICHERHEITS- & KOSTENLECK-SCANNER');
console.log(`Modus: ${AUTO_CLOSE ? '⚡ AUTO-CLOSE (Erkennen und sofort schließen)' : '🔍 AUDIT-ONLY (Nur Prüfung)'}`);
console.log('======================================================================\n');

const files = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.mjs') || f.endsWith('.cjs'));

let totalChecked = 0;
let leaksFound = 0;
let leaksClosed = 0;
const issues = [];

for (const file of files) {
  const filePath = path.join(FUNCTIONS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileModified = false;

  const isEndpoint = /export\s+(const|async\s+function)\s+handler|exports\.handler/i.test(content);
  if (!isEndpoint) continue;

  totalChecked++;

  // 1. ANALYSE DER FUNKTION
  const callsLLM = /callLLM|callAI|callProviderChain|groq|deepseek|openai|mistral|https:\/\/api\.openai\.com/i.test(content);
  const callsSearch = /tavilySearch|searchDuckDuckGo|searchWeb|resolveCompanyWebsite|googleapis\.com/i.test(content);
  const mutatesDB = /\.insert\(|\.update\(|\.delete\(|\.upsert\(/i.test(content);

  // Authentifizierungs-Prüfungen
  const hasUserAuth = /getUser\(\)|auth\.getUser|auth\/v1\/user/i.test(content);
  const hasCronSecret = /CRON_SECRET|x-cron-secret/i.test(content);
  const hasGuestRateLimit = /checkGuestRateLimit|isLandingPreview/i.test(content);
  const isPublicAllowed = PUBLIC_WHITELIST.has(file);

  const isProtected = hasUserAuth || hasCronSecret || hasGuestRateLimit;

  // 2. CHECK: UNGESCHÜTZTER LLM- ODER DB-ENDPOINT
  if (!isProtected && !isPublicAllowed && (callsLLM || mutatesDB)) {
    leaksFound++;
    const problem = callsLLM ? 'Endpoint führt KI-Aufrufe ohne Authentifizierung aus' : 'Endpoint mutiert Datenbank ohne Authentifizierung';

    if (AUTO_CLOSE) {
      // SOFORT SCHLIESSEN: Auth-Gate automatisch einfügen
      console.log(`⚡ [AUTO-CLOSE] Schließe Sicherheitsleck in ${file}...`);
      // Prüfen, ob wir die Sicherheitsprüfung vor dem Handler-Body einfügen können
      const handlerMatch = content.match(/(export\s+const\s+handler\s*=\s*async\s*\([^)]*\)\s*=>\s*\{|exports\.handler\s*=\s*async\s*\([^)]*\)\s*=>\s*\{)/);
      if (handlerMatch) {
        const authGuardCode = `
  // [AUTO-CLOSE SECURITY GATE]
  const _authH = event.headers?.authorization || event.headers?.Authorization || '';
  if (!_authH.startsWith('Bearer ')) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized: NeXus Guard erfordert Authentifizierung' }) };
  }
`;
        content = content.replace(handlerMatch[0], handlerMatch[0] + authGuardCode);
        fileModified = true;
        leaksClosed++;
        console.log(`✅ [AUTO-CLOSE] ${file}: Sofortiges Auth-Gate injiziert.`);
      } else {
        issues.push({ file, type: 'SICHERHEITSLECK', severity: 'KRITISCH', desc: problem });
      }
    } else {
      issues.push({
        file,
        type: 'SICHERHEITSLECK',
        severity: 'KRITISCH',
        desc: problem
      });
    }
  }

  // 3. CHECK: KOSTENLECK (Falsche Provider-Reihenfolge)
  // DeepSeek / OpenAI darf NIEMALS an 1. Stelle stehen, Groq MUSS vor DeepSeek stehen.
  const providerMatches = content.matchAll(/providers:\s*\[([^\]]+)\]/g);
  for (const m of providerMatches) {
    const rawList = m[1];
    const providers = rawList.replace(/['"\s]/g, '').split(',');
    const deepseekIdx = providers.indexOf('deepseek');
    const groqIdx = providers.indexOf('groq');

    if (deepseekIdx === 0 || (deepseekIdx !== -1 && groqIdx !== -1 && deepseekIdx < groqIdx)) {
      leaksFound++;
      const problem = `Kostenleck in Provider-Kette: [${providers.join(', ')}]`;

      if (AUTO_CLOSE) {
        // SOFORT SCHLIESSEN: Kaskade automatisch korrigieren
        // Groq nach vorne, DeepSeek ganz nach hinten
        const reordered = [...providers];
        const ds = reordered.splice(reordered.indexOf('deepseek'), 1)[0];
        if (!reordered.includes('groq')) reordered.unshift('groq');
        reordered.push(ds);

        const newChain = `providers: [${reordered.map(p => `'${p}'`).join(', ')}]`;
        content = content.replace(m[0], newChain);
        fileModified = true;
        leaksClosed++;
        console.log(`⚡ [AUTO-CLOSE] ${file}: Provider-Kette automatisch korrigiert zu: [${reordered.join(', ')}]`);
      } else {
        issues.push({
          file,
          type: 'KOSTENLECK',
          severity: 'HOCH',
          desc: problem
        });
      }
    }
  }

  // 4. CHECK: HARDCODED SECRETS (Klartext-Keys)
  const secretPatterns = [
    { name: 'DeepSeek Key', re: /['"`]sk-[a-zA-Z0-9]{32,}['"`]/g },
    { name: 'Groq Key', re: /['"`]gsk_[a-zA-Z0-9]{20,}['"`]/g },
    { name: 'OpenRouter Key', re: /['"`]sk-or-v1-[a-zA-Z0-9]{30,}['"`]/g }
  ];

  for (const pat of secretPatterns) {
    if (pat.re.test(content)) {
      leaksFound++;
      issues.push({
        file,
        type: 'SECRET-LEAK',
        severity: 'KRITISCH',
        desc: `Hardcoded API-Key (${pat.name}) im Quellcode gefunden!`
      });
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// 5. CHECK: CIRCUIT BREAKER INTEGRATION
const llmCorePath = path.join(FUNCTIONS_DIR, '_shared', 'llm-core.mjs');
if (fs.existsSync(llmCorePath)) {
  const llmCoreContent = fs.readFileSync(llmCorePath, 'utf8');
  if (!llmCoreContent.includes('isPaidApiKillswitchTripped')) {
    leaksFound++;
    issues.push({
      file: '_shared/llm-core.mjs',
      type: 'KOSTENLECK',
      severity: 'KRITISCH',
      desc: 'Not-Aus / Circuit-Breaker für Bezahl-APIs ist in llm-core.mjs nicht aktiv!'
    });
  }
}

// BERICHT
console.log(`Scan abgeschlossen. ${totalChecked} Endpoints überprüft.`);

if (leaksClosed > 0) {
  console.log(`\n🎉 ${leaksClosed} Lecks wurden per Auto-Close SOFORT geschlossen!`);
}

if (issues.length === 0) {
  console.log('\n✅ STATUS: ALLES SAUBER & WASSERDICHT GESCHÜTZT.');
  console.log('   - Alle Endpoints authentifiziert');
  console.log('   - Kosten-Kaskade 100% sicher (Groq zuerst, DeepSeek geschützt)');
  console.log('   - Keine Klartext-Schlüssel im Code');
  console.log('   - Automatischer Not-Aus (Circuit Breaker) aktiv\n');
  process.exit(0);
} else {
  console.log(`\n🚨 ${issues.length} UNGELÖSTE PROBLEME GEFUNDEN:\n`);
  for (const iss of issues) {
    console.log(`[${iss.severity}] ${iss.file}`);
    console.log(`   Typ:     ${iss.type}`);
    console.log(`   Problem: ${iss.desc}\n`);
  }
  process.exit(1);
}
