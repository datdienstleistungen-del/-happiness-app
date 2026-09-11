/**
 * NeXus Email Research
 * 
 * Phase 10: E-Mail-Ermittlung
 * 
 * 1. Pattern-Guessing: Erzeugt E-Mail-Adressen basierend auf Name + Domain
 * 2. Optional: SMTP-Check (zweiter Schritt)
 * 
 * REGEL: Keine erfundenen Adressen. Nur logische Muster.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// PATTERN-GUESSING
// ============================================================================

/**
 * Erzeugt E-Mail-Kandidaten basierend auf Name + Domain
 * @param {string} name - Vollständiger Name (z.B. "Armin Lipp")
 * @param {string} domain - Firmendomain (z.B. "corporate-happiness.de")
 * @returns {Array<{email: string, pattern: string, confidence: number}>}
 */
function generateEmailPatterns(name, domain) {
  if (!name || !domain) return [];
  
  // Name aufteilen
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [];
  
  const vorname = parts[0].toLowerCase();
  const nachname = parts[parts.length - 1].toLowerCase();
  
  // Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss)
  const normalize = (str) => str
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
  
  const v = normalize(vorname);
  const n = normalize(nachname);
  
  // Domain bereinigen
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  
  // Häufige E-Mail-Muster (nach Wahrscheinlichkeit sortiert)
  const patterns = [
    { pattern: '{vorname}.{nachname}', email: `${v}.${n}@${cleanDomain}`, confidence: 90 },
    { pattern: '{v}.{nachname}', email: `${v[0]}.${n}@${cleanDomain}`, confidence: 80 },
    { pattern: '{vorname}{nachname}', email: `${v}${n}@${cleanDomain}`, confidence: 70 },
    { pattern: '{vorname}_{nachname}', email: `${v}_${n}@${cleanDomain}`, confidence: 65 },
    { pattern: '{nachname}.{vorname}', email: `${n}.${v}@${cleanDomain}`, confidence: 60 },
    { pattern: '{nachname}{vorname}', email: `${n}${v}@${cleanDomain}`, confidence: 50 },
    { pattern: '{vorname}', email: `${v}@${cleanDomain}`, confidence: 40 },
  ];
  
  return patterns.map(p => ({
    email: p.email,
    pattern: p.pattern,
    confidence: p.confidence,
    method: 'pattern_guessing'
  }));
}

/**
 * Analysiert eine Firmendomain auf bekannte E-Mail-Muster
 * (Optional: Crawlt Impressum/Kontaktseiten nach vorhandenen Adressen)
 */
async function analyzeDomainPatterns(domain) {
  // Für jetzt: Nur Standardmuster verwenden
  // Erweiterung: Impressum-Crawl für vorhandene Adressen
  return { knownPatterns: [], hasImpressum: false };
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
    const { contactId, name, domain, companyId, opportunityId } = JSON.parse(event.body);
    
    if (!name || !domain) {
      return { statusCode: 400, body: JSON.stringify({ error: 'name and domain required' }) };
    }
    
    console.log(`[EmailResearch] Starting for ${name} @ ${domain}`);
    
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
    
    // Pattern-Guessing
    const candidates = generateEmailPatterns(name, domain);
    console.log(`[EmailResearch] Generated ${candidates.length} candidates`);
    
    // Domain-Analyse (optional)
    const domainAnalysis = await analyzeDomainPatterns(domain);
    
    // Besten Kandidaten auswählen
    const bestCandidate = candidates[0] || null;
    
    // In DB speichern (wenn contactId vorhanden)
    if (contactId && bestCandidate) {
      const serviceClient = createClient(supabaseUrl, supabaseKey);
      await serviceClient
        .from('nexus_contacts')
        .update({
          email: bestCandidate.email,
          email_confidence: 'guessed',
          email_source: 'pattern_guessing'
        })
        .eq('id', contactId);
      
      console.log(`[EmailResearch] Saved ${bestCandidate.email} for contact ${contactId}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'generated',
        candidates,
        best: bestCandidate,
        domain: domain,
        contactName: name
      })
    };
    
  } catch (e) {
    console.error('[EmailResearch] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
