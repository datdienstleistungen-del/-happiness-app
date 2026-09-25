/**
 * Shared Grounding Helpers (Anti-Halluzination)
 * 
 * Wiederkehrendes Pattern für alle Stellen, die LLM-Output gegen Quellen prüfen:
 * - Contact Intelligence: Name + Evidence muss im Crawl-Text vorkommen
 * - Message Generation: Behauptungen müssen durch Evidence gedeckt sein
 * - (zukünftig) Trigger Evaluation, Research Summary, etc.
 */

/**
 * Prüft ob ein Text (Name, Zitat, Behauptung) wörtlich oder sinngemäß 
 * in einer Quelle vorkommt.
 * 
 * @param {string} claim - Zu prüfende Behauptung
 * @param {string} sourceText - Quelldertext (z.B. gecrawlte Website)
 * @param {object} options
 * @param {boolean} options.exactMatch - Nur wörtlicher Match (default: false)
 * @param {number} options.minSnippetLength - Mindestlänge des Vergleichs-Snippets (default: 20)
 * @returns {{ grounded: boolean, reason: string }}
 */
export function checkTextGroundedInSource(claim, sourceText, options = {}) {
  const { exactMatch = false, minSnippetLength = 20 } = options;
  
  if (!claim || !sourceText) {
    return { grounded: false, reason: 'claim or sourceText missing' };
  }
  
  const claimLower = claim.toLowerCase().trim();
  const sourceLower = sourceText.toLowerCase();
  
  // Direkter Wörtlich-Match
  if (sourceLower.includes(claimLower)) {
    return { grounded: true, reason: 'exact match found' };
  }
  
  // Snippet-basierter Match: Erste N Zeichen des Claims prüfen
  const snippet = claimLower.substring(0, Math.max(minSnippetLength, claimLower.length * 0.6));
  if (sourceLower.includes(snippet)) {
    return { grounded: true, reason: `snippet match (${snippet.length} chars)` };
  }
  
  // Bei exactMatch: Kein weiterer Check
  if (exactMatch) {
    return { grounded: false, reason: 'no exact match' };
  }
  
  // Wort-basierter Match: Einzelne Wörter des Claims prüfen
  const claimWords = claimLower.split(/\s+/).filter(w => w.length > 3);
  const matchedWords = claimWords.filter(w => sourceLower.includes(w));
  const matchRatio = claimWords.length > 0 ? matchedWords.length / claimWords.length : 0;
  
  if (matchRatio >= 0.7) {
    return { grounded: true, reason: `word match ${Math.round(matchRatio * 100)}% (${matchedWords.length}/${claimWords.length})` };
  }
  
  return { grounded: false, reason: `low word match ${Math.round(matchRatio * 100)}% (${matchedWords.length}/${claimWords.length})` };
}

/**
 * Prüft ob Behauptungen in einer generierten Nachricht durch Evidence gedeckt sind.
 * 
 * @param {string[]} claims - Behauptungen aus der Nachricht (used_facts)
 * @param {string} evidence - Evidence-Text aus Contact Intelligence
 * @param {string} sourceText - Optional: Original-Quelldext (Website)
 * @returns {{ allGrounded: boolean, results: Array<{claim, grounded, reason}> }}
 */
export function checkMessageGroundedInEvidence(claims, evidence, sourceText = null) {
  const results = [];
  
  for (const claim of claims) {
    // Zuerst gegen Evidence prüfen
    const againstEvidence = checkTextGroundedInSource(claim, evidence, { exactMatch: false });
    
    // Wenn gegen Evidence nicht gedeckt, gegen Original-Quelle prüfen
    let finalResult = againstEvidence;
    if (!againstEvidence.grounded && sourceText) {
      const againstSource = checkTextGroundedInSource(claim, sourceText, { exactMatch: false });
      if (againstSource.grounded) {
        finalResult = { grounded: true, reason: `source: ${againstSource.reason}` };
      }
    }
    
    results.push({ claim, ...finalResult });
  }
  
  const allGrounded = results.every(r => r.grounded);
  return { allGrounded, results };
}

/**
 * Erkennt konkrete Leistungszahlen (Prozente, Euro, Stückzahlen)
 * die nicht durch eine Quelle belegt sind.
 * 
 * @param {string} text - Zu prüfender Text
 * @returns {{ hasNumbers: boolean, numbers: string[] }}
 */
export function detectConcreteNumbers(text) {
  if (!text) return { hasNumbers: false, numbers: [] };
  
  const patterns = [
    /\d+[\.,]?\d*\s*%/g,                    // 20%, 5,5%, 10.000%
    /\d+[\.,]?\d*\s*(?:Euro|EUR|€)/g,       // 5000 Euro, 5.000€
    /\d+[\.,]?\d*\s*(?:Mio|Millionen?)/g,   // 2 Mio, 5 Millionen
    /\d+[\.,]?\d*\s*(?:Tausend|k)/g,        // 50 Tausend, 100k
  ];
  
  const numbers = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) numbers.push(...matches);
  }
  
  return { hasNumbers: numbers.length > 0, numbers };
}

/**
 * Segmentiert einen Text in Sätze (mechanisch, ohne LLM).
 * 
 * @param {string} text - Zu segmentierender Text
 * @returns {string[]} Array von Sätzen
 */
export function segmentSentences(text) {
  if (!text) return [];
  
  // Satzende: Punkt, Ausrufezeichen, Fragezeichen, gefolgt von Leerzeichen oder Zeilenende
  // Berücksichtigt keine Abkürzungen (Hr., etc.) — für B2B-Outreach ausreichend
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Kurze Fragmente ignorieren
}

/**
 * Mechanischer Grounding-Check: Segmentiert die Nachricht in Sätze
 * und prüft jeden Satz gegen die Evidence-Quelle.
 * 
 * Läuft OHNE LLM-Input — das LLM kann diesen Check nicht umgehen.
 * 
 * @param {string} message - Die generierte Nachricht
 * @param {string} evidence - Evidence-Text aus Contact Intelligence
 * @param {string} sourceText - Optional: Original-Quelldtext (Website)
 * @returns {{ allGrounded: boolean, results: Array<{sentence, grounded, reason}> }}
 */
export function checkMessageGroundedMechanical(message, evidence, sourceText = null) {
  const sentences = segmentSentences(message);
  const results = [];
  
  for (const sentence of sentences) {
    // Jeden Satz einzeln gegen Evidence prüfen
    const againstEvidence = checkTextGroundedInSource(sentence, evidence, { exactMatch: false });
    
    let finalResult = againstEvidence;
    if (!againstEvidence.grounded && sourceText) {
      const againstSource = checkTextGroundedInSource(sentence, sourceText, { exactMatch: false });
      if (againstSource.grounded) {
        finalResult = { grounded: true, reason: `source: ${againstSource.reason}` };
      }
    }
    
    results.push({ sentence, ...finalResult });
  }
  
  const allGrounded = results.every(r => r.grounded);
  return { allGrounded, results };
}
