/**
 * NeXus Email Verify (SMTP Check)
 * 
 * Phase 10b: E-Mail-Verifikation via SMTP-Handshake
 * 
 * Ablauf:
 * 1. Catch-All-Check: Test mit fake@domain
 * 2. SMTP-Handshake: HELO → MAIL FROM → RCPT TO → Antwort
 * 3. Kein DATA (kein tatsächlicher Versand)
 * 
 * Drei Ausgänge:
 * - 250 OK → Adresse existiert wahrscheinlich → verified
 * - 550/551 → Adresse existiert nicht → guessed bleibt
 * - Timeout/Unclear → unclear, Retry möglich
 * 
 * Rate-Limit: 1 Check/Sekunde
 */

import { createClient } from '@supabase/supabase-js';
import { findMxHosts, smtpCheck, isCatchAll } from './nexus-smtp-utils.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  try {
    const { contactId, email, domain } = JSON.parse(event.body);
    
    if (!email || !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: 'email and domain required' }) };
    }
    
    console.log(`[EmailVerify] Verifying ${email} @ ${domain}`);
    
    // Auth check
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    
    // MX-Server finden
    const mxHosts = await findMxHosts(domain);
    if (mxHosts.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'no_mx',
          email,
          domain,
          confidence: 'unknown',
          message: 'Keine MX-Server gefunden'
        })
      };
    }
    
    const mxHost = mxHosts[0];
    console.log(`[EmailVerify] Using MX: ${mxHost}`);
    
    // Catch-All-Check
    const catchAll = await isCatchAll(mxHost, domain);
    if (catchAll) {
      console.log(`[EmailVerify] Domain is Catch-All`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'catch_all',
          email,
          domain,
          mxHost,
          confidence: 'guessed',
          message: 'Domain akzeptiert jede Adresse (Catch-All). Keine Verifikation möglich.'
        })
      };
    }
    
    // SMTP-Check
    const result = await smtpCheck(mxHost, email, 10000);
    console.log(`[EmailVerify] SMTP result: ${result.code} ${result.message}`);
    
    let confidence = 'unknown';
    if (result.success && result.code === 250) {
      confidence = 'verified';
    } else if (result.code >= 550 && result.code <= 553) {
      confidence = 'invalid';
    }
    
    // In DB aktualisieren (wenn contactId vorhanden)
    if (contactId && confidence !== 'unknown') {
      const serviceClient = createClient(supabaseUrl, supabaseKey);
      await serviceClient
        .from('nexus_contacts')
        .update({
          email_confidence: confidence === 'verified' ? 95 : 0,
          email_source: confidence === 'verified' ? 'smtp_check' : 'smtp_invalid',
          email_verified_at: new Date().toISOString()
        })
        .eq('id', contactId);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: result.success ? 'verified' : 'invalid',
        email,
        domain,
        mxHost,
        confidence,
        smtpCode: result.code,
        smtpMessage: result.message
      })
    };
    
  } catch (e) {
    console.error('[EmailVerify] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
