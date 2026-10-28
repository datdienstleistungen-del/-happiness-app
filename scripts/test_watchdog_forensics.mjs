/**
 * Testsuite: Forensische Abschlussprüfung des NeXus Mandats-Watchdogs
 * 
 * Verifiziert exakt die 10 geforderten Prüffälle aus dem Auftrag:
 * 1. Statischer Quelltext mit dem Wort „Vorstand“: kein Veränderungsalarm (SEARCH_HIT, changeDetected: false)
 * 2. Unveränderter Inhalt nach menschlicher Quittierung: kein neuer Alarm (VERIFIED_STABLE)
 * 3. Nur Layout, Navigation, Copyright-Jahr oder dynamische Zeitangaben geändert: kein neuer Alarm (identischer Hash)
 * 4. Tatsächlich neuer relevanter Inhalt: CHANGE_HINT (Prüfhinweis aktiv, changeDetected: false)
 * 5. Mensch bestätigt die Veränderung anhand eines Belegs: VERIFIED_CHANGE (changeDetected: true)
 * 6. Unvollständiges oder ungültiges transmittedAt: INCOMPLETE_RECORD (kein stiller Fristneustart)
 * 7. Ungültige Registerkennung: keine registerbasierte Veränderungsbehauptung (REGISTER_ID_UNVERIFIED)
 * 8. Wiederholter Cronjob: keine doppelten Alarme und kein Überschreiben menschlicher Entscheidungen (Idempotenz)
 * 9. Gleichzeitige Prüfungen: keine inkonsistenten Zustände (deterministische Snapshot-Parallelität)
 * 10. Neuer Prozess nach Quittierung: korrekter Status entsprechend der tatsächlich verfügbaren Persistenz
 * 11. Fristenberechnung: 12 und 18 Kalendermonate, BGB-Ultimo-Regel und Schaltjahre
 */

