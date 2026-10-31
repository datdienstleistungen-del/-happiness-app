/**
 * Unit-Tests: Zentrale Mandats-Statusnormalisierung (Phase 1)
 * 
 * Verifiziert:
 * 1. Kanonische Statuswerte bleiben unverändert.
 * 2. Bekannte Zuordnungen (ACTIVE_PROTECTED -> AKTIV_GESCHUETZT, MANDATED -> MANDATIERT, EXPIRED -> ABGELAUFEN, etc.)
 * 3. Case-Insensitivität und Whitespace-Bereinigung.
 * 4. Strikte Abweisung unbekannter Statuswerte (kein stilles Durchwinken).
 * 5. Strikte Abweisung ungültiger Typen (null, undefined, Zahlen, Objekte, leere Strings).
 * 6. Fehlerobjekt-Integrität (InvalidMandateStatusError mit rawStatus und aussagekräftiger Nachricht).
 * 7. isValidMandateStatus() Funktionsverhalten.
 * 8. Unveränderlichkeit (Object.freeze) des Statusmodells.
 */

import assert from 'assert';
import {
  MANDATE_STATUS,
  MANDATE_STATUS_ALIASES,
  InvalidMandateStatusError,
  isValidMandateStatus,
  normalizeMandateStatus
} from '../src/lib/nexus-partners.js';

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ Test ${total}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ Test ${total} FAILED: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('======================================================================');
console.log('🧪 AUSFÜHRUNG DER UNIT-TESTS: STATUSNORMALISIERUNG (PHASE 1)');
console.log('======================================================================\n');

// 1. Kanonische Werte unverändert
test('Kanonische Statuswerte bleiben exakt identisch', () => {
  const canonicalValues = [
    'ANGEBOTEN_RESERVIERT',
    'AKTIV_GESCHUETZT',
    'IN_VERHANDLUNG',
    'MANDATIERT',
    'ABGELAUFEN',
    'STORNIERT'
  ];

  for (const status of canonicalValues) {
    assert.strictEqual(
      normalizeMandateStatus(status),
      status,
      `Kanonischer Status ${status} muss unverändert bleiben`
    );
  }
});

// 2. Bekannte Zuordnung: ACTIVE_PROTECTED -> AKTIV_GESCHUETZT
test('Zuordnung: ACTIVE_PROTECTED -> AKTIV_GESCHUETZT', () => {
  assert.strictEqual(normalizeMandateStatus('ACTIVE_PROTECTED'), MANDATE_STATUS.AKTIV_GESCHUETZT);
  assert.strictEqual(normalizeMandateStatus('active_protected'), MANDATE_STATUS.AKTIV_GESCHUETZT);
  assert.strictEqual(normalizeMandateStatus('  ACTIVE_PROTECTED  '), MANDATE_STATUS.AKTIV_GESCHUETZT);
});

// 3. Bekannte Zuordnung: MANDATED -> MANDATIERT
test('Zuordnung: MANDATED -> MANDATIERT', () => {
  assert.strictEqual(normalizeMandateStatus('MANDATED'), MANDATE_STATUS.MANDATIERT);
  assert.strictEqual(normalizeMandateStatus('mandated'), MANDATE_STATUS.MANDATIERT);
  assert.strictEqual(normalizeMandateStatus('  MANDATED  '), MANDATE_STATUS.MANDATIERT);
});

// 4. Bekannte Zuordnung: EXPIRED -> ABGELAUFEN
test('Zuordnung: EXPIRED -> ABGELAUFEN', () => {
  assert.strictEqual(normalizeMandateStatus('EXPIRED'), MANDATE_STATUS.ABGELAUFEN);
  assert.strictEqual(normalizeMandateStatus('expired'), MANDATE_STATUS.ABGELAUFEN);
  assert.strictEqual(normalizeMandateStatus('  EXPIRED  '), MANDATE_STATUS.ABGELAUFEN);
});

// 5. Zusätzlicher Sprach-Alias: OFFERED_RESERVED -> ANGEBOTEN_RESERVIERT
test('Zuordnung: OFFERED_RESERVED -> ANGEBOTEN_RESERVIERT', () => {
  assert.strictEqual(normalizeMandateStatus('OFFERED_RESERVED'), MANDATE_STATUS.ANGEBOTEN_RESERVIERT);
  assert.strictEqual(normalizeMandateStatus('offered_reserved'), MANDATE_STATUS.ANGEBOTEN_RESERVIERT);
});

// 6. Whitespace und Groß-/Kleinschreibung bei kanonischen Werten
test('Toleranz gegenüber Whitespace und gemischter Schreibweise bei kanonischen Werten', () => {
  assert.strictEqual(normalizeMandateStatus('  aktiv_geschuetzt  '), 'AKTIV_GESCHUETZT');
  assert.strictEqual(normalizeMandateStatus('In_Verhandlung'), 'IN_VERHANDLUNG');
  assert.strictEqual(normalizeMandateStatus('storniert'), 'STORNIERT');
  assert.strictEqual(normalizeMandateStatus('  abgelaufen  '), 'ABGELAUFEN');
});

