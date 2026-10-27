import re
import unicodedata

try:
    from modules.feed_ingestion.config import (
        SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS,
        LEGAL_FORM_BLACKLIST, LEGAL_FORM_WHITELIST
    )
    from modules.feed_ingestion.date_utils import is_signal_fresh
except ImportError:
    from .config import (
        SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS,
        LEGAL_FORM_BLACKLIST, LEGAL_FORM_WHITELIST
    )
    from .date_utils import is_signal_fresh

def normalize_text(text):
    """Normalize text for consistent multi-language keyword matching."""
    if not text:
        return ""
    t = text.lower()
    # Normalize German umlauts
    t = t.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    # Decompose unicode accents for fuzzy matching (é -> e, etc.)
    nfkd = unicodedata.normalize('NFKD', t)
    t_clean = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    return t_clean

def check_negative_filter(text):
    """
    Checks whether text contains negative keywords (small businesses, advice articles).
    Returns (is_negative, matched_negative_keyword).
    """
    norm = normalize_text(text)
    for neg in NEGATIVE_KEYWORDS:
        norm_neg = normalize_text(neg)
        # Search word or phrase boundary
        pattern = r'(?:\b|^)' + re.escape(norm_neg) + r'(?:\b|$)'
        if re.search(pattern, norm):
            return True, neg
    return False, None

def check_role_seniority(text):
    """
    Validates seniority on board/c-level.
    Returns (is_valid, reason):
    - Rejects if role blacklist is matched (e.g. Vertriebsleiter, Sales Manager, etc.)
    - Rejects if no C-Level/Organ whitelist keyword is present.
    """
    norm = normalize_text(text)
    
    # 1. Blacklist check (Strict rejection)
    for blacklisted in ROLE_BLACKLIST:
        norm_b = normalize_text(blacklisted)
        pattern = r'(?:\b|^)' + re.escape(norm_b) + r'(?:\b|$)'
        if re.search(pattern, norm):
            return False, f"ROLE_BLACKLIST: '{blacklisted}'"

    # 2. Whitelist check (Must touch at least one organ/c-level position)
    has_whitelist = False
    for whitelisted in ROLE_WHITELIST:
        norm_w = normalize_text(whitelisted)
        pattern = r'(?:\b|^)' + re.escape(norm_w) + r'(?:\b|$)'
        if re.search(pattern, norm):
            has_whitelist = True
            break
            
    if not has_whitelist:
        return False, "NO_ORGAN_OR_CLEVEL_ROLE"

    return True, "QUALIFIED_C_LEVEL"

def check_mandatory_event(text):
    """
    Checks if a concrete verified event / Mandatsanlass exists.
    Returns (has_event, matched_keyword).
    """
    norm = normalize_text(text)
    for kw in MANDATORY_EVENT_KEYWORDS:
        norm_kw = normalize_text(kw)
        pattern = r'(?:\b|^)' + re.escape(norm_kw) + r'(?:\b|$)'
        if re.search(pattern, norm):
            return True, kw
    return False, None

def check_legal_form(company_name, text):
    """
    Validates company legal form (Klinge 2: Whitelist-Check):
    - Drops if legal form blacklist matches (e.g. e.K., GbR, UG, Verein).
    - Enforces whitelist on Enterprise / Kapitalgesellschaften (erlaubt nur: AG, SE, KGaA, Plc, SA, NV, SpA, Corp, Groß-GmbH).
    """
    combined = f"{company_name} {text}".lower()
    norm = normalize_text(combined)

    # 1. Blacklist check
    for bl in LEGAL_FORM_BLACKLIST:
        norm_b = normalize_text(bl)
        pattern = r'(?:\b|^)' + re.escape(norm_b) + r'(?:\b|$)'
        if re.search(pattern, norm):
            return False, f"LEGAL_FORM_BLACKLIST: '{bl}'"

    # 2. Whitelist check (AG, SE, KGaA, Plc, SA, NV, SpA, Corp, Groß-GmbH)
    norm_comp = normalize_text(company_name)
    has_whitelist_form = False
    for wf in LEGAL_FORM_WHITELIST:
        norm_w = normalize_text(wf)
        pattern = r'(?:\b|^)' + re.escape(norm_w) + r'(?:\b|$)'
        if re.search(pattern, norm_comp) or re.search(pattern, norm):
            has_whitelist_form = True
            break

    if not has_whitelist_form:
        # Check if recognized major listed corporation
        is_major = bool(re.search(r'\b(daimler|siemens|volkswagen|bmw|basf|bayer|allianz|sap|telekom|e\.on|rwe|airbus|nestle|novartis|roche|ubs|glencore|abb|shell|bp|vodafone|barclays|hsbc|santander|bbva|telefonica|totalenergies|sanofi|axa|bnp|stellantis|atlassian|sitime|pescanova)\b', norm_comp))
        if not is_major:
            return False, "NON_WHITELIST_LEGAL_FORM: Erlaubt nur AG, SE, KGaA, Plc, SA, NV, SpA, Corp, Groß-GmbH"

    return True, "LEGAL_FORM_OK"

