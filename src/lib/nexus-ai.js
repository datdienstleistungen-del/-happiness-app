/**
 * NeXus AI Client
 * 
 * Frontend-Client für die NeXus AI Function.
 * Nutzt die bestehende Multi-Provider Infrastruktur (DeepSeek, Mistral, OpenRouter, OpenAI).
 */

import { supabase } from './supabase'

/**
 * Ruft die NeXus AI Function auf
 * Akzeptiert entweder (mode, message, context, temperature) oder ein Objekt
 * @param {string|object} modeOrParams - Der Modus oder ein Objekt mit allen Parametern
 * @param {string} message - Die Nutzereingabe (optional bei Objekt-Aufruf)
 * @param {object} context - Optionale Zusatzinfos (optional)
 * @param {number} temperature - Optionale Temperatur (0-1) (optional)
 * @param {string} lang - Die Sprache des Browsers (optional)
 * @returns {Promise<{response: string, provider: string, model: string}>}
 */
export async function callNexusAI(modeOrParams, message = null, context = null, temperature = 0.3, lang = 'de') {
  let mode, params
  let targetLang = 'auto'
  
  // Handle both object and parameter-based calls
  if (typeof modeOrParams === 'object' && modeOrParams !== null) {
    // Object call: callNexusAI({ mode, angebot, branche, ... })
    mode = modeOrParams.mode
    if (modeOrParams.targetLang) targetLang = modeOrParams.targetLang;
    const { mode: _, targetLang: __, ...rest } = modeOrParams
    
    // Build message from available params
    if (rest.message) {
      message = rest.message
    } else if (mode === 'angebotsanalyse') {
      message = `Analysiere folgendes Angebot:\n\nAngebot: ${rest.angebot || ''}\nBranche: ${rest.branche || ''}`
    } else if (mode === 'trigger_detection') {
      message = rest.query || ''
    } else if (mode === 'lead_intelligence') {
      message = `Unternehmen: ${rest.company || ''}\nAngebot des Verkäufers: ${rest.angebot || ''}`
    } else if (mode === 'sales_pitch' || mode === 'follow_up' || mode === 'einwandbehandlung' || mode === 'forum_response') {
      if (rest.full_context) {
         message = `[NEXUS FULL CONTEXT]\n${JSON.stringify(rest.full_context, null, 2)}\n\n[USER INPUT]\nEinwand: ${rest.einwand || '-'}`;
      } else {
         message = `Firma: ${rest.company || ''}\nAnsprechpartner: ${rest.ansprechpartner || ''}\nBranche: ${rest.branche || ''}\nSituation: ${rest.situation || ''}\nEinwand: ${rest.einwand || ''}`;
      }
    } else if (mode === 'trigger_hypotheses') {
      message = `Kontext: ${rest.context || ''}\nRegion: ${rest.region || ''}\nKategorie: ${rest.category || ''}\nAngebot: ${rest.product || ''}\nZielgruppe: ${rest.audience || ''}`
    } else {
      message = JSON.stringify(rest)
    }
    
    context = rest.context || null
    temperature = rest.temperature || 0.3
    lang = rest.lang || 'de'
  }
  // else: normal parameter call (mode, message, context, temperature, lang)

  // =========================================================================
  // SYSTEM PROMPT GENERATION
  // =========================================================================
  
  let systemPrompt = "Du bist NeXus, ein B2B Sales Intelligence System."
  if (mode !== 'chat') {
    systemPrompt += " Antworte IMMER in validem JSON ohne Markdown-Blöcke (kein ```json)."
  }
  if (mode === 'angebotsanalyse' || mode === 'lead_intelligence') {
    const taskDescription = mode === 'angebotsanalyse' 
      ? 'Analysiere das folgende Angebot und erstelle ein generelles B2B Vertriebsmodell.'
      : 'Analysiere das angegebene Zielunternehmen im Kontext unseres Angebots und erstelle ein hochspezifisches Vertriebsmodell exakt für diesen einen Kunden.';
      
    systemPrompt += ` ${taskDescription} Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
      {
        "zielgruppe": { 
          "beschreibung": "...", 
          "kaufzyklus": "kurz|mittel|lang", 
          "budget_typ": "Capex|Opex|...",
          "entscheider": ["Rolle 1", "Rolle 2"]
        },
        "schmerzpunkte": [
          { "problem": "...", "auswirkung": "...", "dringlichkeit": "hoch|mittel|niedrig" }
        ],
        "trigger_events": [
          { "event": "...", "signifikanz": "hoch|mittel|niedrig" }
        ],
        "vertriebsstrategie": { 
          "empfohlener_kanal": "...", 
          "ansprache_typ": "...",
          "timing": "...",
          "conversion_rate_typisch": "...",
          "sequentielles_vorgehen": ["Schritt 1", "Schritt 2"]
        },
        "pitch_grundlage": { 
          "value_proposition": "...",
          "differenzierung": "...",
          "social_proof": "...",
          "call_to_action": "..."
        }
      }`
  } else if (mode === 'trigger_detection') {
    systemPrompt += ` Du bist ein Radar für Kaufsignale im Markt. Erfinde 4-6 REALISTISCHE, aber fiktive B2B Firmennamen passend zur Zielgruppe, die aktuell ein absolut konkretes Trigger-Event aufweisen.
      
      WICHTIG: Erfinde ECHTE, konkrete Ereignisse (z.B. "Ein Hotelneubau wurde gestern genehmigt", "Baugenehmigung für neue Produktionshalle erteilt", "Stellenanzeige für Konstrukteur veröffentlicht"). KEINE generischen Beschreibungen wie "Die Firma baut Treppen".
      
      Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
      {
        "trigger_events": [
          {
            "firmenname": "...",
            "signal": "Was ist exakt passiert? (z.B. Baugenehmigung, Ausschreibung, Stellenanzeige)",
            "insight": "Warum ist dieses Signal relevant für unser Angebot?",
            "opportunity": "Welche konkrete Chance ergibt sich daraus?",
            "action": "Welche Aktion ist jetzt sinnvoll (z.B. Anruf beim Projektleiter)?",
            "signifikanz": "hoch|mittel|niedrig",
            "kaufwahrscheinlichkeit": 85
          }
        ]
      }`
  } else if (['sales_pitch', 'follow_up', 'einwandbehandlung', 'forum_response'].includes(mode)) {
    systemPrompt += ` Du bist ein Elite B2B-Sales-Copywriter. Deine Aufgabe ist es, eine hochpersonalisierte Vertriebsnachricht zu verfassen. 
  
        WICHTIGSTE REGEL: Der PITCH basiert ZWINGEND auf den übergebenen TRIGGER EVENTS (Feld "triggers" im Kontext).
        Verwende nicht einfach nur "Firmenname + Kontaktname", sondern entwickle eine plausible Verkaufsargumentation aus den Triggern heraus. Falls mehrere Trigger vorhanden sind, beziehe dich auf den wichtigsten oder verknüpfe sie logisch.
  
        DATENFLUSS & STRUKTUR DER NACHRICHT:
        1. Anrede: Beginne die E-Mail ZWINGEND mit der persönlichen Anrede des übergebenen Ansprechpartners (z.B. "Sehr geehrte(r) Herr/Frau [Nachname]"). Nutze NIEMALS "Sehr geehrte Damen und Herren", es sei denn, der Ansprechpartner ist explizit als "unbekannt" markiert.
        2. Aufhänger: Beziehe dich im ersten Absatz auf das spezifische Ereignis/Signal aus den Triggern.
        3. Möglicher Bedarf: Welches konkrete Problem oder welcher Bedarf entsteht durch dieses Ereignis?
        4. Verbindung zum Offering: Warum passt das übergebene Offering (inkl. Positioning) exakt zu diesem entstandenen Bedarf?
        5. Konkreter Nutzen: Welchen echten Mehrwert bieten wir in dieser Situation?
        6. Gesprächseinstieg / Call to Action: Eine weiche, handlungsorientierte Frage für den nächsten sinnvollen Schritt.

      TONALITÄT: 
      - Keine "Gelbe Seiten Kaltakquise".
      - Keine übertriebene KI-Sprache (vermeide "Maßstäbe setzen", "innovative Lösungen", "Ihre Expertise").
      - Keine erfundenen Tatsachen. Unsichere Informationen nur als Annahme formulieren.
      - Professionell, menschlich und auf Augenhöhe.

      WICHTIG: Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
      {
        "thought_trigger": "Analyse: Was ist der Trigger und welcher Bedarf entsteht?",
        "thought_offering": "Analyse: Wie passt das Offering genau zu diesem Bedarf?",
        "response": "Hier kommt die fertige, hochpersonalisierte Nachricht (mit Absätzen als \\n\\n formatiert)."
      }`
  } else if (mode === 'chat') {
    systemPrompt += ` Antworte professionell und hilfsbereit. WICHTIG: Antworte NIEMALS im JSON-Format! Nutze ausschließlich menschenlesbares Markdown (Fließtext, Absätze, Listen) für deine Antworten, egal wie strukturiert die Frage des Nutzers ist.`
  } else if (mode === 'assistant') {
    systemPrompt += ` Du bist der NeXus Assistant, der KI-Produktbegleiter für das 'NeXus Sales Operating System'.
    Deine Aufgabe: Erkläre dem Nutzer das NeXus-System, die Bedienung und die zugrunde liegende Vertriebs-Methodik.
    
    WISSENSGRUNDLAGE (NeXus Product Bible):
    - NeXus beobachtet den Markt anhand eines definierten "Offerings" (Angebot & Zielgruppe).
    - Signal ≠ Trigger. Ein Signal ist ein reiner Fakt (z.B. "Firma X baut neue Halle"). Ein Trigger ist die Interpretation dieses Fakts ("Firma X hat deshalb vermutlich Bedarf an unseren Klimaanlagen").
    - Fakt ≠ Interpretation. NeXus behauptet nie, dass ein Kunde kaufen MUSS, sondern liefert nur eine plausible Begründung (Relevanz), warum man ihn JETZT ansprechen sollte.
    - Die Architektur: Angebotsanalyse -> Lead Radar (findet Signale) -> Opportunity (Lead-Akte) -> Sales Workspace.
    
    REGELN GEGEN HALLUZINATION:
    - Erfinde NIEMALS Funktionen, die NeXus nicht hat! NeXus hat KEINE Integrationen zu HubSpot, Salesforce, Hunter.io oder ähnlichen Tools. NeXus ist ein eigenständiges Sales Operating System.
    - Erfinde keine "automatische Validierung" oder ähnliche Features. Halte dich exakt an die oben genannte Architektur.

    WICHTIGE ABGRENZUNG ZUM 'SALES COACH':
    Du bist NICHT der Sales Coach! Du erklärst das Werkzeug "NeXus". Für JEDE Frage, die in Richtung konkreter Vertriebsarbeit geht (Kontaktdaten recherchieren, E-Mail-Adressen finden, Pitches schreiben, Einwände behandeln), bist du NICHT zuständig!
    Versuche NIEMALS, vertriebliche Ratschläge für externe Tools (wie "nutze LinkedIn") zu geben oder selbst zu recherchieren.
    
    WENN DER NUTZER NACH KONKRETER VERTRIEBSARBEIT ODER KONTAKTEN FRAGT:
    Lehne freundlich ab und verweise auf den Coach. Beispiel für eine Kontaktsuche:
    "Das ist eine konkrete Vertriebsaufgabe. Um E-Mails oder Ansprechpartner zu recherchieren, ist der Sales Coach zuständig. [Öffne die Lead-Akte der Firma](/nexus/workspace) und starte dort den Coach – er verfügt über eine Live-Recherche-Funktion (Intelligence), um Entscheiderdaten zu finden."
    Nutze immer diesen Markdown-Link \\[Sales Workspace\\](/nexus/workspace), wenn du den Nutzer an den Coach verweist!
    
    Antworte in normalem, menschenlesbaren Markdown-Fließtext (KEIN JSON). Sei prägnant, kompetent und hilfreich.`
  } else if (mode === 'find_contact') {
      systemPrompt += ` Du bist ein Recherche-Agent. Deine EINZIGE Aufgabe ist es, aus dem dir übergebenen Such-Kontext (Tavily) den exakten Namen des gesuchten Ansprechpartners (z.B. Geschäftsführer, CEO, Marketingleiter) zu extrahieren.
      
      WICHTIGSTE REGEL: ERFINDE UNTER KEINEN UMSTÄNDEN NAMEN! 
      Wenn in den bereitgestellten Suchergebnissen kein eindeutiger, echter Name für die gesuchte Firma steht, MUSST du zwingend "unbekannt" als Name zurückgeben. Rate niemals.
      
      Gib ausschließlich ein JSON-Objekt zurück, ohne jeglichen Markdown-Text außen herum. 
      Format: { "name": "Gefundener Name oder 'unbekannt'", "role": "Gefundene Position oder 'unbekannt'", "phone": "Gefundene Telefonnummer oder 'unbekannt'" }`
    } else if (mode === 'trigger_hypotheses') {
    systemPrompt += ` Du bist ein brillanter B2B-Vertriebsstratege. Deine Aufgabe ist es, für ein gegebenes Produkt und eine Zielgruppe 3-5 hochspezifische, realistische Trigger-Events (Kaufsignale) abzuleiten. 
    
    WICHTIG: Vermeide generische Suchbegriffe (wie "Treppenbau"). Finde konkrete Ereignisse, die auf JETZIGEN Bedarf hindeuten (z.B. "Neubau einer Produktionsstätte").
    Bedenke die angegebene Region und deren Eigenheiten.
    
    Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
    {
      "hypotheses": [
        {
          "title": "Kurzer, knackiger Titel des Triggers (z.B. Neubau einer Produktionsstätte)",
          "reason": "Warum relevant: Erkläre in einem Satz, warum dieses Event einen hohen Bedarf am Produkt erzeugt.",
          "keywords": ["Suchbegriff 1", "Suchbegriff 2", "Suchbegriff 3"],
          "priority": 95
        }
      ]
    }`
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 Sekunden Timeout

  let res;
  try {
    res = await fetch('/.netlify/functions/nexus-llm', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        systemPrompt: systemPrompt,
        userMessage: message,
        context: context,
        temperature: temperature,
        lang: lang,
        targetLang: targetLang
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 429 || err.error?.includes('Rate limit')) {
        const errorObj = new Error("Rate limit exceeded");
        errorObj.name = 'RateLimitError';
        throw errorObj;
      }
      throw new Error(`NeXus AI Error: ${err.error || res.statusText}`)
    }

    const data = await res.json();

    // Im Chat-Modus wollen wir IMMER einen String. Wenn das Backend 
    // zufällig JSON geparst hat (weil die KI halluziniert hat), machen 
    // wir es wieder rückgängig, falls es kein bekanntes Format ist.
    if (mode === 'chat' && typeof data === 'object' && data !== null) {
      // Wenn die KI z.B. einen sales_pitch im Chat ausgibt
      if (data.response) return data.response;
      if (data.message) return data.message;
      if (data.content) return data.content;
      // Ansonsten (wie beim risiko_einschätzung-Fehler) machen wir einen String draus
      // Wir ignorieren die technischen "Keys" komplett und fügen nur die Text-Werte als Fließtext zusammen,
      // um den "Lochkarten/Software-Text" Look zu vermeiden!
      return Object.values(data)
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .join('\n\n');
    }

    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error("Zeitüberschreitung: Die KI hat zu lange gebraucht, um zu antworten (Timeout nach 60s).");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Analysiert ein Angebot und leitet das Vertriebsmodell ab
 */
export async function analysiereAngebot(angebotsbeschreibung) {
  return callNexusAI(
    'angebotsanalyse',
    `Analysiere folgendes Angebot und leite das vollständige Vertriebsmodell ab:\n\n${angebotsbeschreibung}`,
    null,
    0.3
  )
}

/**
 * Erkennt Trigger Events in einem Text
 */
export async function erkenneTrigger(text, quelle = 'unbekannt') {
  return callNexusAI(
    'trigger_detection',
    `Analysiere folgenden Text auf Trigger Events, die auf Kaufbereitschaft hinweisen:\n\nText:\n${text}\n\nQuelle: ${quelle}`,
    null,
    0.2
  )
}

/**
 * Analysiert einen Lead detailliert
 */
export async function analysiereLead(lead) {
  const leadInfo = [
    `Firmenname: ${lead.firmenname}`,
    lead.branche ? `Branche: ${lead.branche}` : '',
    lead.standort ? `Standort: ${lead.standort}` : '',
    lead.website ? `Website: ${lead.website}` : '',
    lead.trigger_event ? `Trigger Event: ${lead.trigger_event}` : '',
    lead.signifikanz ? `Signifikanz: ${lead.signifikanz}` : ''
  ].filter(Boolean).join('\n')

  return callNexusAI(
    'lead_intelligence',
    `Analysiere folgendes Unternehmen detailliert:\n\n${leadInfo}`,
    null,
    0.3
  )
}

/**
 * Generiert einen personalisierten Pitch
 */
export async function generierePitch(lead, intelligence) {
  const context = {
    firmenname: lead.firmenname,
    branche: lead.branche,
    trigger_event: lead.trigger_event,
    schmerzpunkte: intelligence?.schmerzpunkte || [],
    pitch: intelligence?.pitch || {}
  }

  return callNexusAI(
    'sales_pitch',
    `Erstelle einen personalisierten Pitch für ${lead.firmenname}.`,
    context,
    0.7
  )
}

/**
 * Schlägt eine Follow-up-Aktion vor
 */
export async function schlageFollowUp(lead, letzteAktion) {
  const context = {
    firmenname: lead.firmenname,
    status: lead.status,
    letzte_aktion: letzteAktion
  }

  return callNexusAI(
    'follow_up',
    `Schlage eine sinnvolle nächste Aktion für ${lead.firmenname} vor.`,
    context,
    0.4
  )
}

/**
 * NeXus Research Pipeline (Modularer Datenbeschaffungs- & Bewertungs-Prozess)
 * Langfristig können hier neben Tavily weitere Adapter (NewsAPI, LinkedIn etc.) integriert werden.
 */
export async function runResearchPipeline(searchQuery, branche = '', lang = 'de', offeringId = null) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  const res = await fetch("/.netlify/functions/nexus-research", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ searchQuery, branche, lang, offeringId })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429 || err.error?.includes('Rate limit')) {
      const errorObj = new Error("Rate limit exceeded");
      errorObj.name = 'RateLimitError';
      throw errorObj;
    }
    throw new Error(`NeXus Research Backend Error: ${err.error || res.statusText}`);
  }

  return await res.json();
}