// 7. Unbekannte Statuswerte werden strikt abgewiesen (kein stilles Umwandeln)
test('Unbekannte Statuswerte lösen InvalidMandateStatusError aus', () => {
  const unknownList = [
    'UNKNOWN',
    'PENDING',
    'ACTIVE',
    'PROPOSED',
    'IN_PROGRESS',
    'RESERVED',
    'GELOESCHT',
    'FOOBAR'
  ];

  for (const unknown of unknownList) {
    assert.throws(
      () => normalizeMandateStatus(unknown),
      (err) => {
        assert(err instanceof InvalidMandateStatusError, 'Muss Instanz von InvalidMandateStatusError sein');
        assert.strictEqual(err.name, 'InvalidMandateStatusError');
        assert.strictEqual(err.rawStatus, unknown);
        assert(err.message.includes(unknown), 'Fehlermeldung muss den ungültigen Wert enthalten');
        return true;
      },
      `Unbekannter Status '${unknown}' muss mit InvalidMandateStatusError abgewiesen werden`
    );
  }
});

// 8. Leere oder Whitespace-Strings werden strikt abgewiesen
test('Leere oder reine Whitespace-Strings werden abgewiesen', () => {
  assert.throws(
    () => normalizeMandateStatus(''),
    InvalidMandateStatusError,
    'Leerer String muss abgewiesen werden'
  );
  assert.throws(
    () => normalizeMandateStatus('   '),
    InvalidMandateStatusError,
    'Reiner Whitespace-String muss abgewiesen werden'
  );
});

// 9. Ungültige Typen (null, undefined, Zahlen, Objekte) werden strikt abgewiesen
test('Nicht-stringbasierte Werte (null, undefined, Zahlen, etc.) werden abgewiesen', () => {
  const invalidTypes = [null, undefined, 123, 0, true, false, {}, [], () => {}];

  for (const val of invalidTypes) {
    assert.throws(
      () => normalizeMandateStatus(val),
      (err) => {
        assert(err instanceof InvalidMandateStatusError);
        assert.strictEqual(err.rawStatus, val);
        return true;
      },
      `Wert vom Typ ${typeof val} muss mit InvalidMandateStatusError abgewiesen werden`
    );
  }
});

// 10. isValidMandateStatus() prüft kanonische Gültigkeit
test('isValidMandateStatus() liefert korrekt true/false', () => {
  // Kanonische Werte müssen true sein
  assert.strictEqual(isValidMandateStatus('AKTIV_GESCHUETZT'), true);
  assert.strictEqual(isValidMandateStatus('ANGEBOTEN_RESERVIERT'), true);
  assert.strictEqual(isValidMandateStatus('IN_VERHANDLUNG'), true);
  assert.strictEqual(isValidMandateStatus('MANDATIERT'), true);
  assert.strictEqual(isValidMandateStatus('ABGELAUFEN'), true);
  assert.strictEqual(isValidMandateStatus('STORNIERT'), true);
  assert.strictEqual(isValidMandateStatus('  aktiv_geschuetzt  '), true);

  // Aliase sind noch nicht normalisiert, daher false
  assert.strictEqual(isValidMandateStatus('ACTIVE_PROTECTED'), false);
  assert.strictEqual(isValidMandateStatus('MANDATED'), false);
  assert.strictEqual(isValidMandateStatus('EXPIRED'), false);

  // Unbekannte Werte und ungültige Typen müssen false sein
  assert.strictEqual(isValidMandateStatus('UNKNOWN'), false);
  assert.strictEqual(isValidMandateStatus(''), false);
  assert.strictEqual(isValidMandateStatus(null), false);
  assert.strictEqual(isValidMandateStatus(undefined), false);
  assert.strictEqual(isValidMandateStatus(42), false);
});

// 11. Fehlerklasse besitzt korrekte Properties und Vererbung
test('InvalidMandateStatusError erbt sauber von Error und speichert Metadaten', () => {
  const err = new InvalidMandateStatusError('TEST_STATUS', 'Benutzerdefinierte Meldung');
  assert(err instanceof Error);
  assert(err instanceof InvalidMandateStatusError);
  assert.strictEqual(err.name, 'InvalidMandateStatusError');
  assert.strictEqual(err.rawStatus, 'TEST_STATUS');
  assert.strictEqual(err.message, 'Benutzerdefinierte Meldung');
});

// 12. Immutability: MANDATE_STATUS und Aliase sind unveränderlich geschützt
test('MANDATE_STATUS und MANDATE_STATUS_ALIASES sind eingefroren (Object.freeze)', () => {
  assert(Object.isFrozen(MANDATE_STATUS), 'MANDATE_STATUS muss gefroren sein');
  assert(Object.isFrozen(MANDATE_STATUS_ALIASES), 'MANDATE_STATUS_ALIASES muss gefroren sein');

  // Schreibversuch darf Objekt im Strict Mode nicht verändern
  assert.throws(() => {
    'use strict';
    MANDATE_STATUS.NEW_KEY = 'FOO';
  }, TypeError);
});

console.log('\n======================================================================');
console.log(`📊 TESTERGEBNIS: ${passed} von ${total} Testfällen erfolgreich bestanden!`);
console.log('======================================================================\n');

if (passed !== total) {
  process.exit(1);
}
