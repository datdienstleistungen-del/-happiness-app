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
  
  // Verhindert Halluzinationen von Zahlen und Referenzen, die den Vertriebler blamieren und NeXus verbrennen.
  const WAHRHEITSREGEL = `WAHRHEITSREGEL:
Du darfst NUR Aussagen treffen, die durch den übergebenen Kontext (Trigger, Angebot, Ansprechpartner, Quellen) belegt sind. 

STRENG VERBOTEN:
- Erfundene Zahlen ("15 % Steigerung", "6 Wochen kürzer")
- Erfundene Referenzen ("bei Siemens, Bosch, Telekom")
- Erfundene Ergebnisse ("in vergleichbaren Projekten")
- Erfundene Zeitangaben ("innerhalb von zwei Wochen")
- Erfundene Kunden ("unser Kunde XY")
- Erfundene Fallstudien ("ein ähnlicher Fall zeigte...")

ERLAUBT:
- Aussagen, die direkt aus dem Trigger abgeleitet sind
- Aussagen, die direkt aus dem Angebot abgeleitet sind
- Allgemeine Formulierungen ohne konkrete Zahlen: "Wir haben Erfahrung mit ähnlichen Fällen", "Wir können Ihnen eine Übersicht schicken, wie wir dort vorgehen"
- Wenn echte Zahlen im Kontext stehen: Diese dürfen zitiert werden

BEI UNSICHERHEIT:
Wenn du keine belegten Zahlen hast, formuliere ohne Zahlen. 
Lieber vage und ehrlich als konkret und erfunden.`;

  const prompt = `${WAHRHEITSREGEL}

Du bist ein Elite B2B-Sales-Copywriter und Meister des Problem-First-Outreach. Erstelle eine individuelle Erstansprache nach der strengen 5-SCHRITTE-PROBLEM-FIRST-METHODIK.

KONTEXT (nur diese Daten verwenden):
${contextStr}

STRENGE REGELN:
1. Verwende NUR Informationen aus dem obigen Kontext
2. Erfinde KEINE Fakten über die Person oder das Unternehmen
3. Keine erfundenen Leistungszahlen, Kennzahlen oder Referenzen. Beachte strikt die WAHRHEITSREGEL!
4. STRENGSTES VERBOT: Beginne NIEMALS mit "wir haben erfahren", "ich habe gesehen", "ich habe zufällig gesehen", "wir freuen uns", "mit Interesse".
5. ABSOLUTES FLOSKEL-VERBOT: Keine Floskeln wie "maßgeschneiderte Lösungen", "höchste Qualitätsstandards", "wir bieten Ihnen", "unser Portfolio", "innovative Lösungen", "zuverlässiger Partner".
6. KEIN TERMIN-DRUCK: Frage NIEMALS nach einem Telefonat oder Termin ("Haben Sie 15 Minuten?", "Wollen wir telefonieren?", "Wann passt es für einen Call?").

# HARTE LÄNGEN-REGEL: MAXIMAL 5 SÄTZE!
Ein Vertriebler muss diesen Pitch in 10 Sekunden erfassen können. Alles Unnötige wird gestrichen.
Die Nachricht im Feld "message" besteht (nach einer optionalen persönlichen Anredezeile) aus EXAKT 5 SÄTZEN:

1. SATZ 1 (TRIGGER): Was ist passiert? (Startet direkt mit dem Trigger/Projekt, nennt Quelle/Domain und Datum).
   - Muster: "[Firma] [Ereignis] – laut [Quelle/Domain] vom [Datum]."
2. SATZ 2 (PROBLEM): Drei KONKRETE Engpässe des Entscheiders (KEINE Wünsche, KEINE Features!).
   - JEDER Engpass muss ein konkretes operatives Problem mit Ursache & Auswirkung beschreiben (z.B. "unterschiedliche CRM-Systeme in den Regionen (führt zu doppelten Leads)..."). Wünsche wie "Echtzeit-Überwachung" sind verboten!
3. SATZ 3 (KONSEQUENZ): Was riskiert der Entscheider/die Firma bei Untätigkeit? (Konkreter Zeitverlust, Budgetüberschreitung, Reibung).
4. SATZ 4 (LÖSUNG): Auf DIESEN KONKRETEN LEAD bezogener Nutzen (KEINE FEATURE-LISTE, KEINE ERFUNDENEN ZAHLEN/REFERENZEN!).
   - Niemals allgemeine Produkt-Slogans aus dem Angebot kopieren! Beziehe den Nutzen direkt auf die Engpässe dieses Leads.
   - Formuliere ehrlich ohne Zahlen ("Wir unterstützen [Zielgruppe] dabei... – wir haben Erfahrung mit ähnlichen Fällen").
5. SATZ 5 (NÄCHSTER SCHRITT): Niedrigschwelliges Angebot ohne Termindruck ("Ich schicke Ihnen gerne eine 1-seitige Übersicht, wie das funktioniert – wäre das hilfreich?").

Gib ein JSON zurück:
{
  "subject": "Betreff-Zeile (kurz, konkret, TRIGGER-bezogen)",
  "message": "Der fertige Pitch mit maximal 5 Sätzen",
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
