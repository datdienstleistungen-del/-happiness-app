#!/usr/bin/env node
/**
 * Cron-Subtask: watchdog_protected_leads.js
 * 
 * Überwacht geschützte Fälle (Kundenschutz-Register) wöchentlich bzw. im 14-Tage Turnus.
 * 
 * Aufruf:
 *   node scripts/watchdog_protected_leads.js
 */

import { runMandateWatchdog } from '../cron/mandate_watchdog.js';

runMandateWatchdog()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('[watchdog_protected_leads] Error executing watchdog:', err);
    process.exit(1);
  });
