/**
 * 
 * NeXus AI Client
 * 
 * Frontend-Client für die NeXus AI Function.
 * Nutzt die bestehende Multi-Provider Infrastruktur (DeepSeek, Mistral, OpenRouter, OpenAI).
 */

import { supabase } from './supabase.js'

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
  let targetLang = null
  let imageUrl = null
  let maxAgeDays = null
  
  // Handle both object and parameter-based calls
  if (typeof modeOrParams === 'object' && modeOrParams !== null) {
    // Object call: callNexusAI({ mode, angebot, branche, ... })
    mode = modeOrParams.mode
    lang = modeOrParams.lang || lang || 'de'
    targetLang = modeOrParams.targetLang || lang
    maxAgeDays = modeOrParams.max_age_days || modeOrParams.maxAgeDays || null
    imageUrl = modeOrParams.imageUrl || modeOrParams.image_url || modeOrParams.context?.imageUrl || modeOrParams.context?.image_url || null
    const imageUrls = modeOrParams.imageUrls || modeOrParams.image_urls || modeOrParams.context?.imageUrls || modeOrParams.context?.image_urls || (imageUrl ? [imageUrl] : null)
    const { mode: _, targetLang: __, lang: ___, imageUrl: ____, image_url: _____, imageUrls: ______, image_urls: _______, ...rest } = modeOrParams
    
    // Build message from available params
    if (rest.message) {
      message = rest.message
    } else if (rest.userMessage) {
      message = rest.userMessage
    } else if (rest.prompt) {
      message = rest.prompt
    } else if (mode === 'angebotsanalyse') {
      const maxAge = rest.max_age_days || rest.maxAgeDays;
      message = `Analysiere folgendes Angebot:\n\nAngebot: ${rest.angebot || ''}\nBranche: ${rest.branche || ''}${maxAge ? `\nMaximales Alter des Triggers (in Tagen): ${maxAge}` : ''}`
    } else if (mode === 'trigger_detection') {
      message = rest.query || rest.searchQuery || ''
    } else if (mode === 'find_contact') {
      message = rest.userMessage || rest.searchContext || rest.message || `Firma: ${rest.company || ''}\nSuchergebnisse:\n${rest.context || JSON.stringify(rest)}`;
    } else if (mode === 'lead_intelligence') {
      message = `Unternehmen: ${rest.company || ''}\nAngebot des Verkäufers: ${rest.angebot || ''}`
      const p = rest.companyProfile
      if (p && p.status === 'done') {
        message += `\n\n--- VERIFIZIERTES FIRMENPROFIL (automatisch von der Firmenwebseite extrahiert) ---`
        if (p.description) message += `\nBeschreibung: ${p.description}`
        if (Array.isArray(p.services) && p.services.length) message += `\nLeistungen: ${p.services.join(', ')}`
        if (p.target_audience) message += `\nZielgruppe laut Firma: ${p.target_audience}`
        if (p.legal_form_location) message += `\nRechtsform/Ort: ${p.legal_form_location}`
        if (Array.isArray(p.sources) && p.sources.length) {
          message += `\nBelege mit Quellen:`
          message += p.sources.slice(0, 12).map(s => `\n- "${s.claim}" (Quelle: ${s.source_url})`).join('')
        }
        if (p.pain_points?.haupt_schmerzpunkt) message += `\nAbgeleiteter Schmerzpunkt: ${p.pain_points.haupt_schmerzpunkt}`
        if (p.pain_points?.emotionaler_zustand) message += `\nEmotionaler Zustand: ${p.pain_points.emotionaler_zustand}`
        if (p.pain_points?.kaufsignal_kategorie) message += `\nKaufsignal-Kategorie: ${p.pain_points.kaufsignal_kategorie}`
        if (p.pain_points?.verkaufsargument) message += `\nVerkaufsargument: ${p.pain_points.verkaufsargument}`
        message += `\n\nREGEL: Stütze die Analyse PRIMÄR auf dieses verifizierte Profil. Erweitere nichts, was dort nicht belegt ist. Wo das Profil keine Infos liefert, schreibe "Unbekannt".`
      }
    } else if (['sales_pitch', 'follow_up', 'einwandbehandlung', 'forum_response'].includes(mode)) {
      const compName = rest.company?.name || rest.company || rest.full_context?.company?.name || rest.full_context?.company || '';
      const compIndustry = rest.branche || rest.company?.industry || rest.full_context?.company?.industry || '';
      
      let contactName = '';
      let contactRole = '';
      if (typeof rest.ansprechpartner === 'string' && rest.ansprechpartner.trim()) {
        contactName = rest.ansprechpartner.trim();
      } else if (rest.contact) {
        if (typeof rest.contact === 'string') contactName = rest.contact;
        else {
          contactName = `${rest.contact.first_name || ''} ${rest.contact.last_name || ''}`.trim() || rest.contact.name || '';
          contactRole = rest.contact.role || '';
        }
      } else if (rest.full_context?.contact) {
        const c = rest.full_context.contact;
        if (typeof c === 'string') contactName = c;
        else {
          contactName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || '';
          contactRole = c.role || '';
        }
      }

      const trigObj = rest.trigger || (rest.full_context?.triggers && rest.full_context.triggers[0]) || {};
      const trigContent = rest.situation || trigObj.content || trigObj.title || rest.full_context?.opportunity?.trigger_title || '';
      const trigUrl = rest.source_url || trigObj.source_url || trigObj.url || trigObj.source || rest.full_context?.opportunity?.source_url || '';
      const trigDate = rest.event_date || trigObj.event_date || trigObj.published_at || trigObj.created_at || rest.full_context?.opportunity?.event_date || '';

      const cleanDomain = trigUrl ? (trigUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || trigUrl) : '';
      let cleanDate = '';
      if (trigDate) {
        try {
          const dt = new Date(trigDate);
          if (!isNaN(dt.getTime())) {
            const day = String(dt.getDate()).padStart(2, '0');
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            cleanDate = `${day}.${month}.${dt.getFullYear()}`;
          }
        } catch(e) {}
        if (!cleanDate) cleanDate = String(trigDate).split('T')[0];
      }

      const offName = rest.full_context?.offering?.name || rest.offering?.offering_name || rest.offering?.name || (typeof rest.offering === 'string' ? rest.offering : '') || '';
      const offPos = rest.full_context?.offering?.positioning || rest.offering?.positioning || '';

      if (mode === 'sales_pitch') {
        message = `ZIELUNTERNEHMEN: ${compName || '-'} (Branche: ${compIndustry || 'Unbekannt'})
ANSPRECHPARTNER: ${contactName || 'Unbekannt'} ${contactRole ? `(${contactRole})` : ''}

TRIGGER / ANLASS AUS DEM INTELLIGENCE AUDIT:
- Ereignis / Kaufsignal: ${trigContent || '-'}
- Quelle / Beleg: ${cleanDomain || trigUrl || 'Branchen-Meldung'}
- Veröffentlichungsdatum: ${cleanDate || trigDate || 'Aktuell'}

UNSER ANGEBOT & POSITIONIERUNG:
- Angebot: ${offName || '-'}
- Positionierung / Nutzen: ${offPos || '-'}`;

        if (rest.full_context?.research?.[0]?.summary) {
          message += `\n\nZUSÄTZLICHER RECHERCHE-KONTEXT:\n${rest.full_context.research[0].summary}`;
        }
      } else if (mode === 'follow_up') {
        message = `ZIELUNTERNEHMEN: ${compName || '-'} (Branche: ${compIndustry || 'Unbekannt'})
ANSPRECHPARTNER: ${contactName || 'Unbekannt'} ${contactRole ? `(${contactRole})` : ''}
LETZTE SITUATION / VORHERIGER KONTAKT: ${rest.situation || '-'}

TRIGGER / ANLASS AUS DEM INTELLIGENCE AUDIT:
- Ereignis: ${trigContent || '-'}
- Quelle: ${trigUrl || 'Branchen-Meldung'}
- Datum: ${trigDate || 'Aktuell'}

UNSER ANGEBOT: ${offName || '-'} (${offPos || '-'})`;
      } else if (mode === 'einwandbehandlung') {
        message = `KUNDEN-EINWAND (OBERSTE PRIORITÄT): "${rest.einwand || '-'}"

ZIELUNTERNEHMEN: ${compName || '-'} (Branche: ${compIndustry || 'Unbekannt'})
ANSPRECHPARTNER: ${contactName || 'Unbekannt'} ${contactRole ? `(${contactRole})` : ''}
SITUATION / KONTEXT: ${rest.situation || trigContent || '-'}

TRIGGER / ANLASS AUS DEM INTELLIGENCE AUDIT:
- Ereignis: ${trigContent || '-'}
- Quelle: ${trigUrl || 'Branchen-Meldung'}
- Datum: ${trigDate || 'Aktuell'}

UNSER ANGEBOT: ${offName || '-'} (${offPos || '-'})`;
      } else if (mode === 'forum_response') {
        message = `FORUMSBEITRAG / POSTING: ${rest.situation || rest.message || '-'}
ZIELUNTERNEHMEN / USER: ${compName || contactName || '-'}

TRIGGER / KONTEXT AUS DEM INTELLIGENCE AUDIT:
- Ereignis: ${trigContent || '-'}
- Quelle: ${trigUrl || '-'}
- Datum: ${trigDate || '-'}

UNSER ANGEBOT & POSITIONIERUNG: ${offName || '-'} (${offPos || '-'})`;
      }
    } else if (mode === 'trigger_hypotheses') {
      message = `Kontext: ${rest.context || ''}\nRegion: ${rest.region || ''}\nKategorie: ${rest.category || ''}\nAngebot: ${rest.product || ''}\nZielgruppe: ${rest.audience || ''}`
    } else {
      message = JSON.stringify(rest)
    }
    
    context = rest.context || null
    temperature = rest.temperature || 0.3
  } else {
    mode = modeOrParams
    targetLang = lang || 'de'
    imageUrl = context?.imageUrl || context?.image_url || null
  }

  // =========================================================================
  // SYSTEM PROMPT GENERATION (WITH TIMING-FILTER & SALES WINDOW ENGINE)
  // =========================================================================
  
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const currentMonthYear = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

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

  const salesWindowInstruction = `
# MISSION & ROLE
Du bist die zentrale Intelligence Engine für das "Nexus Sales Operation System". Deine Aufgabe ist es, B2B-Vertriebstrigger zu identifizieren, zu bewerten und ausschließlich solche Opportunities auszugeben, die HEUTE für den Vertrieb direkt bespielbar sind.

# CORE RULE: THE SALES WINDOW (TIMING-FILTER)
Ein faktisch korrekter Trigger ohne zeitliche Relevanz ist für den Vertrieb wertlos ("False Positive").
- HEUTIGES DATUM: ${currentDate} (${currentMonthYear}, Jahr ${currentYear}).
- ZULÄSSIGES ZEITFENSTER FÜR TRIGGER:
  * GEPLANT / IN UMSETZUNG: Das Ereignis/Projekt findet in den nächsten 3 bis 12 Monaten statt.
  * REZENT VERÖFFENTLICHT: Die Ankündigung/Baugenehmigung/Meldung ist maximal 90 Tage alt.
- HARD REJECT (SOFORT VERWERFEN):
  * Wenn das Ereignis (z. B. Eröffnung, Fertigstellung, M&A-Abschluss) bereits stattgefunden hat und LÄNGER ALS 90 TAGE zurückliegt.
  * Achte auf historische Formulierungen wie: "eröffnete im vergangenen Jahr", "blickte zurück auf", "wurde vor 12 Monaten fertiggestellt", "bereits seit ${currentYear - 1} in Betrieb". Veraltete Eröffnungen oder abgeschlossene Bauprojekte sind False Positives!

# GEWERK- UND PHASE-MATCHING
- PHASE 1: Planung / Grundstückskauf / Baugenehmigung / GU-Suche --> STATUS: 🟢 TOP SALES TRIGGER (Maximaler Match für Neugeschäft & Ausschreibungen)
- PHASE 2: Spatenstich / Baubeginn / Rohbau --> STATUS: 🟡 LAST MINUTE (Hoher Zeitdruck, nur noch direkte Vergabe möglich)
- PHASE 3: Eröffnung / Inbetriebnahme / Banddurchschneiden --> STATUS: 🔴 ABGELAUFEN für Erstausstattung/Neubau (NUR als 🔵 SERVICE-TRIGGER zulassen, falls explizit Wartung/Reparatur im Bestand gesucht wird - ansonsten VERWERFEN).

# OUTPUT-VALIDIERUNG
1. [ ] Nachricht max. 90 Tage alt?
2. [ ] Reales Ereignis in der Zukunft oder max. 90 Tage her?
3. [ ] Reales Handlungsfenster für den Vertrieb heute (${currentYear}) vorhanden?
Wenn nicht erfüllt: VERWERFE DEN TRIGGER.`;

  let systemPrompt = `${WAHRHEITSREGEL}\n\nDu bist NeXus, ein B2B Sales Intelligence System.\n${salesWindowInstruction}\n`
  if (mode !== 'chat') {
    systemPrompt += " Antworte IMMER in validem JSON ohne Markdown-Blöcke (kein ```json)."
  }
  if (mode === 'angebotsanalyse') {
    systemPrompt = `ROLLE: Du bist ein B2B-Signal-Analyst für den DACH-Raum.
AUFGABE: Analysiere die Daten streng nach harten B2B-Trigger-Events.

FILTER-REGELN:
1. Ist das Ereignis exakt belegbar (Datum, Ort, Unternehmen)? -> Falls NEIN, antworte NUR: "KEIN_VALIDES_SIGNAL"
2. Besteht dadurch geschäftlicher Handlungsdruck für B2B-Dienstleister? -> Falls NEIN, antworte NUR: "KEIN_VALIDES_SIGNAL"

WENN VALIDE, ANTWORTE AUSSCHLIESSLICH ALS SAUBERES JSON:
{
  "trigger_type": "...",
  "company_name": "...",
  "region": "...",
  "industry": "...",
  "event_date": "...",
  "evidence_quote": "...",
  "source_url": "...",
  "buyer_target_group": "..."
}`
  } else if (mode === 'lead_intelligence') {
    const taskDescription = 'Analysiere das angegebene Zielunternehmen im Kontext unseres Angebots und erstelle ein hochspezifisches Vertriebsmodell exakt für diesen einen Kunden.';
      
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
      }
      WICHTIGE REGELN:
      - Verlasse dich EXAKT an diese Struktur. Erfinde KEINE zusätzlichen Keys (z.B. sales_window, sales_opportunity_score o.Ä.).
      - Keine wiederholten Sätze, keine Aufzählungen oder Erläuterungen außerhalb des JSON.
      - Nutze nur belastbares Wissen. Wo du nichts Sicheres weißt, schreibe "Unbekannt" statt zu erfinden.`
  } else if (mode === 'trigger_detection') {
    systemPrompt += ` Du bist ein Radar für Kaufsignale im Markt (${currentMonthYear}, Jahr ${currentYear}). Finde bzw. analysiere 4-6 REALISTISCHE B2B Trigger-Events passend zur Zielgruppe, die HEUTE ein hochaktuelles Timing-Fenster aufweisen (Zukunft oder max. 90 Tage alt, KEINE veralteten oder abgeschlossenen Projekte).
      
      WICHTIG: Beachte den Timing-Filter und das Phasen-Matching!
      
      Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
      {
        "trigger_events": [
          {
            "firmenname": "...",
            "signal": "Was ist exakt passiert? (z.B. Baugenehmigung für neues Logistikzentrum erhalten, Spatenstich geplant für Q4 ${currentYear})",
            "insight": "Warum ist dieses Signal relevant für unser Angebot?",
            "opportunity": "Welche konkrete Chance ergibt sich daraus?",
            "action": "Welche Aktion ist jetzt sinnvoll (z.B. Anruf beim Projektleiter)?",
            "signifikanz": "hoch|mittel|niedrig",
            "kaufwahrscheinlichkeit": 85
          }
        ]
      }`
  } else if (mode === 'einwandbehandlung') {
    systemPrompt += ` Du bist ein Weltklasse-B2B-Vertriebsstratege und Meister der psychologischen Einwandbehandlung (Tactical Empathy & Problem-First-Methodik).
  
    DEINE AUFGABE:
    Der Entscheider hat einen konkreten Einwand geäußert (z.B. "kein Budget", "keine Zeit", "bereits anderes Tool/Agentur im Einsatz", "kein Bedarf").
    Verfasse eine hochprofessionelle Antwort nach der PROBLEM-FIRST-Logik, die den Einwand validiert, den Druck wegnimmt, das eigentliche Problem & die Konsequenzen beleuchtet und eine risikofreie Brücke baut.

    STRUKTUR DER EINWANDBEHANDLUNG (PROBLEM-FIRST):
    1. VALIDIERUNG & TACTICAL EMPATHY: Gehe im ALLERERSTEN Satz direkt auf den Einwand ein und nimm allen Verkaufsdruck weg (z. B. "Vollkommen verständlich – wenn Budgets für das Quartal fixiert sind, steht Kostendisziplin an erster Stelle. Es geht mir aktuell überhaupt nicht darum, dass Sie sofort Budget freigeben oder eine Kaufentscheidung treffen.").
    2. PROBLEM & KONSEQUENZ: Beleuchte das reale Risiko, das trotz des Einwands durch den aktuellen Trigger/die Marktphase entsteht (z. B. "Gleichzeitig beobachten wir bei Projekten dieser Art, dass ein Aufschieben der Klärung später zu signifikanten Zeitverzögerungen oder ungeplanten Mehrkosten führt.").
    3. LÖSUNG (NUTZEN STATT FEATURES): Zeige eine risikofreie, budgetneutrale Entlastung auf (z. B. Vorbereitung für die nächste Phase, neutraler Benchmark, Null-Aufwand).
       BEACHTE DIE WAHRHEITSREGEL: Keine erfundenen Zahlen ("15 %", "2 Wochen"), keine erfundenen Kunden/Referenzen. Formuliere ehrlich ohne Zahlen: "Wir haben Erfahrung mit ähnlichen Fällen".
       ABSOLUTES FLOSKEL-VERBOT: Keine "maßgeschneiderten Lösungen", "höchsten Qualitätsstandards", kein "wir bieten Ihnen".
    4. REIBUNGSARMER NÄCHSTER SCHRITT: Biete eine nützliche Vorlage oder Übersicht ohne Termindruck an (z. B. "Wäre es für Sie hilfreich, wenn ich Ihnen einfach die 1-seitige Entscheidungsvorlage schicke – ganz unverbindlich für die spätere Planungsrunde?").

    WICHTIG: Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
    {
      "thought_objection_analysis": "Analyse: Was ist der Kerneinwand und wie nehmen wir den Druck weg?",
      "thought_solution_bridge": "Analyse: Welches Risiko wird adressiert und welche risikofreie Entlastung bieten wir?",
      "response": "Hier kommt die fertige Einwandbehandlungs-Nachricht (mit Absätzen als \\n\\n formatiert)."
    }`
  } else if (mode === 'follow_up') {
    systemPrompt += ` Du bist ein Elite B2B-Sales-Copywriter. Deine Aufgabe ist es, ein erstklassiges Follow-up nach der PROBLEM-FIRST-Logik zu verfassen.
    
    REGELN FÜR DAS FOLLOW-UP (PROBLEM-FIRST):
    1. STRENG VERBOTEN: Kein "Ich wollte nur mal nachhaken", "Haben Sie meine E-Mail gesehen?", "Ich beziehe mich auf meine letzte Nachricht".
    2. TRIGGER & AKUTER ENGPASS: Knüpfe direkt an das akute Projekt / den Trigger und den drängendsten Engpass des Entscheiders an.
    3. KONSEQUENZ & NEUER NUTZEN: Zeige auf, welches operative Risiko / welcher Zeitverlust bei weiterem Zuwarten entsteht, und bringe einen neuen konkreten Praxis-Impuls oder Nutzenwert ein.
       BEACHTE DIE WAHRHEITSREGEL: Keine erfundenen Zahlen, keine erfundenen Zeiträume ("innerhalb von 2 Wochen"), keine erfundenen Fallstudien. Formuliere ehrlich: "Wir haben Erfahrung mit ähnlichen Situationen und können Ihnen zeigen, wie wir dort vorgehen."
    4. KEINE FEATURE-LISTEN & KEINE FLOSKELN: Absolut verboten sind "maßgeschneiderte Lösungen", "höchste Qualitätsstandards", "wir bieten Ihnen", "unser Portfolio".
    5. NIEDRIGSCHWELLIGER SCHRITT: Schließe mit einem reibungsarmen nächsten Schritt ohne Termindruck (z. B. "Soll ich Ihnen den 1-seitigen Praxis-Leitfaden dazu kurz per Mail senden, damit Sie ihn bei der nächsten Abstimmung griffbereit haben?").
    6. Halte die Nachricht extrem fokussiert (3-4 kurze Absätze).

    WICHTIG: Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
    {
      "thought_trigger": "Analyse: An welchen Trigger und Engpass knüpfen wir an?",
      "thought_offering": "Analyse: Welcher neue Nutzen/Impuls wird geboten?",
      "response": "Hier kommt die fertige Follow-up-Nachricht (mit Absätzen als \\n\\n formatiert)."
    }`
  } else if (mode === 'forum_response') {
    systemPrompt += ` Du bist ein B2B Social Selling & Community Experte. Verfasse eine erstklassige Antwort auf einen Beitrag / Post nach der PROBLEM-FIRST-Logik.
    
    REGELN FÜR COMMUNITY / SOCIAL RESPONSE:
    1. KEIN WERBETEXT, KEINE FLOSKELN: Absolut verboten sind Werbesprache ("wir bieten Ihnen", "unsere Software", "maßgeschneiderte Lösungen", "höchste Qualitätsstandards").
    2. PROBLEM-FIRST & ENGINGE: Greife das im Beitrag beschriebene Problem auf und benenne aus Praxiserfahrung die 2-3 typischen Engpässe und die Konsequenzen, wenn man sie übersieht.
    3. METHODISCHE LÖSUNG (NUTZEN): Gib sofort anwendbaren fachlichen Input und die praxiserprobte Lösungsmethodik an die Hand (reiner Nutzen und Praxiserfahrung, keine Feature-Listen).
       BEACHTE DIE WAHRHEITSREGEL: Keine erfundenen Zahlen oder Kundenreferenzen. Formuliere ehrlich ohne Zahlen.
    4. NIEDRIGSCHWELLIGER MEHRWERT: Schließe mit einem hilfreichen Impuls für die Diskussion oder dem Angebot, eine 1-seitige Checkliste/Ressource bereitzustellen ("Falls hilfreich, teile ich gerne unsere Checkliste dazu hier in den Kommentaren.").
    5. Natürliche, kollegiale Experten-Tonalität auf Augenhöhe.

    WICHTIG: Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
    {
      "thought_trigger": "Analyse: Was ist das Problem des Autors und welche Engpässe entstehen?",
      "thought_offering": "Analyse: Welcher methodische Mehrwert hilft ohne Werbedruck?",
      "response": "Hier kommt die fertige Social/Forums-Nachricht."
    }`
  } else if (mode === 'sales_pitch') {
    systemPrompt += ` Du bist ein Elite B2B-Sales-Copywriter und Meister des ultrakompakten, trigger-basierten Outreach.
