/**
 * Netlify Function: nexus-mandate-watchdog
 * 
 * Serverloser Endpunkt zur wöchentlichen oder on-demand Ausführung des
 * Mandats-Watchdogs für geschützte Fälle im Kundenschutz-Register.
 */

import { runMandateWatchdog } from '../../cron/mandate_watchdog.js';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const report = await runMandateWatchdog();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        message: 'Watchdog audit completed successfully',
        report
      })
    };
  } catch (error) {
    console.error('[nexus-mandate-watchdog] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message || 'Unknown watchdog error'
      })
    };
  }
}
