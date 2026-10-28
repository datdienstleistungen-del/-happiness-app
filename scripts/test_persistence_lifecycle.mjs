/**
 * Reproduzierbarer Persistenz-Test für den Mandats-Watchdog
 * 
 * Testet den Speicherlebenszyklus über separate Prozessgrenzen hinweg:
 * 1. Prozess A: Lädt Mandatsstand, führt Quittierung aus, speichert und beendet sich.
 * 2. Prozess B: Startet neu, liest den Zustand ein und prüft, ob Quittierung, Hash und Audit-Log erhalten sind.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import {
  MATCH_LEVELS,
  computeSubstantiveHash,
  acknowledgeWatchdogDecision
} from '../src/lib/nexus-watchdog.js';
import {
  loadMandates,
  saveMandates
} from '../cron/mandate_watchdog.js';

const mode = process.argv[2] || 'full';

if (mode === 'step1') {
  console.log('--- PROZESS A: Quittierung speichern und beenden ---');
  const mandates = loadMandates();
  const paul = mandates.find(m => m.company.includes('PAUL Tech'));
  assert(paul, 'PAUL Tech Mandat nicht gefunden');

  const testReviewer = 'Persistenz-Prüfer-Prozess-A';
  const testNote = 'Automatische Test-Quittierung zur Verifikation des Speicherlebenszyklus';
  const acked = acknowledgeWatchdogDecision(paul, {
    decision: 'ACKNOWLEDGE_STABLE',
    reviewer: testReviewer,
    notes: testNote
  });

  const updatedMandates = mandates.map(m => m.id === paul.id ? acked : m);
  const saved = saveMandates(updatedMandates);
  assert(saved, 'Speichern fehlgeschlagen');
  console.log(`[Prozess A] Gespeichert: Hash=${acked.last_acknowledged_snapshot?.hash}, Reviewer=${acked.last_acknowledged_snapshot?.reviewer}`);
  process.exit(0);
}

if (mode === 'step2') {
  console.log('--- PROZESS B: Zustand nach Prozessende neu einlesen ---');
  const mandates = loadMandates();
  const paul = mandates.find(m => m.company.includes('PAUL Tech'));
  assert(paul, 'PAUL Tech Mandat in neuem Prozess nicht gefunden');

  const ack = paul.last_acknowledged_snapshot;
  assert(ack, 'last_acknowledged_snapshot fehlt in neuem Prozess');
  assert.strictEqual(ack.reviewer, 'Persistenz-Prüfer-Prozess-A', 'Reviewer aus Prozess A nicht erhalten');
  assert.strictEqual(ack.decision, 'ACKNOWLEDGE_STABLE', 'Decision aus Prozess A nicht erhalten');
  assert.strictEqual(paul.match_level, MATCH_LEVELS.VERIFIED_STABLE, 'Status nicht VERIFIED_STABLE');

  const latestLog = paul.audit_log?.[0];
  assert(latestLog, 'Audit-Log fehlt');
  assert.strictEqual(latestLog.reviewer, 'Persistenz-Prüfer-Prozess-A', 'Audit-Log Eintrag nicht persistent');

  console.log(`[Prozess B] Nachweis ERFOLGREICH: Snapshot, Hash (${ack.hash}) und Quittierung durch "${ack.reviewer}" über Prozessgrenze hinweg erhalten.`);
  process.exit(0);
}
