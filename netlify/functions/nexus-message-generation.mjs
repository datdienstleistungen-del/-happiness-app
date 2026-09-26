/**
 * NeXus Message Generation
 * 
 * Erzeugt eine individuelle Erstansprache basierend auf:
 * - Contact Intelligence (Name, Rolle, Evidenz, Quelle)
 * - Offering
 * - Company
 * - Trigger Event
 * - Research
 * 
 * REGEL: Keine erfundenen Fakten. Nur belegter Kontext.
 */

import { createClient } from '@supabase/supabase-js';
import { checkTextGroundedInSource, checkMessageGroundedMechanical, detectConcreteNumbers } from './grounding-helpers.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// ============================================================================
// WEB SEARCH (DuckDuckGo → SearXNG)
// ============================================================================

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(abortId);
    return { res, abortId };
  } catch (e) {
    clearTimeout(abortId);
    throw e;
  }
}

async function callLLM(prompt, temperature = 0.7) {
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

  const providers = [
    { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'allam-2-7b' },
    { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'openai/gpt-oss-20b' },
    { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'openai/gpt-oss-120b' },
    { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'qwen/qwen3.8-27b' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'nex-agi/nex-n2.5-mini:free' },
    { url: 'https://openrouter.ai/api/v1/chat/completions', key: openrouterKey, model: 'nvidia/nemotron-3.5-lightning:free' },
    { url: 'https://api.mistral.ai/v1/chat/completions', key: mistralKey, model: 'mistral-small-latest' },
    { url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' },
    { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
  ];
  
  for (const p of providers) {
    if (!p.key) continue;
    try {
      const { res } = await fetchWithTimeout(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
            { role: 'user', content: prompt }
          ],
          temperature,
          max_tokens: 1500
        })
      }, 8000);
      
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      
      const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      try { return JSON.parse(cleaned); } catch(e) { return { raw: text }; }
    } catch (e) { continue; }
  }
  return null;
}

// ============================================================================
// MESSAGE GENERATION
// ============================================================================

