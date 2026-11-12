/**
 * NeXus Kontextparser für Evidence-Extrakte
 * 
 * Extrahiert strukturierte Kontext-Informationen aus rohen Texten (evidence),
 * um die A/B/C-D-Klassifizierung von Interim-Mandats-Signalen zu unterstützen.
 * Erkennt Muster wie "ernannt als Verstärkung", "strategische Übernahme",
 * "Governance-Verstärkung" etc. und kennzeichnet sie für die Validierung.
 * 
 * Diese Datei ist lesender Natur und überschreibt keine existing Funktionalität.
 * Sie stellt Hilfsfunktionen bereit, die von nexus-validation.js und
 * der Reality-Check-Engine (reality_check.py) genutzt werden können.
 */

export class Kontextparser {

  /**
   * Erkennt Gegenindikatoren im Text, die eine Hochstufung auf A verhindern.
   * @param {string} evidenceText - Das evidence-Zitat aus dem Signal
   * @returns {string[]} Gefundene Gegenindikator-Schlüssel
   */
  static gegenindikatorenErkunden(evidenceText) {
    if (!evidenceText || typeof evidenceText !== 'string') return [];
    const text = evidenceText.toLowerCase().trim();
    const gefundene = [];

    const muster = {
      'ernannt_als_verstärkung': ['ernannt als verstärkung', 'ernannt zur verstärkung', 'verstärkung des vorstands', 'verstärkung der geschäftsführung'],
      'uebernahme_strategisch': ['strategische übernahme', 'übernahme zur stärkung der marktposition', 'übernahme im rahmen der wachstumsstrategie', 'asset deal zum ausbau'],
      'unternehmens_profitabel': ['unternehmen ist profitabel', 'profitables geschäftsjahr', 'gewinnbringendes quartal', 'ebit deutlich positiv'],
      'liquide': ['liquidität steht', 'liquidität ist gesichert', 'ausreichende liquidität', 'keine zahlungsengpässe'],
      'geplanter_nachfolger': ['geplante nachfolge', 'interne nachfolge', 'nachfolge nach internen regelung', 'nachfolgekonform'],
    };

    for (const [key, patterns] of Object.entries(muster)) {
      if (patterns.some(p => text.includes(p))) {
        gefundene.push(key);
      }
    }

    return gefundene;
  }

  /**
   * Erkennt Bestätigungsindikatoren, die eine A-Klassifizierung näherbringen.
   * @param {string} evidenceText - Das evidence-Zitat
   * @returns {string[]} Gefundene Bestätigungs-Schlüssel
   */
  static bestatigungsindikatorenErkunden(evidenceText) {
    if (!evidenceText || typeof evidenceText !== 'string') return [];
    const text = evidenceText.toLowerCase().trim();
    const gefundene = [];

    const muster = {
      'cro_bearbeitet': ['cro bestellt', 'interim-cfo ernannt', 'sanierungsmandat erteilt', 'cro-ernennung'],
    };

    for (const [key, patterns] of Object.entries(muster)) {
      if (patterns.some(p => text.includes(p))) {
        gefundene.push(key);
      }
    }

    return gefundene;
  }

  /**
   * Wirtschafts- und Kontextindikatoren extrahieren (Ebene 2).
   * Erkennt Mustern wie Eigenverwaltung, Schutzschirm, Restrukturierung etc.
   * Diese sind weder A-Nachweis noch Gegenindikator, sondern kennzeichnen
   * die wirtschaftliche Situation für die spätere Klassifizierung.
   * @param {string} evidenceText - Das evidence-Zitat aus dem Signal
   * @returns {string[]} Gefundene Kontext-Schlüssel
   */
  static wirtschaftlicherKontextErkunden(evidenceText) {
    if (!evidenceText || typeof evidenceText !== 'string') return [];
    const text = evidenceText.toLowerCase().trim();
    const gefun = [];

    const muster = {
      'eigenverwaltung': ['eigenverwaltung', 'starug', 'vorläufige eigenverwaltung', 'anordnung der eigenverwaltung'],
      'schutzschirm': ['schutzschirm', 'Schutzschirmverfahren', '§ 270 InsO', '§ 270a InsO'],
      'restrukturierung': ['restrukturierung', 'sanierung', 'transformationsmaßnahme', 'werksschließung', 'standortschließung'],
      'insolvenz': ['insolvenzverfahren', 'insolvenzantrag', 'insolvenzeröffnung'],
    };

    for (const [key, patterns] of Object.entries(muster)) {
      if (patterns.some(p => text.includes(p))) {
        gefun.push(key);
      }
    }

    return gefun;
  }