def check_substance_gate(company_name, text, item=None):
    """
    Substanz-Gate für Register-Meldungen (z. B. SHAB, Handelsregister):
    1. Verwirft Meldungen, wenn im Text erkennbar ist, dass es sich um reine
       Mantelgesellschaften, Domizilgesellschaften (c/o) oder vermögensverwaltende
       Kleinst-AGs ohne operatives Geschäft handelt.
    2. Prüft das im Registertext genannte Kapital: Handelt es sich um das bloße
       gesetzliche Mindestkapital ohne weiteres operatives Personal/Organe,
       wird der Datensatz als unqualifiziert verworfen.
    Returns (is_qualified, drop_reason)
    """
    pdf_text = (item.get('raw_pdf_text', '') if item else '')
    combined = f"{company_name} {text} {pdf_text}".lower()
    norm = normalize_text(combined)

    # 1. Reine Domizilhüllen & Briefkastensitze (c/o, Treuhand-Domizil, Domizilgewährung)
    domicile_shell_patterns = [
        r'\bc/o\b',
        r'\bdomizil bei\b',
        r'\bpar adresse\b',
        r'\badresse de domicile\b',
        r'\bdomicile provider\b',
        r'\bbriefkastengesellschaft\b',
        r'\bdomizilgewaehrung\b',
        r'\bdomizilannahme\b',
        r'\buebernahme von domizilmandaten\b',
        r'\boctroi de domicile\b'
    ]
    for p in domicile_shell_patterns:
        if re.search(p, norm):
            return False, f"SUBSTANZ_GATE: Domizil-/Briefkastenhülle ({p.replace(chr(92), '')})"

    # 2. Reine vermögensverwaltende Hüllen, Liegenschafts- oder Familiengesellschaften
    purpose_shell_patterns = [
        r'\bverwaltung (?:des )?eigenen vermoegens\b',
        r'\bfamiliengesellschaft\b',
        r'\bprivate vermoegensanlage\b',
        r'\banlage und verwaltung (?:von )?eigenem vermoegen\b',
        r'\bgestion de fortune privee\b',
        r'\bgestion de son propre patrimoine\b',
        r'\bhalten und verwalten von liegenschaften\b',
        r'\berwerb,? (?:halten,? )?verwalten von liegenschaften\b',
        r'\berwerb,? belastung,? veraeusserung und verwaltung von grundeigentum\b',
        r'\berwerb,? halten und verkauf von immobilien\b',
        r'\bverwaltung von eigenem grundbesitz\b',
        r'\breine immobilienholding\b'
    ]
    for p in purpose_shell_patterns:
        if re.search(p, norm):
            return False, f"SUBSTANZ_GATE: Reine Vermögens- oder Liegenschaftshülle ({p.replace(chr(92), '')})"

    # 3. Kapitalprüfung: Bloßes Mindestkapital ohne weiteres operatives Personal/Organe
    min_capital_match = re.search(
        r'(?:aktienkapital|stammkapital|capital[- ]actions|capitale azionario)[\s:]*(?:chf|eur|chf\.)?\s*(?:100[\'’.]?000|50[\'’.]?000|20[\'’.]?000|25[\'’.]?000)(?:\.00)?\b',
        norm
    )
    if min_capital_match:
        has_multiple_organs = bool(re.search(
            r'\b(kollektivunterschrift|weitere mitglieder|direktion|geschaeftsleitung|mitarbeiter|team|plattform|kunden|standorte|filialen|betrieb)\b',
            norm
        ))
        is_single_or_empty = bool(re.search(
            r'\b(einziges mitglied|seul administrateur|administrateur unique|alleiniges organ|einzelunterschrift)\b',
            norm
        ))
        has_dormant = bool(item and (item.get('dormant_months', 0) > 12 or item.get('is_dormant_shell')))
        
        if is_single_or_empty and not has_multiple_organs and (has_dormant or 'holding' in company_name.lower() or 'beteiligung' in company_name.lower() or 'invest' in company_name.lower()):
            return False, "SUBSTANZ_GATE: Bloßes Mindestkapital ohne operatives Personal/Organe (Kleinst-Hülle)"

    return True, "SUBSTANZ_OK"

