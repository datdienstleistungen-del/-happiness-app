import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase URL or Service Key');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

// Whitelist erlaubter Rechtsformen für das Mandatsgeschäft
const LEGAL_FORM_WHITELIST = [
  'AG', 'SE', 'KGAA', 'PLC', 'SA', 'NV', 'SPA', 'CORP', 'CORPORATION', 'GMBH'
];

// Blacklist von Kleingewerbe, Vereinen, Kitas, Sport, Gastro
const SECTOR_BLACKLIST = [
  'kleingewerbe', 'verein', 'e.v.', 'eingetragener verein', 'kita', 'moris',
  'kindergarten', 'sportverein', 'fc ', 'sv ', 'gastro', 'restaurant', 'cafe',
  'café', 'bar ', 'hotel', 'gasthof', 'bäckerei', 'metzgerei', 'zirkus',
  'hofladen', 'friseur', 'e.k.', 'gbr', 'ug (haftungsbeschränkt)', 'genossenschaft'
];

function extractEventDate(opp) {
  // 1. Aus situation [EREIGNISDATUM]: YYYY-MM-DD
  if (opp.situation) {
    const m = opp.situation.match(/\[EREIGNISDATUM\]:\s*(\d{4}-\d{2}-\d{2})/i);
    if (m) return new Date(`${m[1]}T00:00:00Z`);
  }
  // 2. published_at
  if (opp.published_at) return new Date(opp.published_at);
  // 3. created_at
  if (opp.created_at) return new Date(opp.created_at);
  return null;
}

function evaluateOpportunityHygiene(opp) {
  const title = (opp.title || '').toLowerCase();
  const situation = (opp.situation || '').toLowerCase();
  const notes = (opp.notes || '').toLowerCase();
  const compName = (opp.nexus_companies?.name || '').toLowerCase();
  const fullText = `${title} ${situation} ${notes} ${compName}`;

  // 1. Blacklist Sektorprüfung
  for (const bl of SECTOR_BLACKLIST) {
    if (fullText.includes(bl)) {
      return { keep: false, reason: `BLACKLIST_SEKTOR: Enthält '${bl}'` };
    }
  }

  // 2. Rechtsform-Whitelist-Prüfung
  const hasWhitelistedForm = LEGAL_FORM_WHITELIST.some(form => {
    const regex = new RegExp(`\\b${form}\\b`, 'i');
    return regex.test(compName) || regex.test(title);
  });

  // Falls der Name des Unternehmens keine der Rechtsformen enthält und es kein bekannter Konzern ist
  if (!hasWhitelistedForm) {
    const isMajorEnterprise = /\b(daimler|siemens|volkswagen|bmw|basf|bayer|allianz|sap|telekom|e.on|rwe|airbus|nestle|novartis|roche|ubs|credit suisse|glencore|abb|shell|bp|vodafone|barclays|hsbc|santander|bbva|telefonica|totalenergies|sanofi|axa|bnp paribas|stellantis)\b/i.test(compName);
    if (!isMajorEnterprise) {
      return { keep: false, reason: `RECHTSFORM_NICHT_ERLAUBT: Keine AG, SE, KGaA, Plc, SA, NV, SpA, Corp oder Groß-GmbH` };
    }
  }

  // 3. 48h Frische-Prüfung auf das reale Ereignisdatum
  const evtDate = extractEventDate(opp);
  if (evtDate) {
    const ageHours = (Date.now() - evtDate.getTime()) / (1000 * 60 * 60);
    if (ageHours > 48) {
      return { keep: false, reason: `ALTER_UEBER_48H: Reales Ereignis vor ${ageHours.toFixed(1)}h (${evtDate.toISOString().slice(0, 10)})` };
    }
  }

  return { keep: true };
}

async function runAuditAndClean() {
  console.log('===============================================================');
  console.log('🔍 MANDATE DESK: DATENBANK-AUDIT & BEREINIGUNG ALTER SPLITTER');
  console.log('===============================================================\n');

  // Lade alle Opportunities (auch aktive und unbereinigte)
  const oppRes = await fetch(`${url}/rest/v1/nexus_opportunities?select=id,title,situation,notes,published_at,created_at,deleted_at,nexus_companies(id,name)&order=created_at.desc`, { headers });
  const allOpps = oppRes.ok ? await oppRes.json() : [];

  console.log(`Gesamt in nexus_opportunities: ${allOpps.length}`);

  const toPurge = [];
  let alreadyDeletedCount = 0;

  for (const opp of allOpps) {
    if (opp.deleted_at !== null) {
      alreadyDeletedCount++;
    }
    const evalResult = evaluateOpportunityHygiene(opp);
    if (!evalResult.keep) {
      toPurge.push({ id: opp.id, title: opp.title, reason: evalResult.reason, isAlreadyDeleted: opp.deleted_at !== null });
    }
  }

  console.log(`\nBereits soft-gelöscht: ${alreadyDeletedCount}`);
  console.log(`Gefundene Splitter/Altfälle zur Bereinigung: ${toPurge.length}`);

  if (toPurge.length > 0) {
    console.log('\nBeispiele für bereinigte Fälle:');
    toPurge.slice(0, 5).forEach((p, idx) => {
      console.log(`[${idx+1}] Grund: ${p.reason} | Titel: ${(p.title || '').slice(0, 70)}`);
    });

    const now = new Date().toISOString();
    const idsToClean = toPurge.map(p => p.id);

    // Verknüpfungen entfernen
    for (let i = 0; i < idsToClean.length; i += 30) {
      const chunk = idsToClean.slice(i, i + 30);
      const idList = chunk.map(id => `"${id}"`).join(',');
      await fetch(`${url}/rest/v1/nexus_opportunity_triggers?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_opportunity_contacts?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
      await fetch(`${url}/rest/v1/nexus_lead_packages?opportunity_id=in.(${idList})`, { method: 'DELETE', headers });
      
      // Hard delete versuchen, sonst soft delete mit review_status rejected
      const del = await fetch(`${url}/rest/v1/nexus_opportunities?id=in.(${idList})`, { method: 'DELETE', headers });
      if (!del.ok) {
        await fetch(`${url}/rest/v1/nexus_opportunities?id=in.(${idList})`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ deleted_at: now, review_status: 'rejected' })
        });
      }
    }
    console.log(`\n✅ ${toPurge.length} Splitter und Altfälle erfolgreich bereinigt.`);
  }

  // Verifikation
  const verifyRes = await fetch(`${url}/rest/v1/nexus_opportunities?deleted_at=is.null&select=id,title`, { headers });
  const activeRemaining = verifyRes.ok ? await verifyRes.json() : [];
  console.log(`\nAktive verbleibende Opportunities in Supabase: ${activeRemaining.length}`);
  console.log('===============================================================');
}

runAuditAndClean().catch(err => {
  console.error('Audit-Fehler:', err);
  process.exit(1);
});