  /**
   * Extrahiert den reinen evidence-Kern und klassifiziert ihn
   * nach der Fünf-Stufen-Logik (Ereignis → Kontext → Aufgabe → Nachweis → Gegenkontext).
   * Erst nach der getrennten Erfassung aller fünf Ebenen erfolgt die Gesamtklassifizierung
   * in Kategorien A/B/C/D.
   * @param {string} evidenceText - Das evidence-Zitat
   * @returns {object} Klassifizierungsergebnis mit kat (A/B/C/D) und gegenindikatoren/bestatigungsindikatoren/kontext_ebenen
   */
  static evidenceKategorisieren(evidenceText) {
    if (!evidenceText || typeof evidenceText !== 'string') {
      return { kat: 'none', treat: 'C', begründung: 'Kein gültiger evidence-Text vorhanden.' };
    }

    const text = evidenceText.toLowerCase().trim();

    // Zuerst Gegenindikatoren prüfen (haben Priorität, blockieren A nur ohne Ebene-4-Nachweis)
    const gegen = this.gegenindikatorenErkunden(evidenceText);
    const gegenHatPrioritaet = gegen.length > 0;
    
    // E4: Bestätigter externer Interim-Nachweis (Cro + explizite Such-/Beauftragungsformulierung)
    const best = this.bestatigungsindikatorenErkunden(evidenceText);
    const explicitMandatePattern = /(sucht|bestellt|beauftragt|ernannt).{0,50}(externen?\s+interim|interim-cfo|interim-ceo|interim-ceo|interim-coo)/i;
    const hasExplicitMandate = best.includes('cro_bearbeitet') && explicitMandatePattern.test(evidenceText);
    
    // E2: Wirtschaftlicher Kontext extrahieren
    const kontext = this.wirtschaftlicherKontextErkunden(evidenceText);
    
    // E3: Managementaufgaben-Muster (vereinfacht)
    const aufgabenMuster = ['restrukturierung', 'sanierung', 'transformationsmaßnahme', 'übernahme', 'carve-out', 'PMI'];
    const hatAufgabe = aufgabenMuster.some(p => text.includes(p));
    
    // E5: Gegenkontext-Muster (senken B, blockieren A nur ohne E4)
    const gegenMuster = [
      'ernannt_als_verstärkung', 'uebernahme_strategisch', 
      'unternehmens_profitabel', 'liquide', 'geplanter_nachfolger'
    ];
    const hatGegenKontext = gegenMuster.some(k => gegen.includes(k));
    
    // ---------- Entscheidungskette nach Fünf-Ebenen-Modell ----------
    
    // 1. E4: Belegter externer Interim-Nachweis hat absolutem Vorrang → A
    if (hasExplicitMandate) {
      return { kat: 'A', begründung: 'Konkreter Nachweis für externen Interim-Bedarf durch bestätigte Beauftragung oder Suche.', bestatigungsindikatoren: best, gegenindikatoren: gegen, kontext_ebenen: { kontext: kontext, gegen: gegen, hatAufgabe: hatAufgabe } };
    }
    
    // 2. Gegenkontext blockiert A (mind. C), wenn kein E4 vorliegt
    if (gegenHatPrioritaet && !hasExplicitMandate) {
      const gegenMapping = {
        'ernannt_als_verstärkung': { kat: 'C', begründung: 'Governance-Verstärkung, keine Vakanz.' },
        'uebernahme_strategisch': { kat: 'C', begründung: 'Strategische Maßnahme, keine Krise.' },
        'unternehmens_profitabel': { kat: 'C', begründung: 'Wirtschaftlich gut aufgestellt.' },
        'liquide': { kat: 'C', begründung: 'Finanzielle Absicherung.' },
        'geplanter_nachfolger': { kat: 'C', begründung: 'Geplanter Wechsel, kein Krisenmanagement.' },
      };
      const fund = gegenMuster.includes(gegen[0]) ? gegenMapping[gegen[0]] : { kat: 'C', begründung: 'Gegenkontext erkannt, klassifiziert auf C.' };
      return { kat: fund.kat, begründung: fund.begründung, gegenindikatoren: gegen, kontext_ebenen: { kontext: kontext, gegen: gegen, hatAufgabe: hatAufgabe } };
    }
    
    // 3. E2 + E3 → B (plausibler Bedarf ohne belegtes A)
    if (kontext.length > 0 && hatAufgabe && !hasExplicitMandate) {
      return { kat: 'B', begründung: 'Plausibler externer Interim-Bedarf: Wirtschaftlicher Kontext und konkrete Managementaufgabe erkennbar, aber kein belegter externer Mandat.', gegenindikatoren: gegen, bestatigungsindikatoren: best, kontext_ebenen: { kontext: kontext, gegen: gegen, hatAufgabe: hatAufgabe } };
    }
    
    // 4. E2 allein → C (wirtschaftliches Problem ohne erkennbaren externen Bedarf)
    if (kontext.length > 0 && !hasExplicitMandate) {
      return { kat: 'C', begründung: 'Wirtschaftliches oder strukturelles Problem ohne erkennbaren externen Interim-Bedarf.', gegenindikatoren: gegen, bestatigungsindikatoren: best, kontext_ebenen: { kontext: kontext, gegen: gegen, hatAufgabe: hatAufgabe } };
    }
    
    // 5. D: unzureichende Datenlage (auch leere/nicht-passende Eingabe)
    return { kat: 'D', begründung: 'Evidence-Text erkannt, aber für eine belastbare Bewertung liegen keine ausreichenden Daten vor.', gegenindikatoren: gegen, bestatigungsindikatoren: best, kontext_ebenen: { kontext: kontext, gegen: gegen, hatAufgabe: hatAufgabe } };
  }
}

/**
 * Bequemliche Exportfunktion für die Verwendung in Validierungs-Pipelines.
 * Wendet die Kontextprüfung gemäß mandate_classification_rules.json an.
 * @param {object} signal - Das extrahierte Signal-Objekt (mit evidence-Feld)
 * @returns {object} Erweitertes Signal mit kontext-Analyse
 */
export function analyseSignalKontext(signal) {
  if (!signal || !signal.evidence) {
    return { ...signal, kontext_analyse: { kat: 'D', gegenindikatoren: [], fehlende_daten: true } };
  }

  const parser = new Kontextparser();
  const gegen = parser.gegenindikatorenErkunden(signal.evidence);
  const best = parser.bestatigungsindikatorenErkunden(signal.evidence);
  const kategorie = parser.evidenceKategorisieren(signal.evidence);

  return {
    ...signal,
    kontext_analyse: {
      kat: kategorie.kat,
      gegenindikatoren: gegen,
      bestatigungsindikatoren: best,
      begründung: kategorie.begründung,
      fehlende_daten: kategorie.kat === 'D'
    }
  };
}