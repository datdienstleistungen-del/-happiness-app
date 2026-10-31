/**
 * Netlify Function: nexus-sync-emails
 * 
 * Serverloser Endpunkt zur Synchronisierung von Partner-E-Mails (@taskforce.net etc.)
 * mit dem NeXus Mandats-Desk und Mandats-Archiv.
 */

import { syncPartnerEmails } from '../../scripts/sync_partner_emails.js';

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
    const result = await syncPartnerEmails({ quiet: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ok',
        message: 'Gmail Partner-Sync erfolgreich ausgeführt',
        total_emails: result.total_emails,
        synced_at: result.synced_at,
        emails: result.emails
      })
    };
  } catch (error) {
    console.error('[nexus-sync-emails] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message || 'Unknown email sync error'
      })
    };
  }
}