/**
 * Behandelt einen Einwand
 */
export async function behandleEinwand(lead, einwand) {
  const context = {
    firmenname: lead.firmenname,
    branche: lead.branche
  }

  return callNexusAI(
    'einwandbehandlung',
    `Kunde (${lead.firmenname}) sagt: "${einwand}"\n\nWie sollte der Vertriebsmitarbeiter reagieren?`,
    context,
    0.5
  )
}

/**
 * Generiert eine Forum-Antwort
 */
export async function generiereForumAntwortbeitrag(post, quelle) {
  return callNexusAI(
    'forum_response',
    `Verfasse eine hilfreiche Antwort auf folgenden Forum-Beitrag:\n\n${post}\n\nQuelle: ${quelle}`,
    null,
    0.6
  )
}

export async function runDeepResearch(opportunityContext) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-research', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ opportunityContext })
  });

  if (!res.ok) throw new Error('Deep Research API failed');
  return res.json();
}

/**
 * Ruft die Contact Intelligence Pipeline auf
 * Findet automatisch den passenden Ansprechpartner für eine Opportunity.
 */
export async function callContactIntelligence({ companyId, opportunityId, offering, company, trigger, research }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-contact-intelligence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ companyId, opportunityId, offering, company, trigger, research })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Contact Intelligence Error: ${err.error || res.statusText}`);
  }

  return res.json();
}

/**
 * Ruft die Message Generation Pipeline auf
 * Erzeugt eine individuelle Erstansprache basierend auf Contact Intelligence + Context.
 */
export async function callMessageGeneration({ contact, offering, company, trigger, research }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-message-generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ contact, offering, company, trigger, research })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Message Generation Error: ${err.error || res.statusText}`);
  }

  return res.json();
}

/**
 * Ruft die Email Verify Function auf (SMTP-Check)
 */
export async function callEmailVerify({ contactId, email, domain }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-email-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ contactId, email, domain })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Email Verify Error: ${err.error || res.statusText}`);
  }

  return res.json();
}