import assert from 'assert';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MATCH_LEVELS,
  WATCHDOG_SIGNAL_KEYWORDS,
  OFFICIAL_REGISTER_MAPPINGS,
  computeSubstantiveHash,
  normalizeSubstantiveContent,
  verifyMandateRegisterIdentity,
  computeDeadlineStatus,
  runWatchdogAuditForMandate,
  runWatchdogAuditForAllMandates,
  acknowledgeWatchdogDecision,
  auditMandateRegister,
  auditMandateNews
} from '../src/lib/nexus-watchdog.js';
import {
  addCalendarMonthsUtc,
  formatCalendarDateUtc,
  toCalendarDateIso,
  calculateProtectionEndDate
} from '../src/lib/nexus-partners.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ Test ${totalTests}: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ Test ${totalTests} FAILED: ${testName}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ Test ${totalTests}: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ Test ${totalTests} FAILED: ${testName}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n======================================================================');
console.log('🧪 AUSFÜHRUNG DER FORENSISCHEN ABSCHLUSSPRÜFUNG (MANDATS-WATCHDOG)');
console.log('======================================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Statischer Quelltext mit dem Wort „Vorstand“: kein Veränderungsalarm
// --------------------------------------------------------------------------
await runAsyncTest('Fall 1: Statischer Quelltext mit "Vorstand" liefert SEARCH_HIT (changeDetected: false, kein Alarm)', async () => {
  const mandate = {
    id: 't1-paul',
    company: 'PAUL Tech AG',
    register_id: 'AG Mannheim HRB 743304',
    transmittedAt: '2026-10-27T08:00:00Z',
    status: 'AKTIV_GESCHUETZT'
  };

  const regAudit = await auditMandateRegister(mandate);
  assert.strictEqual(regAudit.matchLevel, MATCH_LEVELS.SEARCH_HIT, 'Muss Stufe 1 (SEARCH_HIT) sein');
  assert.strictEqual(regAudit.changeDetected, false, 'changeDetected muss zwingend FALSE sein');
  assert.strictEqual(regAudit.actionRequired, false, 'actionRequired muss false sein');
  assert(regAudit.matchedKeywords.includes('Vorstand'), 'Keyword Vorstand muss erkannt worden sein');

  // Initialer Run auf neues Mandat setzt Baseline ohne Alarm
  const audited = await runWatchdogAuditForMandate(mandate);
  assert.strictEqual(audited.match_level, MATCH_LEVELS.SEARCH_HIT, 'Match-Level muss SEARCH_HIT sein');
  assert.strictEqual(audited.has_change_alert, false, 'Initialer Run darf keinen Fehlalarm auslösen');
  assert.strictEqual(audited.changeDetected, false, 'Niemals eigenmächtig true');
});

// --------------------------------------------------------------------------
// TEST 2: Unveränderter Inhalt nach menschlicher Quittierung: kein neuer Alarm
// --------------------------------------------------------------------------
await runAsyncTest('Fall 2: Unveränderter Inhalt nach menschlicher Quittierung unterdrückt Re-Alert (VERIFIED_STABLE)', async () => {
  const mandate = {
    id: 't2-paul',
    company: 'PAUL Tech AG',
    register_id: 'AG Mannheim HRB 743304',
    transmittedAt: '2026-10-27T08:00:00Z',
    status: 'AKTIV_GESCHUETZT'
  };

  // Erster Scan
  const initialAudit = await runWatchdogAuditForMandate(mandate);
  
  // Menschliche Quittierung
  const acknowledged = acknowledgeWatchdogDecision(initialAudit, {
    decision: 'ACKNOWLEDGE_STABLE',
    reviewer: 'Audit-Admin',
    notes: 'Kenntnis genommen, Mandat stabil'
  });
  assert.strictEqual(acknowledged.match_level, MATCH_LEVELS.VERIFIED_STABLE);
  assert.strictEqual(acknowledged.has_change_alert, false);
  assert(acknowledged.last_acknowledged_snapshot?.hash, 'Snapshot-Hash muss gespeichert sein');

  // Zweiter Scan mit identischem Inhalt
  const secondAudit = await runWatchdogAuditForMandate(acknowledged);
  assert.strictEqual(secondAudit.match_level, MATCH_LEVELS.VERIFIED_STABLE, 'Status muss stabil bleiben');
  assert.strictEqual(secondAudit.has_change_alert, false, 'Re-Alert MUSS unterdrückt werden!');
  assert.strictEqual(secondAudit.changeDetected, false, 'Keine Veränderung');
});

// --------------------------------------------------------------------------
// TEST 3: Nur Layout, Navigation, Copyright-Jahr oder Zeitangaben geändert: kein neuer Alarm
// --------------------------------------------------------------------------
runTest('Fall 3: Nur Layout, Navigation, Copyright-Jahr oder dynamische Zeitangaben geändert erzeugen identischen Hash', () => {
  const htmlVersionA = `
    <html>
      <head><script>var sid = 'nonce=12345';</script></head>
      <body>
        <nav><a href="/">Home</a></nav>
        <p>Amtsgericht Mannheim: Beschluss der Gläubigerversammlung nach SchVG zur Restrukturierung.</p>
        <footer>© 2025 PAUL Tech. Stand: 25.10.2025 14:30 Uhr</footer>
      </body>
    </html>
  `;

  const htmlVersionB = `
    <html>
      <head><script>var sid = 'nonce=99999';</script></head>
      <body>
        <aside>Banner Werbeaktion</aside>
        <p>Amtsgericht Mannheim: Beschluss der Gläubigerversammlung nach SchVG zur Restrukturierung.</p>
        <footer>Copyright 2026 PAUL Tech AG. Stand: 28.10.2026 19:45 Uhr</footer>
      </body>
    </html>
  `;

  const normA = normalizeSubstantiveContent(htmlVersionA);
  const normB = normalizeSubstantiveContent(htmlVersionB);
  const hashA = computeSubstantiveHash(normA);
  const hashB = computeSubstantiveHash(normB);

  assert.strictEqual(normA, normB, 'Normalisierter Text muss identisch sein');
  assert.strictEqual(hashA, hashB, 'Hash muss trotz veränderter Zeitstempel/Copyright identisch sein');
});

// --------------------------------------------------------------------------
// TEST 4: Tatsächlich neuer relevanter Inhalt: CHANGE_HINT
// --------------------------------------------------------------------------
await runAsyncTest('Fall 4: Tatsächlich neuer relevanter Inhalt erzeugt Stufe 2 CHANGE_HINT und löst Alert aus', async () => {
  const mandate = {
    id: 't4-diff',
    company: 'PAUL Tech AG',
    register_id: 'AG Mannheim HRB 743304',
    transmittedAt: '2026-10-27T08:00:00Z',
    status: 'AKTIV_GESCHUETZT',
    last_acknowledged_snapshot: {
      hash: 'h_alter_stand_123',
      substantiveText: 'alter stand vor der restrukturierung',
      timestamp: '2026-10-20T00:00:00Z'
    }
  };

  const audited = await runWatchdogAuditForMandate(mandate);
  assert.strictEqual(audited.match_level, MATCH_LEVELS.CHANGE_HINT, 'Muss CHANGE_HINT sein bei neuem Hash');
  assert.strictEqual(audited.has_change_alert, true, 'has_change_alert muss TRUE sein');
  assert.strictEqual(audited.has_change_hint, true, 'has_change_hint muss TRUE sein');
  assert.strictEqual(audited.changeDetected, false, 'changeDetected darf noch nicht true sein (braucht menschliche Bestätigung)');
});

// --------------------------------------------------------------------------
// TEST 5: Mensch bestätigt die Veränderung anhand eines Belegs: VERIFIED_CHANGE
// --------------------------------------------------------------------------
runTest('Fall 5: Mensch bestätigt die Veränderung anhand eines Belegs (Stufe 3 VERIFIED_CHANGE, changeDetected: true)', () => {
  const mandate = {
    id: 't5-human',
    company: 'PAUL Tech AG',
    match_level: MATCH_LEVELS.CHANGE_HINT,
    has_change_alert: true,
    last_scraped_snapshot: {
      hash: 'h_confirmed_diff',
      substantiveText: 'neuer cfo angetreten'
    }
  };

  const confirmed = acknowledgeWatchdogDecision(mandate, {
    decision: 'CONFIRM_CHANGE',
    reviewer: 'Harro Goerndt',
    notes: 'Amtsantritt von Interim-CFO im Register bestätigt'
  });

  assert.strictEqual(confirmed.match_level, MATCH_LEVELS.VERIFIED_CHANGE, 'Muss VERIFIED_CHANGE sein');
  assert.strictEqual(confirmed.changeDetected, true, 'changeDetected muss jetzt TRUE sein');
  assert.strictEqual(confirmed.has_change_alert, false, 'Offener Alert muss gelöscht sein');
  assert.strictEqual(confirmed.verified_by, 'Harro Goerndt');
  assert.strictEqual(confirmed.verification_notes, 'Amtsantritt von Interim-CFO im Register bestätigt');
  assert(confirmed.verified_at, 'verified_at Zeitstempel muss gesetzt sein');
});

// --------------------------------------------------------------------------
// TEST 6: Unvollständiges oder ungültiges transmittedAt: INCOMPLETE_RECORD
// --------------------------------------------------------------------------
runTest('Fall 6: Unvollständiges oder ungültiges transmittedAt erzeugt INCOMPLETE_RECORD / keinen stillen Fristneustart', () => {
  // Fall 1: Fehlendes Datum
  const missingDateMandate = { id: 't6-missing', company: 'Muster AG' };
  const resMissing = computeDeadlineStatus(missingDateMandate);
  assert.strictEqual(resMissing.isValid, false);
  assert.strictEqual(resMissing.validationError, 'FEHLENDES_UEBERMITTLUNGSDATUM');
  assert.strictEqual(resMissing.status, 'INCOMPLETE_RECORD');

  // Fall 2: Ungültiger String
  const invalidDateMandate = { id: 't6-invalid', company: 'Muster AG', transmittedAt: 'ungültiges-datum' };
  const resInvalid = computeDeadlineStatus(invalidDateMandate);
  assert.strictEqual(resInvalid.isValid, false);
  assert.strictEqual(resInvalid.validationError, 'UNGUELTIGES_UEBERMITTLUNGSDATUM');
  assert.strictEqual(resInvalid.status, 'INVALID_TIMESTAMP');
});

// --------------------------------------------------------------------------
// TEST 7: Ungültige Registerkennung: keine registerbasierte Veränderungsbehauptung
// --------------------------------------------------------------------------
await runAsyncTest('Fall 7: Ungültige Register-ID (HRB 741634 bei PAUL Tech) wird als REGISTER_ID_UNVERIFIED markiert und unterdrückt Alarme', async () => {
  const incorrectMandate = {
    id: 't7-fake-paul',
    company: 'PAUL Tech AG',
    register_id: 'AG Mannheim HRB 741634' // Gehört in Wahrheit zu sitt.app GmbH!
  };

  const regCheck = verifyMandateRegisterIdentity(incorrectMandate);
  assert.strictEqual(regCheck.isValid, false, 'Darf nicht als gültig durchgehen');
  assert.strictEqual(regCheck.status, 'REGISTER_ID_UNVERIFIED');
  assert(regCheck.reason.includes('Diskrepanz'), 'Muss Diskrepanz benennen');

  const regAudit = await auditMandateRegister(incorrectMandate);
  assert.strictEqual(regAudit.matchLevel, MATCH_LEVELS.CLEAN);
  assert.strictEqual(regAudit.changeDetected, false);
  assert.strictEqual(regAudit.registerVerificationStatus, 'REGISTER_ID_UNVERIFIED');
  assert(regAudit.snippet.includes('unterdrückt'), 'Veränderungsbehauptung muss unterdrückt werden');
});

// --------------------------------------------------------------------------
// TEST 8: Wiederholter Cronjob: keine doppelten Alarme und kein Überschreiben
// --------------------------------------------------------------------------
await runAsyncTest('Fall 8: Wiederholter Cronjob erzeugt keine doppelten Alarme und überschreibt keine menschlichen Entscheidungen (Idempotenz)', async () => {
  const mandates = [
    {
      id: 't8-paul',
      company: 'PAUL Tech AG',
      register_id: 'AG Mannheim HRB 743304',
      transmittedAt: '2026-10-27T08:00:00Z',
      status: 'AKTIV_GESCHUETZT',
      last_acknowledged_snapshot: {
        hash: 'h_07c2a6a30b80e5',
        substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
        timestamp: '2026-10-28T18:00:00Z'
      }
    }
  ];

  // Lauf 1
  const run1 = await runWatchdogAuditForAllMandates(mandates);
  assert.strictEqual(run1.alertsFound.length, 0, 'Lauf 1 darf keinen Alert erzeugen');
  assert.strictEqual(run1.mandates[0].match_level, MATCH_LEVELS.VERIFIED_STABLE);

  // Lauf 2 direkt hinterher
  const run2 = await runWatchdogAuditForAllMandates(run1.mandates);
  assert.strictEqual(run2.alertsFound.length, 0, 'Lauf 2 darf keinen Alert erzeugen');
  assert.strictEqual(run2.mandates[0].match_level, MATCH_LEVELS.VERIFIED_STABLE);
  assert.strictEqual(run2.mandates[0].changeDetected, false);
});

// --------------------------------------------------------------------------
// TEST 9: Gleichzeitige Prüfungen: keine inkonsistenten Zustände
// --------------------------------------------------------------------------
await runAsyncTest('Fall 9: Gleichzeitige parallele Prüfungen (Promise.all) erzeugen deterministisch identische Zustände', async () => {
  const mandate = {
    id: 't9-concurrent',
    company: 'PAUL Tech AG',
    register_id: 'AG Mannheim HRB 743304',
    transmittedAt: '2026-10-27T08:00:00Z',
    status: 'AKTIV_GESCHUETZT',
    last_acknowledged_snapshot: {
      hash: 'h_07c2a6a30b80e5',
      substantiveText: 'gläubigerversammlung nach schvg zur laufzeitverlängerung der 35 mio | vertretungsbefugnis vorstand unverändert --- gläubigerversammlung mannheim verlängerung der 35 mio',
      timestamp: '2026-10-28T18:00:00Z'
    }
  };

  const [resA, resB] = await Promise.all([
    runWatchdogAuditForMandate(mandate),
    runWatchdogAuditForMandate(mandate)
  ]);

  assert.strictEqual(resA.match_level, resB.match_level, 'Match-Level muss bei parallelem Aufruf identisch sein');
  assert.strictEqual(resA.has_change_alert, resB.has_change_alert, 'Alert-Status muss identisch sein');
  assert.strictEqual(resA.last_scraped_snapshot.hash, resB.last_scraped_snapshot.hash, 'Snapshot-Hash muss identisch sein');
  assert.strictEqual(resA.changeDetected, false);
  assert.strictEqual(resB.changeDetected, false);
});

// --------------------------------------------------------------------------
// TEST 10: Neuer Prozess nach Quittierung: korrekter Status (Persistenz-Lebenszyklus)
// --------------------------------------------------------------------------
runTest('Fall 10: Neuer Prozess nach Quittierung liest persistenten Stand korrekt ein (Prozessgrenzen-Test)', () => {
  // Führe Prozess A aus (Quittierung schreiben)
  const outA = execSync('node scripts/test_persistence_lifecycle.mjs step1', { cwd: ROOT_DIR, encoding: 'utf-8' });
  assert(outA.includes('Gespeichert: Hash='), 'Prozess A muss erfolgreich speichern');

  // Führe Prozess B aus (in völlig neuem Node.js-Prozess einlesen)
  const outB = execSync('node scripts/test_persistence_lifecycle.mjs step2', { cwd: ROOT_DIR, encoding: 'utf-8' });
  assert(outB.includes('Nachweis ERFOLGREICH'), 'Prozess B muss gespeicherte Quittierung vorfinden');

  // Aufräumen: Reset auf sauberen Admin-Stand
  execSync('node cron/mandate_watchdog.js', { cwd: ROOT_DIR, encoding: 'utf-8' });
});

// --------------------------------------------------------------------------
// TEST 11: Fristenberechnung 12M / 18M mit gesetzlicher Ultimo-Regel & Schaltjahren
// --------------------------------------------------------------------------
runTest('Fall 11: Fristenberechnung nach gesetzlicher Ultimo-Regel (BGB § 188 Abs. 3 / OR Art. 77) & UTC-Sicherheit', () => {
  // 1. Ultimo Nicht-Schaltjahr: 31. Januar 2025 + 1 Monat = 28. Februar 2025
  const jan31_2025 = new Date('2025-01-31T12:00:00Z');
  const plus1_2025 = addCalendarMonthsUtc(jan31_2025, 1);
  assert.strictEqual(formatCalendarDateUtc(plus1_2025), '28.02.2025');

  // 2. Ultimo Schaltjahr: 31. Januar 2024 + 1 Monat = 29. Februar 2024
  const jan31_2024 = new Date('2024-01-31T12:00:00Z');
  const plus1_2024 = addCalendarMonthsUtc(jan31_2024, 1);
  assert.strictEqual(formatCalendarDateUtc(plus1_2024), '29.02.2024');

  // 3. 18 Monate Kundenschutz: 31. Oktober 2026 + 18 Monate = 30. April 2028
  const oct31_2026 = new Date('2026-10-31T08:00:00Z');
  const plus18 = addCalendarMonthsUtc(oct31_2026, 18);
  assert.strictEqual(formatCalendarDateUtc(plus18), '30.04.2028');

  // 4. 12 Monate Kundenschutz: 28. Februar 2026 + 12 Monate = 28. Februar 2027
  const feb28_2026 = new Date('2026-02-28T08:00:00Z');
  const plus12 = addCalendarMonthsUtc(feb28_2026, 12);
  assert.strictEqual(formatCalendarDateUtc(plus12), '28.02.2027');

  // 5. Keine Zeitzonensprünge: 2026-10-27T00:00:00Z muss strikt 27.10.2026 bleiben
  const midnightUtc = new Date('2026-10-27T00:00:00Z');
  assert.strictEqual(formatCalendarDateUtc(midnightUtc), '27.10.2026');
});

console.log('\n======================================================================');
console.log(`📊 TESTERGEBNIS: ${passedTests} von ${totalTests} Testfällen erfolgreich bestanden!`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