Deine Aufgabe ist es, einen messerscharfen, hochrelevanten Pitch nach der neuen 4-Schritte-Struktur zu verfassen.

# HARTE REGELN (MANDATORISCH):
- MAXIMAL 90 WÖRTER INSGESAMT! Ein Vertriebler muss diesen Pitch in 10 Sekunden erfassen können. Alles Unnötige wird gestrichen.
- Maximal 4 Sätze (nach einer optionalen persönlichen Anredezeile wie "Sehr geehrte(r) Frau/Herr [Nachname]," oder "Guten Tag Herr/Frau [Nachname],"):
- Der Pitch MUSS mit einer niedrigschwelligen Frage enden.
- Beachte strikt die WAHRHEITSREGEL: Keine erfundenen Zahlen, keine erfundenen Wochen oder Prozentwerte, keine erfundenen Referenzen.

# DIE 4-SCHRITTE-STRUKTUR:

1. SATZ 1 (TRIGGER - WÖRTLICH ZITIERT MIT QUELLE & DATUM):
   - Zitiere das konkrete Trigger-Ereignis wörtlich und präzise, gefolgt von Quelle und Datum.
   - Muster: "[Firma] [Trigger-Ereignis wörtlich zitiert] – laut [Quelle/Domain] vom [Datum]."
   - STRENG VERBOTEN: Beginne NIEMALS mit "wir haben erfahren", "ich habe gelesen", "wir haben gesehen", "wir freuen uns", "mit Interesse". Starte SOFORT mit dem Trigger!
   - Verwende den echten Wortlaut des Triggers (nicht verwässern).