async function generateMessage(context) {
  const { contact, offering, company, trigger, research } = context;
  
  // Build context summary for the LLM
  const contextParts = [];
  
  if (company?.name) contextParts.push(`FIRMA: ${company.name}`);
  if (company?.industry) contextParts.push(`BRANCHE: ${company.industry}`);
  if (company?.size) contextParts.push(`GROESSE: ${company.size}`);
  
  if (contact?.name) contextParts.push(`ANSprechpartner: ${contact.name}`);
  if (contact?.role) contextParts.push(`ROLLE: ${contact.role}`);
  if (contact?.evidence) contextParts.push(`EVIDENZ: "${contact.evidence}"`);
  if (contact?.source_url) contextParts.push(`QUELLE: ${contact.source_url}`);
  
  if (offering?.offering_name) contextParts.push(`ANGEBOT: ${offering.offering_name}`);
  if (offering?.positioning) contextParts.push(`POSITIONIERUNG: ${offering.positioning}`);
  if (offering?.target_audience) contextParts.push(`ZIELGRUPPE: ${offering.target_audience}`);
  
  if (trigger?.content) contextParts.push(`TRIGGER: ${trigger.content}`);
  if (trigger?.trigger_type) contextParts.push(`TRIGGER-TYP: ${trigger.trigger_type}`);
  
  if (research?.summary) contextParts.push(`RESEARCH: ${research.summary}`);
  
  const contextStr = contextParts.join('\n');
  
  const prompt = `Du bist ein B2B-Vertriebsexperte. Erstelle eine individuelle Erstansprache.

KONTEXT (nur diese Daten verwenden):
${contextStr}

STRENGE REGELN:
1. Verwende NUR Informationen aus dem obigen Kontext
2. Erfinde KEINE Fakten über die Person oder das Unternehmen
3. Erwähne KEINE Budgets, Probleme oder Entscheidungen, die nicht belegt sind
4. Erwähne KEINE konkreten Leistungszahlen (Prozente, Euro, Stückzahlen), es sei denn, sie sind explizit im Kontext belegt
5. Unterscheide FACT (was belegt ist) von INTERPRETATION (was du daraus ableitest)
6. Die Nachricht soll kurz und natürlich sein (3-5 Sätze)
7. Persönliche Anrede mit Name
8. Konkreter Anlass = Trigger
9. Verbindung zum Offering = was du anbietest
10. Einfache Handlungsaufforderung (Gesprächsangebot)
11. KEIN Marketing-Blabla, KEINE KI-Floskeln

STRUKTUR:
1. Anrede (Name, Rolle)
2. Anlass (Trigger - was ist passiert?)
3. Angebot (was bietest du an?)
4. Nutzen (warum relevant?)
5. Handlungsaufforderung (Gespräch?)

Gib ein JSON zurück:
{
  "subject": "Betreff-Zeile (kurz, konkret)",
  "message": "Die vollständige Nachricht",
  "used_facts": ["Liste der verwendeten Fakten"],
  "interpretations": ["Liste der Interpretationen"],
  "sources": ["Quellen für verwendete Fakten"]
}`;
  
  return await callLLM(prompt, 0.7);
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
  
  const startTime = Date.now();
  const HARD_LIMIT_MS = 18000;
  
  try {
    const { contact, offering, company, trigger, research } = JSON.parse(event.body);
    
    console.log(`[MessageGen] Starting for company ${company?.name}, contact ${contact?.name}`);
    
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
    
    // === COMPETITOR HARD GATE ===
    // Nachrichtengenerierung für erkannte Konkurrenten sofort blockieren
    if (company?.id) {
      const serviceClient = createClient(supabaseUrl, supabaseKey);
      const { data: profile } = await serviceClient
        .from('nexus_company_profiles')
        .select('is_competitor, competitor_reason')
        .eq('company_id', company.id)
        .eq('status', 'done')
        .maybeSingle();
      
      if (profile?.is_competitor) {
        console.log(`[MessageGen] BLOCKED: company ${company.id} is competitor — ${profile.competitor_reason}`);
        return {
          statusCode: 403,
          body: JSON.stringify({
            error: 'Nachrichtengenerierung blockiert: Firma als Mitbewerber erkannt.',
            reason: profile.competitor_reason
          })
        };
      }
    }
    
    // Validate required data
    if (!contact?.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Contact name required' }) };
    }
    
    // Generate message
    console.log('[MessageGen] Generating message...');
    const result = await generateMessage({ contact, offering, company, trigger, research });
    
    if (!result) {
      return { statusCode: 500, body: JSON.stringify({ error: 'LLM generation failed' }) };
    }
    
    const message = result.raw || result.message || '';
    const subject = result.subject || '';
    const usedFacts = result.used_facts || [];
    const interpretations = result.interpretations || [];
    const sources = result.sources || [];
    
    // Grounding Check: Mechanisch — Nachricht in Sätze segmentieren, jeden gegen Evidence prüfen
    // Läuft OHNE LLM-Input — das LLM kann diesen Check nicht umgehen
    const evidenceText = contact?.evidence || '';
    let groundingResults = [];
    let groundingPassed = true;
    if (message && evidenceText) {
      const { allGrounded, results } = checkMessageGroundedMechanical(message, evidenceText);
      groundingResults = results;
      groundingPassed = allGrounded;
      if (!allGrounded) {
        const ungrounded = results.filter(r => !r.grounded).map(r => `"${r.sentence.substring(0, 60)}..." (${r.reason})`);
        console.warn(`[MessageGen] Ungroundete Sätze: ${ungrounded.join(', ')}`);
      }
    }
    
    // Number Check: Warnung bei konkreten Leistungszahlen ohne Quellenbeleg
    const { hasNumbers, numbers } = detectConcreteNumbers(message);
    const numberWarning = hasNumbers ? { detected: true, numbers, hasSource: sources.length > 0 } : null;
    
    // Gesamt-Warning-Status
    const hasGroundingWarnings = !groundingPassed || numberWarning?.detected;
    const groundingWarnings = [];
    if (!groundingPassed) {
      groundingWarnings.push(...groundingResults.filter(r => !r.grounded).map(r => ({
        type: 'ungrounded_claim',
        claim: r.sentence,  // Satz statt LLM-self-declared claim
        reason: r.reason
      })));
    }
    if (numberWarning?.detected) {
      groundingWarnings.push({
        type: 'concrete_number',
        numbers: numberWarning.numbers,
        hasSource: numberWarning.hasSource
      });
    }
    
    // DSGVO: Fester Widerspruchshinweis (nicht vom LLM veränderbar)
    const WIDERSPRUCHSHINWEIS = '\n\nFalls Sie keine weiteren Nachrichten dieser Art wünschen, lassen Sie es mich bitte kurz wissen.';
    
    // Hinweis an Nachricht anhängen
    const fullMessage = message + WIDERSPRUCHSHINWEIS;
    
    console.log(`[MessageGen] Generated message: ${fullMessage.length} chars (incl. Widerspruchshinweis)`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'generated',
        subject,
        message: fullMessage,
        message_without_disclaimer: message,
        used_facts: usedFacts,
        interpretations,
        sources,
        email_status: contact?.email_status || 'UNKNOWN',
        contact_name: contact.name,
        contact_role: contact.role,
        // Grounding-Flags für Frontend
        has_grounding_warnings: hasGroundingWarnings,
        grounding_warnings: groundingWarnings
      })
    };
    
  } catch (e) {
    console.error('[MessageGen] Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