def evaluate_signal(item):
    """
    Substanz- & Validierungs-Gatekeeper (Stufe 1):
    1. URL check: Verwirft abgeschnittene ('...') oder ungültige URLs.
    2. Mandatory Event Gatekeeper: Verwirft leere / 'Keine Angabe' Events.
    3. Legal Form check: Whitelist AG, SE, KGaA, Plc, SA, NV, SpA, Corp, Groß-GmbH.
    4. Substanz-Gate: Verwirft Domizilhüllen, c/o-Sitze, Mindestkapital-Hüllen.
    5. Negative filter check: Verwirft Kleinbetriebe, Beratungstexte, passive PR.
    6. Seniority check: Blacklist Middle Management, Whitelist Organ-/C-Level.
    7. Deterministische Punkte-Logik:
       - Primärquelle nachweisbar: 30 Punkte
       - Organ-Ebene zweifelsfrei verifiziert: 50 Punkte
       - Alter der Meldung <= 48h: 20 Punkte
       - Ohne belegtes Ereignis (Score 0): Drop vor DB.
    """
    url = (item.get('url') or '').strip()
    if not url or url.endswith('...') or url.endswith('…') or len(url) < 15:
        return None

    title = (item.get('title') or '').strip()
    snippet = (item.get('snippet') or '').strip()
    company = (item.get('company') or '').strip()
    
    if not title or title.lower() in ('keine angabe', 'none', 'null', 'unternehmen') or len(title) < 10:
        return None
    if snippet.lower() in ('keine angabe', 'none', 'null'):
        snippet = ""

    raw_text = f"{title} {snippet}".strip()
    norm_text = normalize_text(raw_text)

    # 1. Legal Form Filter Check
    is_legal_ok, legal_reason = check_legal_form(company, raw_text)
    if not is_legal_ok:
        return None

    # 2. Substanz-Gate Check (Mantelgesellschaften, c/o-Domizile, Mindestkapital-Hüllen)
    is_substance_ok, substance_reason = check_substance_gate(company, raw_text, item)
    if not is_substance_ok:
        return None

    # 3. Negative Filter Check (Score 0 / Drop)
    is_neg, neg_kw = check_negative_filter(raw_text)
    if is_neg:
        return None

    # 4. Seniority Check (Organ/C-Level only; middle management blacklist)
    is_senior, senior_reason = check_role_seniority(raw_text)
    if not is_senior:
        return None

    # 5. Mandatory Event Gatekeeper (Konkreter verifizierter Mandatsanlass erforderlich)
    has_event, event_kw = check_mandatory_event(raw_text)
    if not has_event:
        return None

    # ── DETERMINISTISCHE PUNKTE-LOGIK ──
    score_points = 0
    score_breakdown = []

    # Kriterium 1: Primärquelle nachweisbar (30 Punkte)
    primary_source_patterns = [
        r'amtsblattportal\.ch', r'shab\.ch', r'eqs-news\.com', r'investegate\.co\.uk',
        r'cnmv\.es', r'afm\.nl', r'bundesanzeiger\.de', r'unternehmensregister\.de',
        r'handelsregister\.de', r'insolvenzbekanntmachungen\.de', r'justiz\.de',
        r'londonstockexchange\.com'
    ]
    url_lower = url.lower()
    is_primary = any(re.search(p, url_lower) for p in primary_source_patterns) or bool(item.get('raw_pdf_text')) or bool(item.get('is_primary_source'))
    if is_primary:
        score_points += 30
        score_breakdown.append("Primärquelle (+30)")

    # Kriterium 2: Organ-Ebene zweifelsfrei verifiziert (50 Punkte)
    if is_senior:
        score_points += 50
        score_breakdown.append("Organ-Ebene verifiziert (+50)")

    # Kriterium 3: Alter der Meldung <= 48h (20 Punkte)
    event_date_val = item.get('event_date') or item.get('published_at') or ''
    is_fresh = False
    if event_date_val:
        is_fresh, age_hours, _ = is_signal_fresh(event_date_val, max_hours=48)
    else:
        is_fresh = True
    
    if is_fresh:
        score_points += 20
        score_breakdown.append("Alter <= 48h (+20)")

    # Ohne belegtes Ereignis oder Score = 0 -> Datensatz wird vor der DB gedroppt
    if score_points <= 0:
        return None

    confidence = round(score_points / 100.0, 2)

    best_match = None
    best_priority_rank = 0

    category_ranks = {
        "ORGANVAKANZ & LEADERSHIP": 3,
        "RESTRUKTURIERUNG & SONDERSITUATIONEN": 2,
        "M&A & TRANSFORMATION": 1
    }

    for cat_name, cat_data in SIGNAL_CATEGORIES.items():
        matched_kw = []
        for kw in cat_data["keywords"]:
            norm_kw = normalize_text(kw)
            if norm_kw in norm_text:
                matched_kw.append(kw)

        if matched_kw:
            rank = category_ranks.get(cat_name, 1)
            if rank > best_priority_rank or (rank == best_priority_rank and len(matched_kw) > len(best_match.get("matched_keywords", []))):
                best_priority_rank = rank

                region = item.get("region", "DACH")
                prio_str = cat_data["prio"]

                if cat_name == "ORGANVAKANZ & LEADERSHIP":
                    strategic_angle = f"Region: {region} | Akute Organvakanz / C-Level & Board Transition – Unmittelbarer Beratungs- & Interim-Mandatsanlass."
                elif cat_name == "RESTRUKTURIERUNG & SONDERSITUATIONEN":
                    strategic_angle = f"Region: {region} | Restrukturierungsdruck auf Führungsebene – Bedarf für Sanierungsmoderation & Chief Restructuring Officer (CRO)."
                else:
                    strategic_angle = f"Region: {region} | Strategische Neuausrichtung & M&A – Organbegleitung bei Post-Merger-Integration oder Carve-out."

                relevance_logic = f"Score: {score_points}/100 ({', '.join(score_breakdown)}) | Kategorie: {cat_name} | Treffer: {event_kw} | Quelle: {item.get('source_name', 'Feed')}"

                best_match = {
                    "category": cat_name,
                    "prio": prio_str,
                    "priority_db": cat_data["priority_db"],
                    "confidence_score": confidence,
                    "lead_score": score_points,
                    "matched_keywords": matched_kw,
                    "relevance_logic": relevance_logic,
                    "strategic_angle": strategic_angle
                }

    if not best_match:
        region = item.get("region", "DACH")
        best_match = {
            "category": "ORGANVAKANZ & LEADERSHIP",
            "prio": "Prio 1",
            "priority_db": "TIER_1_TOP" if score_points >= 80 else "TIER_2_MID",
            "confidence_score": confidence,
            "lead_score": score_points,
            "matched_keywords": [event_kw],
            "relevance_logic": f"Score: {score_points}/100 ({', '.join(score_breakdown)}) | Treffer: {event_kw}",
            "strategic_angle": f"Region: {region} | Verifiziertes Organmandats-Signal aus Primärquelle."
        }

    return best_match