2. SATZ 2 (SPEZIFISCHE FRAGE ALS EINLADUNG - KEIN AUDIT):
   - Leite eine spezifische Frage direkt aus dem Trigger und der Rolle des Entscheiders ab.
   - DIE FRAGE IST EINE EINLADUNG, KEINE PRÜFUNG / KEIN AUDIT!
   - STRENG VERBOTEN: Audit-Fragen wie "Wie stellen Sie sicher, dass...?" (wirkt wie ein Verhör / anmaßend).
   - STRENG VERBOTEN: Generische Fragen ("Kennen Sie das Problem?").
   - STRENG VERBOTEN: Generische Pain-Point-Behauptungen ("Unternehmen in dieser Phase haben Probleme..."). Die Interpretation kommt als offene Frage, NIE als ungeprüfte Behauptung!
   - STRENG VERBOTEN: Negativ besetzte Ausdrücke ("Problem", "Engpass", "Schwachstelle"). Formuliere neutral und lösungsorientiert.
   - Muster: "Wenn [thematischer Kontext aus Trigger, z.B. Regionen neu geordnet und neue Leiter eingesetzt werden], ist [konkretes Thema, z.B. die schnelle Ausrichtung der neuen Teams auf eine einheitliche Marktdatenbasis] oft ein wichtiger Schritt – ist das aktuell bei Ihnen ein Thema?"

