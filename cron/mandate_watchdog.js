#!/usr/bin/env node
/**
 * NeXus Mandate Watchdog Cronjob (Forensische Fassung)
 * 
 * Überprüft wöchentlich (bzw. im 14-Tage-Turnus) alle Datensätze im Kundenschutz-Register
 * mit Status "Aktiv geschützt" (u. a. PAUL Tech AG -> AG Mannheim HRB 743304).
 * 
 * Architektur & Forensische Regeln:
 * 1. 3-Stufen-Modell:
 *    - SEARCH_HIT (Stufe 1): Schlüsselwort im Text gefunden, rein informativ, changeDetected: false
 *    - CHANGE_HINT (Stufe 2): Neuer sachlicher Inhalt vs. quittierter Stand -> Prüfhinweis für Mensch
 *    - VERIFIED_CHANGE (Stufe 3): Nur durch menschlichen Prüfer bestätigte operative Veränderung
 * 2. Re-Alert-Schutz:
 *    - Normalisiert Quelltexte (bereinigt HTML, Navigation, Layout, dynamische Zeitstempel, Copyright)
 *    - Hash-Vergleich gegen 'last_acknowledged_snapshot.hash'. Quittierter Stand bleibt VERIFIED_STABLE.
 * 3. Register-Identitätsprüfung:
 *    - Gleicht Kennungen gegen amtlich verifizierte Quellen ab (AG Mannheim HRB 743304, Zug CHE-457.384.964).
 *    - Bei Abweichungen Status REGISTER_ID_UNVERIFIED und Unterdrückung von Registeränderungs-Behauptungen.
 * 4. Fristenberechnung:
 *    - BGB-Ultimo-Regel für Kalendermonate (keine pauschalen 360/540 Tage).
 *    - Fälligkeiten fest am Übermittlungsdatum verankert (Auditlauf verschiebt Turnus nicht).
 *    - Kein stiller Fallback auf Date.now() bei unvollständigen Daten.
 * 
 * Aufruf:
 *   node cron/mandate_watchdog.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MATCH_LEVELS,
  WATCHDOG_SIGNAL_KEYWORDS,
  OFFICIAL_REGISTER_MAPPINGS,
  computeDeadlineStatus,
  verifyMandateRegisterIdentity,
  runWatchdogAuditForMandate
} from '../src/lib/nexus-watchdog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const STATE_FILE = path.join(ROOT_DIR, 'data', 'research', 'mandate_register_state.json');
const REPORT_FILE = path.join(ROOT_DIR, 'data', 'research', 'watchdog_audit_report.json');

// Amtlich verifizierte Initial-Referenzen falls State-Datei noch nicht existiert
export const DEFAULT_PROTECTED_MANDATES = [
  {
    id: 'arch-paul-tech-2026-01',
    company: 'PAUL Tech AG',
    countryMarket: 'DE · Mannheim / Prime Bond',
    role: 'Interim CFO / Restrukturierungs-PMO (SchVG)',
    transmittedTo: 'taskforce - Management on Demand AG',
    transmittedAt: '2026-10-27T08:00:00Z',
    protectionUntil: '2028-04-27T08:00:00Z',
    protection_months: 18,
    status: 'AKTIV_GESCHUETZT',
    register_id: 'AG Mannheim HRB 743304',
    company_domain: 'paul.group',
    ir_news_url: 'https://paul.group/news/',
    last_audit_check: '2026-10-28T18:00:00Z',
    has_change_alert: false,
    has_change_hint: false,
    changeDetected: false,
    match_level: MATCH_LEVELS.VERIFIED_STABLE,
    change_flag: MATCH_LEVELS.VERIFIED_STABLE,
    last_acknowledged_snapshot: {
      hash: 'h_07c2a6a30b80e5',
      substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
      timestamp: '2026-10-28T18:00:00Z',
      reviewer: 'Administrator',
      decision: 'ACKNOWLEDGE_STABLE',
      notes: 'SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat berücksichtigt'
    },
    last_scraped_snapshot: {
      hash: 'h_07c2a6a30b80e5',
      substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
      timestamp: '2026-10-28T18:00:00Z',
      matchedKeywords: ['Restrukturierung', 'Gläubigerversammlung', 'Vorstand', 'CFO']
    },
    audit_log: [
      {
        id: 'audit-pt-ack-01',
        timestamp: '2026-10-28T18:00:00Z',
        sourceType: 'HUMAN_AUDIT_REVIEW',
        sourceTitle: 'Menschliche Quittierung: Status stabil',
        sourceUrl: 'https://paul.group/news/',
        matchLevel: MATCH_LEVELS.VERIFIED_STABLE,
        matchedKeywords: ['Geprüft', 'ACKNOWLEDGE_STABLE'],
        snippet: 'Entscheidung durch Administrator: SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat berücksichtigt',
        changeDetected: false,
        actionRequired: false,
        note: 'SchVG-Anleiheverlängerung bis 2028 bekannt und im Mandat berücksichtigt'
      },
      {
        id: 'audit-pt-00',
        timestamp: '2026-10-27T09:00:00Z',
        sourceType: 'HANDELSREGISTER',
        sourceTitle: 'Amtsgericht Mannheim HRB 743304 - Amtliche Registerbekanntmachung',
        sourceUrl: 'https://www.handelsregister.de',
        matchLevel: MATCH_LEVELS.SEARCH_HIT,
        matchedKeywords: ['Vorstand', 'Satzungsänderung'],
        snippet: 'Amtsgericht Mannheim HRB 743304: PAUL Tech AG (Theodor-Heuss-Anlage 12, 68165 Mannheim). Eintragung Satzungsneufassung und Vertretungsbefugnis Vorstand.',
        changeDetected: false,
        actionRequired: false,
        note: 'Register-Basisprüfung erfolgreich: HRB 743304 aktiv verifiziert.'
      }
    ],
    notes: 'Übermittelt an taskforce (Frank Sieger). 18 Monate Käufer- & Kundenschutz verbindlich aktiviert. SchVG-Gläubigerabstimmung in Mannheim.',
    source: 'Anleihen-Finder.de / Gläubigerversammlung Mannheim · ISIN DE000A3H2TU8'
  },
  {
    id: 'arch-cosquare-2026-01',
    company: 'cosquare AG',
    countryMarket: 'CH · Zug (SHAB)',
    role: 'Mitglied des Verwaltungsrates (Ersatzbesetzung)',
    transmittedTo: 'Top Fifty AG · Pierina Tannò',
    transmittedAt: '2026-10-26T10:33:01Z',
    protectionUntil: '2026-11-09T23:59:59Z',
    protection_months: 18,
    status: 'ANGEBOTEN_RESERVIERT',
    register_id: 'Kanton Zug CHE-457.384.964',
    company_domain: 'cosquare.com',
    ir_news_url: 'https://www.shab.ch',
    last_audit_check: '2026-10-27T12:00:00Z',
    has_change_alert: false,
    has_change_hint: false,
    changeDetected: false,
    match_level: MATCH_LEVELS.VERIFIED_STABLE,
    change_flag: MATCH_LEVELS.VERIFIED_STABLE,
    last_acknowledged_snapshot: {
      hash: 'h_cosquare_initial_ack',
      substantiveText: 'handelsregisteramt des kantons zug cosquare ag che 457 384 964 shab mutation organvakanz',
      timestamp: '2026-10-27T12:00:00Z',
      reviewer: 'Administrator',
      decision: 'ACKNOWLEDGE_STABLE',
      notes: 'Organvakanz im Verwaltungsrat unbesetzt, 14-tägige Exklusivität aktiv.'
    },
    last_scraped_snapshot: {
      hash: 'h_cosquare_initial_ack',
      substantiveText: 'handelsregisteramt des kantons zug cosquare ag che 457 384 964 shab mutation organvakanz',
      timestamp: '2026-10-27T12:00:00Z',
      matchedKeywords: ['Verwaltungsrat', 'Organvakanz']
    },
    audit_log: [
      {
        id: 'audit-cosq-01',
        timestamp: '2026-10-27T12:00:00Z',
        sourceType: 'HANDELSREGISTER',
        sourceTitle: 'Handelsregisteramt Kanton Zug – SHAB Mutation CHE-457.384.964',
        sourceUrl: 'https://www.shab.ch',
        matchLevel: MATCH_LEVELS.SEARCH_HIT,
        matchedKeywords: ['Verwaltungsrat', 'Organvakanz'],
        snippet: 'Handelsregisteramt des Kantons Zug: cosquare AG (CHE-457.384.964, Bundesplatz 14, 6302 Zug). SHAB-Mutation: Organvakanz im Verwaltungsrat.',
        changeDetected: false,
        actionRequired: false,
        note: 'Organvakanz im Verwaltungsrat unbesetzt, 14-tägige Exklusivität für Top Fifty AG aktiv.'
      }
    ],
    notes: 'Exklusive 14-tägige Reservierung für Top Fifty AG / Pierina Tannò.',
    source: 'Schweizerisches Handelsamtsblatt (SHAB) · Ref. CH-ZG-2026-VR-01'
  }
];

export function loadMandates() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[watchdog] Could not load state file, using defaults:', e.message);
  }
  return DEFAULT_PROTECTED_MANDATES;
}

export function saveMandates(mandates) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(mandates, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[watchdog] Error saving state:', e.message);
    return false;
  }
}

export async function runMandateWatchdog() {
  console.log('\n======================================================================');
  console.log('🔍 NEXUS MANDATE WATCHDOG: FORENSISCHES AUDIT GESCHÜTZTER MANDATE');
  console.log('   Intervall: 14-Tage Turnus / 1x wöchentlicher Cronjob');
  console.log('   Modell: 3 Stufen (SEARCH_HIT -> CHANGE_HINT -> VERIFIED_CHANGE)');
  console.log('======================================================================\n');

  const mandates = loadMandates();
  const protectedList = mandates.filter(m => m.status === 'AKTIV_GESCHUETZT' || m.status === 'ANGEBOTEN_RESERVIERT' || m.status === 'ACTIVE_PROTECTED');

  console.log(`📋 Gefundene geschützte Mandate: ${protectedList.length}`);
  const nowStr = new Date().toISOString();
  const alerts = [];
  const updatedMandates = [];

  for (const mandate of mandates) {
    if (mandate.status !== 'AKTIV_GESCHUETZT' && mandate.status !== 'ANGEBOTEN_RESERVIERT' && mandate.status !== 'ACTIVE_PROTECTED') {
      updatedMandates.push(mandate);
      continue;
    }

    console.log(`\n🏢 [Prüfe] ${mandate.company} (${mandate.register_id || 'Keine Registernummer'})`);
    console.log(`   Übermittelt an: ${mandate.transmittedTo} | Status: ${mandate.status}`);

    // 1. Amtliche Register-Identitätsprüfung
    const regCheck = verifyMandateRegisterIdentity(mandate);
    console.log(`   Register-Verifikation: ${regCheck.isValid ? '✅ Amtlich bestätigt (' + regCheck.registerId + ')' : '⚠️ UNBESTÄTIGT (' + regCheck.status + ')'}`);
    if (!regCheck.isValid) {
      console.log(`   -> Grund: ${regCheck.reason || regCheck.message}`);
    }

    // 2. Fristenberechnung (Ultimo-Regel, verankert am Übermittlungsdatum)
    const deadline = computeDeadlineStatus(mandate);
    if (!deadline || !deadline.isValid) {
      console.log(`   🚨 Fristen-Validierungsfehler: ${deadline?.errorMessage || 'Übermittlungsdatum fehlt'}`);
    } else {
      console.log(`   Fristen-Audit (Ausgangsdatum: ${deadline.transmittedDateFormatted} UTC):`);
      console.log(`   - 14T-Audit fällig? ${deadline.isAuditDue ? '🚨 JA (Zyklus fällig)' : '✅ Nein (Nächster Check: ' + deadline.nextAuditDate + ')'}`);
      console.log(`   - 30T-Review mit Provider: in ${deadline.review30DiffDays} Tagen (${deadline.review30Date})`);
      console.log(`   - 60T-Nachfassen: in ${deadline.followup60DiffDays} Tagen (${deadline.followup60Date})`);
      console.log(`   - Kundenschutz: ${deadline.protectionRemainingDays} Tage verbleibend (bis ${deadline.protectionUntilDate}, ${deadline.protectionMonths} Monate)`);
    }

    // 3. Forensisches Watchdog-Audit mit Snapshot-Differenz & Re-Alert-Schutz
    const audited = await runWatchdogAuditForMandate(mandate);

    console.log(`   Evidenz-Stufe: [${audited.match_level}]`);
    console.log(`   Alert aktiv? ${audited.has_change_alert ? '🚨 JA (Prüfung erforderlich)' : '✅ NEIN (Stabil / Kein neuer Alert)'}`);
    console.log(`   changeDetected: ${audited.changeDetected ? '⚠️ TRUE (Bestätigte Veränderung)' : 'FALSE (Keine menschlich bestätigte Veränderung)'}`);

    if (audited.has_change_alert) {
      console.log(`   -> Prüfgrund: ${audited.change_alert_details?.summary}`);
      alerts.push({
        company: audited.company,
        registerId: audited.register_id,
        matchLevel: audited.match_level,
        summary: audited.change_alert_details?.summary || 'Veränderungshinweis erkannt',
        keywords: audited.change_alert_details?.keywords || []
      });
    }

    updatedMandates.push(audited);
  }

  saveMandates(updatedMandates);

  // Erstelle Watchdog Report
  const report = {
    executed_at: nowStr,
    total_audited: protectedList.length,
    alerts_count: alerts.length,
    alerts,
    mandates_summary: updatedMandates.map(m => {
      const d = computeDeadlineStatus(m);
      return {
        company: m.company,
        register_id: m.register_id,
        status: m.status,
        match_level: m.match_level,
        has_change_alert: m.has_change_alert,
        changeDetected: m.changeDetected,
        last_audit_check: m.last_audit_check,
        deadlines: d && d.isValid ? {
          isAuditDue: d.isAuditDue,
          nextAuditDate: d.nextAuditDate,
          review30Days: d.review30DiffDays,
          followup60Days: d.followup60DiffDays,
          protectionDays: d.protectionRemainingDays,
          protectionUntilDate: d.protectionUntilDate
        } : { error: d?.errorMessage || 'Unvollständige Fristdaten' }
      };
    })
  };

  try {
    const reportDir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[watchdog] Could not save report file:', e.message);
  }

  console.log('\n======================================================================');
  console.log(`✅ FORENSISCHES WATCHDOG-AUDIT ERFOLGREICH ABGESCHLOSSEN`);
  console.log(`   Geprüfte Mandate: ${protectedList.length}`);
  console.log(`   Offene Alarme (Prüfhinweise Stufe 2): ${alerts.length}`);
  if (alerts.length > 0) {
    alerts.forEach((a, i) => {
      console.log(`   ${i + 1}. [${a.company}] (${a.registerId}): [${a.matchLevel}] ${a.summary}`);
    });
  } else {
    console.log(`   Alle quittierten Mandate sind stabil (Re-Alert-Schutz aktiv).`);
  }
  console.log(`   Report gesichert in: ${REPORT_FILE}`);
  console.log('======================================================================\n');

  return report;
}

// Direkte CLI-Ausführung wenn script aufgerufen wird
if (process.argv[1] && (process.argv[1].endsWith('mandate_watchdog.js') || process.argv[1].endsWith('watchdog_protected_leads.js'))) {
  runMandateWatchdog().catch(err => {
    console.error('Fatal watchdog error:', err);
    process.exit(1);
  });
}
