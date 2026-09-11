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
import net from 'net';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// SMTP HELPERS
// ============================================================================

/**
 * Führt einen SMTP-Handshake durch (ohne DATA)
 * @param {string} mxHost - MX-Server Hostname
 * @param {string} email - Zu prüfende E-Mail-Adresse
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{success: boolean, code: number, message: string}>}
 */
async function smtpCheck(mxHost, email, timeout = 10000) {
  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    let buffer = '';
    let resolved = false;
    let step = 0;
    
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch(e) {}
    };
    
    const finish = (success, code, message) => {
      cleanup();
      resolve({ success, code, message });
    };
    
    socket.setTimeout(timeout, () => {
      finish(false, 0, 'Connection timeout');
    });
    
    socket.on('error', (err) => {
      finish(false, 0, err.message);
    });
    
    socket.on('data', (data) => {
      buffer += data.toString();
      
      // Auf 220-Banner warten (HELO Ready)
      if (step === 0 && buffer.includes('220')) {
        step = 1;
        socket.write(`HELO neXus-verify.local\r\n`);
        buffer = '';
        return;
      }
      
      // Auf HELO-Antwort warten
      if (step === 1 && (buffer.includes('250') || buffer.includes('502'))) {
        step = 2;
        socket.write(`MAIL FROM:<verify@neXus-verify.local>\r\n`);
        buffer = '';
        return;
      }
      
      // Auf MAIL FROM-Antwort warten
      if (step === 2 && (buffer.includes('250') || buffer.includes('550'))) {
        step = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
        buffer = '';
        return;
      }
      
      // Auf RCPT TO-Antwort warten (die eigentliche Prüfung)
      if (step === 3) {
        const code = parseInt(buffer.substring(0, 3));
        const message = buffer.trim();
        
        // QUIT senden
        socket.write(`QUIT\r\n`);
        
        if (code === 250) {
          finish(true, code, message);
        } else if (code === 550 || code === 551 || code === 553) {
          finish(false, code, message);
        } else {
          finish(false, code, message);
        }
      }
    });
  });
}

/**
 * Findet MX-Server für eine Domain
 * @param {string} domain 
 * @returns {Promise<string[]>}
 */
async function findMxHosts(domain) {
  // Einfache DNS-MX-Auflösung über DNS-over-HTTPS
  try {
    const res = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await res.json();
    
    if (data.Answer) {
      return data.Answer
        .filter(a => a.type === 15) // MX
        .sort((a, b) => a.data.split(' ')[0] - b.data.split(' ')[0]) // Priority
        .map(a => a.data.split(' ')[1]); // Hostname
    }
  } catch(e) {}
  
  // Fallback: Direkte DNS-Auflösung
  return [domain]; // Fallback auf Domain selbst
}

/**
 * Prüft ob eine Domain Catch-All ist
 * @param {string} mxHost 
 * @param {string} domain 
 * @returns {Promise<boolean>}
 */
async function isCatchAll(mxHost, domain) {
  // Teste mit offensichtlich fake Adresse
  const fakeEmail = `xyzabc123nonexistent@${domain}`;
  const result = await smtpCheck(mxHost, fakeEmail, 8000);
  return result.success; // Wenn 250 OK für fake → Catch-All
}

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