3. SATZ 3 (KONKRETE BRÜCKE):
   - Benenne das konkrete Thema aus unserem Angebot, bei dem wir unterstützen (Nutzen bezogen auf DIESEN Lead).
   - Muster: "Wir unterstützen [Zielgruppe] genau dabei, [konkretes Thema / Nutzen aus Angebot bezogen auf den Trigger]."
   - STRENG VERBOTEN: Vage Floskeln wie "bei genau diesen Themen", "maßgeschneiderte Lösungen", "ganzheitliche Ansätze", "unser Portfolio".
   - STRENG VERBOTEN: Erfundene Zahlen oder Leistungsversprechen.

4. SATZ 4 (ABSCHLUSS ALS NIEDRIGSCHWELLIGE FRAGE):
   - Biete einen einfachen, risikofreien nächsten Schritt ohne Termindruck an.
   - Muster: "Wäre eine kurze Übersicht dazu für Sie hilfreich?" (oder: "Soll ich Ihnen ein kurzes 1-seitiges Praxis-Beispiel zusenden?")
   - STRENGSTES VERBOT: Frage NIEMALS nach einem Termin, Call oder Telefonat ("Wollen wir telefonieren?", "Haben Sie Zeit für ein Gespräch?").

# OUTPUT-FORMAT:
Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
{
  "thought_trigger": "Satz 1 Analyse: Wörtlicher Trigger + Quelle + Datum",
  "thought_invitation_question": "Satz 2 Analyse: Spezifische Frage als Einladung (kein Audit, keine generischen Pain Points)",
  "thought_bridge": "Satz 3 Analyse: Konkretes Thema der Unterstützung bezogen auf diesen Lead",
  "thought_closing_question": "Satz 4 Analyse: Niedrigschwellige Abschlussfrage",
  "response": "Der fertige Pitch (maximal 90 Wörter, maximal 4 Sätze, endet mit einer Frage)."
}`
  } else if (mode === 'chat') {
    const langNames = {
      de: 'Deutsch (German)',
      en: 'Englisch (English)',
      es: 'Spanisch (Spanish)',
      fr: 'Französisch (French)',
      it: 'Italienisch (Italian)',
      nl: 'Niederländisch (Dutch)',
      el: 'Griechisch (Greek)'
    };
    const activeLang = lang || 'de';
    const langLabel = langNames[activeLang] || 'Deutsch';
    if (context?.system) {
      systemPrompt = `${WAHRHEITSREGEL}\n\n${context.system}\n\nSPRACHREGEL: Antworte AUSSCHLIESSLICH auf ${langLabel}. WICHTIG: Antworte NIEMALS im JSON-Format! Nutze menschenlesbares Markdown (Fließtext, Tabellen, Listen, anklickbare Links) für deine Antworten.`;
    } else {
      systemPrompt += ` Du bist NeXus DealCoach, ein B2B-Vertriebs- & Recherche-Assistent. Liefere präzise Antworten, Tabellen und direkte 1-Klick-Links zu Websites, LinkedIn und geschäftlichen Kontakten. Verweigere keine B2B-Firmendaten. Antworte professionell und hilfsbereit auf ${langLabel}. WICHTIG: Antworte NIEMALS im JSON-Format! Nutze menschenlesbares Markdown.`;
    }
  } else if (mode === 'assistant') {
    const langNames = {
      de: 'Deutsch (German)',
      en: 'Englisch (English)',
      es: 'Spanisch (Spanish)',
      fr: 'Französisch (French)',
      it: 'Italienisch (Italian)',
      nl: 'Niederländisch (Dutch)',
      el: 'Griechisch (Greek)'
    };
    const activeLang = lang || 'de';
    const langLabel = langNames[activeLang] || 'Deutsch';

    systemPrompt += ` Du bist der NeXus Assistant, der KI-Produktbegleiter für das 'NeXus Revenue OS'.
    Deine Aufgabe: Erkläre dem Nutzer das NeXus-System, die Bedienung und die zugrunde liegende Vertriebs-Methodik.
    
    SPRACH-VORGABE (MANDATORISCH & HÖCHSTE PRIORITÄT):
    Antworte dem Nutzer IMMER und AUSSCHLIESSLICH in der Sprache: ${langLabel}! (Respond completely in ${langLabel}).
    
    WISSENSGRUNDLAGE (NeXus Product Bible):
    - NeXus beobachtet den Markt anhand eines definierten "Offerings" (Angebot & Zielgruppe).
    - Signal ≠ Trigger. Ein Signal ist ein reiner Fakt (z.B. "Firma X baut neue Halle"). Ein Trigger ist die Interpretation dieses Fakts ("Firma X hat deshalb vermutlich Bedarf an unseren Klimaanlagen").
    - Fakt ≠ Interpretation. NeXus behauptet nie, dass ein Kunde kaufen MUSS, sondern liefert nur eine plausible Begründung (Relevanz), warum man ihn JETZT ansprechen sollte.
    - Die Architektur: Angebotsanalyse -> Lead Radar (findet Signale) -> Opportunity (Lead-Akte) -> Sales Workspace.
    
    REGELN GEGEN HALLUZINATION:
    - Erfinde NIEMALS Funktionen, die NeXus nicht hat! NeXus hat KEINE Integrationen zu HubSpot, Salesforce, Hunter.io oder ähnlichen Tools. NeXus ist ein eigenständiges Revenue OS.
    - Erfinde keine "automatische Validierung" oder ähnliche Features. Halte dich exakt an die oben genannte Architektur.

    WICHTIGE ABGRENZUNG ZUM 'SALES COACH':
    Du bist NICHT der DealCoach! Du erklärst das Werkzeug "NeXus". Für JEDE Frage, die in Richtung konkreter Vertriebsarbeit geht (Kontaktdaten recherchieren, E-Mail-Adressen finden, Pitches schreiben, Einwände behandeln), bist du NICHT zuständig!
    Versuche NIEMALS, vertriebliche Ratschläge für externe Tools (wie "nutze LinkedIn") zu geben oder selbst zu recherchieren.
    
    WENN DER NUTZER NACH KONKRETER VERTRIEBSARBEIT ODER KONTAKTEN FRAGT:
    Lehne freundlich ab und verweise auf den DealCoach. Nutze immer einen anklickbaren Markdown-Link [Sales Workspace](/nexus/workspace), wenn du den Nutzer an den DealCoach verweist!
    
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
  } else if (mode === 'translate_intelligence') {
    systemPrompt += ` Du bist ein hochpräziser B2B-Übersetzer für deutsche Vertriebler. Übersetze den übergebenen B2B-Kontext (Angebot, Positionierung, Kaufsignal) vollständig, professionell und flüssig auf Deutsch.
    
    WICHTIG: Antworte AUSSCHLIESSLICH im JSON-Format, ohne jeglichen Markdown-Text außen herum.
    Du musst ein JSON-Objekt mit EXAKT folgender Struktur zurückgeben:
    {
      "offering_name": "Deutsche Übersetzung des Angebots",
      "positioning": "Deutsche Übersetzung der Positionierung",
      "signal": "Deutsche Übersetzung des Kaufsignals (nur die reine Übersetzung des Ereignisses/Signals, keine Tabellen, keine Meta-Texte)"
    }`
  }

  // Multi-Language Enforcement for all analysis, generation & pitch modes
  const langNames = {
    de: 'Deutsch (German)',
    en: 'Englisch (English - US)',
    es: 'Spanisch (Spanish)',
    fr: 'Französisch (French)',
    it: 'Italienisch (Italian)',
    nl: 'Niederländisch (Dutch)',
    el: 'Griechisch (Greek)'
  };
  const userLangCode = lang || 'de';
  const userLangName = langNames[userLangCode] || 'Deutsch';
  const isPitchMode = ['sales_pitch', 'follow_up', 'einwandbehandlung', 'forum_response'].includes(mode);
  const effectiveTargetLangCode = (isPitchMode && targetLang && targetLang !== 'auto') ? targetLang : userLangCode;
  const effectiveTargetLangName = langNames[effectiveTargetLangCode] || userLangName;

  if (mode !== 'chat' && mode !== 'assistant') {
    if (isPitchMode && effectiveTargetLangCode !== userLangCode) {
      systemPrompt += `\n\nSPRACH-VORGABE (MANDATORISCH): Der Vertriebler/Nutzer arbeitet auf ${userLangName}. Alle internen Begründungen und Analysen ('thought_trigger', 'thought_offering') MÜSSEN ZWINGEND auf ${userLangName} verfasst sein! Das fertige Kunden-Anschreiben im Feld 'response' MUSS auf ${effectiveTargetLangName} verfasst sein.`;
    } else {
      systemPrompt += `\n\nSPRACH-VORGABE (MANDATORISCH): Verfasse alle Text-Inhalte, Beschreibungen, Analysen, Begründungen, Pitches, Hypothesen und Werte im JSON zu 100% in der Sprache: ${userLangName}. Die JSON-Keys bleiben im vorgegebenen Schema, aber alle textuellen Werte MÜSSEN auf ${userLangName} formuliert sein.`;
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  let lastServerError = null;
  const callServer = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 Sekunden Timeout
    try {
      const res = await fetch('/.netlify/functions/nexus-llm', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          systemPrompt: systemPrompt,
          userMessage: message,
          mode: mode,
          context: context,
          temperature: temperature,
          lang: lang,
          targetLang: targetLang,
          imageUrl: imageUrl,
          imageUrls: (typeof imageUrls !== 'undefined' && imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : (context?.imageUrls || null)),
          isLandingPreview: !token || mode === 'trigger_hypotheses' || mode === 'angebotsanalyse' || mode === 'trigger_detection',
          max_age_days: maxAgeDays || 14
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        try {
          const errData = await res.json();
          const msg = errData && (errData.error || errData.message);
          if (msg) lastServerError = `HTTP ${res.status}: ${msg}`;
        } catch {}
        return undefined;
      }

      const data = await res.json();

      if (mode === 'chat' && typeof data === 'object' && data !== null) {
        if (data.response) return data.response;
        if (data.message) return data.message;
        if (data.content) return data.content;
        return Object.values(data)
          .filter(v => typeof v === 'string' || typeof v === 'number')
          .join('\n\n');
      }

      return data;
    } catch (err) {
      return undefined;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let result = await callServer();
  if (result === undefined) result = await callServer();
  if (result === undefined) {
    throw new Error(lastServerError || "KI-Dienst temporär überlastet. Bitte versuche es in wenigen Sekunden erneut.");
  }
  return result;
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
export async function runResearchPipeline(searchQuery, branche = '', lang = 'de', offeringId = null, isLandingPreview = false, angebot = '') {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  try {
    const res = await fetch("/.netlify/functions/nexus-research", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ searchQuery, branche, lang, offeringId, isLandingPreview, angebot })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'temporarily_unavailable') {
        return data;
      }
      if (data && data.trigger_events) {
        return data;
      }
      return data;
    }
  } catch (e) {
    console.warn("[Research Pipeline] Netlify function failed, falling back to direct AI detection:", e.message);
  }

  // Graceful Fallback: Generate real-time high-converting trigger events via Groq cascade
  try {
    const fallbackEvents = await callNexusAI({
      mode: 'trigger_detection',
      query: `Branche/Suchbegriff: ${searchQuery} ${branche}`.trim(),
      lang: lang || 'de'
    });
    if (fallbackEvents && fallbackEvents.trigger_events) {
      return fallbackEvents;
    }
    if (Array.isArray(fallbackEvents)) {
      return { trigger_events: fallbackEvents };
    }
  } catch(e) {
    console.error("[Research Pipeline] Fallback failed:", e);
  }

  return { trigger_events: [] };
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

  const ctx = opportunityContext || {};
  const searchQuery = typeof ctx === 'string' 
    ? ctx 
    : (ctx.company?.name || (typeof ctx.company === 'string' ? ctx.company : '') || ctx.searchQuery || '');
  const branche = ctx.company?.industry || ctx.branche || '';
  const offeringId = ctx.offering_id || ctx.offering?.id || null;
  const angebot = ctx.offering?.offering_name || (typeof ctx.offering === 'string' ? ctx.offering : '') || ctx.angebot || '';

  const res = await fetch('/.netlify/functions/nexus-research', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      searchQuery,
      branche,
      offeringId,
      angebot,
      opportunityContext: ctx
    })
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

  const text = await res.text();
  
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = JSON.parse(text);
      errMsg += `: ${err.error || JSON.stringify(err)}`;
    } catch(e) {
      errMsg += `: ${text.substring(0, 200)}`;
    }
    throw new Error(errMsg);
  }

  try {
    return JSON.parse(text);
  } catch(e) {
    throw new Error(`Ungültige Antwort vom Server: ${text.substring(0, 200)}`);
  }
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

/**
 * Ruft die NeXus Social Intelligence Function auf (Recherche & Generierung)
 */
export async function callSocialIntelligence(params) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-social-intelligence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Social Intelligence Error: ${err.error || res.statusText}`);
  }

  return res.json();
}

/**
 * Ruft die Elite Enrichment Pipeline auf
 * Findet Ansprechpartner + E-Mail für ein Lead Package.
 */
export async function callEliteEnrichment({ leadPackageId }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  const res = await fetch('/.netlify/functions/nexus-elite-enrichment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ leadPackageId })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Elite Enrichment Error: ${err.error || res.statusText}`);
  }

  return res.json();
}

