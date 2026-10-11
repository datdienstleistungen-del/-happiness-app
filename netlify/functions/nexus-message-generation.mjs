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
import { callLLM as callProviderChain } from './_shared/llm-core.mjs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function callLLM(prompt, temperature = 0.7) {
  // Kette Groq -> OpenRouter -> Mistral -> DeepSeek -> OpenAI via
  // _shared/llm-core.mjs (die toten OR-Modelle der alten Tabelle entfaellt,
  // Modelllisten kommen aus der Registry). Liefert parsedes JSON, { raw } bei
  // unbrauchbarem Output oder null, wenn alle Provider versagen.
  try {
    const { text } = await callProviderChain([
      { role: 'system', content: 'Du gibst IMMER valides JSON zurück, ohne Markdown-Blöcke.' },
      { role: 'user', content: prompt }
    ], {
      providers: ['groq', 'openrouter', 'mistral', 'deepseek', 'openai'],
      temperature,
      max_tokens: 1500,
      totalBudgetMs: 20000,
    });
    const cleaned = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { return { raw: text }; }
  } catch (e) {
    console.warn('[MessageGen] LLM chain failed:', e.message);
    return null;
  }
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
  
  const prompt = `Du bist ein Elite B2B-Sales-Copywriter und Meister des Problem-First-Outreach. Erstelle eine individuelle Erstansprache nach der strengen 5-SCHRITTE-PROBLEM-FIRST-METHODIK.

KONTEXT (nur diese Daten verwenden):
${contextStr}

STRENGE REGELN:
1. Verwende NUR Informationen aus dem obigen Kontext
2. Erfinde KEINE Fakten über die Person oder das Unternehmen
3. Keine erfundenen Leistungszahlen
4. STRENGSTES VERBOT: Beginne NIEMALS mit "wir haben erfahren", "ich habe gesehen", "ich habe zufällig gesehen", "wir freuen uns", "mit Interesse".
5. ABSOLUTES FLOSKEL-VERBOT: Keine Floskeln wie "maßgeschneiderte Lösungen", "höchste Qualitätsstandards", "wir bieten Ihnen", "unser Portfolio", "innovative Lösungen", "zuverlässiger Partner".
6. KEIN TERMIN-DRUCK: Frage NIEMALS nach einem Telefonat oder Termin ("Haben Sie 15 Minuten?", "Wollen wir telefonieren?", "Wann passt es für einen Call?").

STRUKTUR (EXAKT DIESE 5 SCHRITTE):
Anrede: Persönlich ("Sehr geehrte(r) Frau/Herr [Nachname]," bzw. "Guten Tag Frau/Herr [Nachname],")
1. TRIGGER: Starte direkt mit dem konkreten Fakt/Ereignis, belegt mit Quelle und Datum (z.B. "Sie planen [Projekt] – laut [Quelle] vom [Datum].")
2. PROBLEM: Drei typische operative Engpässe, die daraus für den Entscheider in seiner Rolle entstehen ("Bei Vorhaben dieser Größenordnung entstehen für [Rolle] typischerweise drei Engpässe: [1], [2] und [3].")
3. KONSEQUENZ: Was der Entscheider persönlich riskiert, wenn diese Engpässe ungeklärt bleiben (Zeitverlust im Projektplan, Budgetrisiko, interner Druck vor Vorstand/GF).
4. LÖSUNG: Reiner Nutzen und messbares Ergebnis unseres Angebots, der diese Konsequenz verhindert (Fokus auf NUTZEN, KEINE Feature-Listen, keine Floskeln!).
5. NÄCHSTER SCHRITT: Extrem niedrigschwellig und nützlich ("Ich schicke Ihnen dazu gerne eine kurze 1-seitige Übersicht / Checkliste – wäre das hilfreich?").

Gib ein JSON zurück:
{
  "subject": "Betreff-Zeile (kurz, konkret, TRIGGER-bezogen)",
  "message": "Die vollständige Nachricht mit den 5 Schritten (durch Absätze getrennt)",
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
