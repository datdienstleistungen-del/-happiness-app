import { 
  resolveCompanyWebsite, 
  discoverDomainStep1, 
  discoverDomainStep2, 
  generateDomainCandidates,
  getGoogleCseQuotaStatus,
  filterSearchResult,
  SKIP_DOMAINS,
  DIRECTORY_PATH_PATTERNS
} from './netlify/functions/nexus-domain-discovery.mjs';

async function runReport() {
  console.log('================================================================');
  console.log('🧪 NEXUS WEBSITE-FINDUNG: AUDIT & ABNAHMEBERICHT (KORREKTUR 3)');
  console.log('================================================================\n');

  // 1. BELEG & STATUS DER GOOGLE API KONFIGURATION
  console.log('----------------------------------------------------------------');
  console.log('1. STATUS DER GOOGLE CUSTOM SEARCH API KONFIGURATION');
  console.log('----------------------------------------------------------------');
  const googleKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CSE_KEY;
  const googleCx = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID;
  console.log('GOOGLE_SEARCH_API_KEY vorhanden?:', googleKey ? 'JA (Key: ' + googleKey.slice(0, 6) + '...)' : 'NEIN (Fehlt in Umgebung)');
  console.log('GOOGLE_SEARCH_ENGINE_ID vorhanden?:', googleCx ? 'JA (CX: ' + googleCx.slice(0, 6) + '...)' : 'NEIN (Fehlt in Umgebung)');
  console.log('Tages-Quota-Status:', getGoogleCseQuotaStatus());
  console.log('----------------------------------------------------------------\n');

  // 2. TESTFALL 1 (PERSONIO SE) - ERNEUTER TESTLAUF MIT TLD-HIERARCHIE
  console.log('----------------------------------------------------------------');
  console.log('2. ECHTER TESTLAUF: "Personio SE" (Vermeidung von personio.ai)');
  console.log('----------------------------------------------------------------');
  const t1Start = Date.now();
  const resPersonio = await resolveCompanyWebsite('Personio SE');
  const t1Elapsed = Date.now() - t1Start;
  console.log('[Personio SE Ergebnis]:', JSON.stringify(resPersonio, null, 2));
  console.log('Dauer:', t1Elapsed, 'ms\n');

  // 3. TESTFALL NICHE-FIRMEN: TENDIGO & PORTATOUR
  console.log('----------------------------------------------------------------');
  console.log('3. TESTLAUF STARTUP / NICHE: "TendiGo" & "portatour"');
  console.log('----------------------------------------------------------------');
  const resTendigo = await resolveCompanyWebsite('TendiGo');
  console.log('[TendiGo Ergebnis]:', JSON.stringify(resTendigo, null, 2));

  const resPortatour = await resolveCompanyWebsite('portatour');
  console.log('\n[portatour Ergebnis]:', JSON.stringify(resPortatour, null, 2));
  console.log('----------------------------------------------------------------\n');

  // 4. TEST DES DIRECTORY- & AGGREGATOR-FILTERS
  console.log('----------------------------------------------------------------');
  console.log('4. TEST DES VERZEICHNIS- & AGGREGATOR-FILTERS (Nachtrag)');
  console.log('----------------------------------------------------------------');
  const testDirectoryItems = [
    { title: 'TendiGo Review', link: 'https://ki-syndikat.de/tools/tendigo', snippet: 'Das Tool im Test...' },
    { title: 'myReach AI Tool', link: 'https://futuretools.io/tools/myreach', snippet: 'AI tool directory...' },
    { title: 'TendiGo Software', link: 'https://www.g2.com/products/tendigo/reviews', snippet: 'G2 Reviews...' },
    { title: 'TendiGo Offizielle Website', link: 'https://tendigo.de', snippet: 'Offizielle Plattform für Ausschreibungen mit KI...' }
  ];

  for (const item of testDirectoryItems) {
    const filterResult = filterSearchResult(item);
    console.log(`URL: ${item.link.padEnd(45)} => ${filterResult ? '✅ AKZEPTIERT: ' + filterResult.domain : '❌ ABGELEHNT (Verzeichnis/Aggregator)'}`);
  }
  console.log('----------------------------------------------------------------\n');

  // 5. TESTFALL FIKTIVE FIRMA (Ehrliches "nicht auffindbar")
  console.log('----------------------------------------------------------------');
  console.log('5. TESTFALL FIKTIVE FIRMA: "FantasieX9999 NonExistent Stealth GmbH"');
  console.log('----------------------------------------------------------------');
  const resFake = await resolveCompanyWebsite('FantasieX9999 NonExistent Stealth GmbH');
  console.log('[Fiktive Firma Ergebnis]:', JSON.stringify(resFake, null, 2));
  console.log('----------------------------------------------------------------\n');
}

runReport().catch(console.error);
