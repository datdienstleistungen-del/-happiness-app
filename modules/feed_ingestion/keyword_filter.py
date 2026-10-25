import re
import unicodedata

try:
    from modules.feed_ingestion.config import (
        SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS,
        LEGAL_FORM_BLACKLIST, LEGAL_FORM_WHITELIST
    )
except ImportError:
    from .config import (
        SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS,
        ROLE_BLACKLIST, ROLE_WHITELIST, MANDATORY_EVENT_KEYWORDS,
        LEGAL_FORM_BLACKLIST, LEGAL_FORM_WHITELIST
    )

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
    Validates company legal form:
    - Drops if legal form blacklist matches (e.g. e.K., GbR, UG, Verein).
    """
    combined = f"{company_name} {text}".lower()
    norm = normalize_text(combined)
    for bl in LEGAL_FORM_BLACKLIST:
        norm_b = normalize_text(bl)
        pattern = r'(?:\b|^)' + re.escape(norm_b) + r'(?:\b|$)'
        if re.search(pattern, norm):
            return False, f"LEGAL_FORM_BLACKLIST: '{bl}'"
    return True, "LEGAL_FORM_OK"

def evaluate_signal(item):
    """
    Zero-Tolerance Ingestion Evaluator (Stufe 1):
    1. URL check: Rejects truncated URLs (ending in '...') and invalid sources.
    2. Mandatory Event Gatekeeper: Rejects empty or 'Keine Angabe' events.
    3. Legal Form check: Rejects GbR, e.K., UG, Verein, etc.
    4. Negative filter check: Discards retail/small business/how-to articles.
    5. Seniority check: Blacklists middle management, enforces Organ/C-Level whitelist.
    6. Event matching: Requires concrete verified Mandatsanlass.
    """
    url = (item.get('url') or '').strip()
    if not url or url.endswith('...') or url.endswith('…') or len(url) < 15:
        # Truncated or invalid URL
        return None

    title = (item.get('title') or '').strip()
    snippet = (item.get('snippet') or '').strip()
    company = (item.get('company') or '').strip()
    
    # Hard Event Gatekeeper: Title or Snippet must exist and not be dummy text
    if not title or title.lower() in ('keine angabe', 'none', 'null', 'unternehmen') or len(title) < 10:
        return None
    if snippet.lower() in ('keine angabe', 'none', 'null'):
        snippet = ""

    raw_text = f"{title} {snippet}".strip()
    norm_text = normalize_text(raw_text)

    # 1. Legal Form Filter Check (Drop e.K., GbR, UG, Verein)
    is_legal_ok, legal_reason = check_legal_form(company, raw_text)
    if not is_legal_ok:
        return None

    # 2. Negative Filter Check (Score 0 / Drop)
    is_neg, neg_kw = check_negative_filter(raw_text)
    if is_neg:
        return None

    # 3. Seniority Check (Organ/C-Level only; middle management blacklist)
    is_senior, senior_reason = check_role_seniority(raw_text)
    if not is_senior:
        return None

    # 4. Mandatory Event Gatekeeper (Concrete verified anlass required)
    has_event, event_kw = check_mandatory_event(raw_text)
    if not has_event:
        return None

    best_match = None
    best_priority_rank = 0  # 3: ORGANVAKANZ (Prio 1), 2: RESTRUKTURIERUNG, 1: M&A

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
            # If higher priority or same priority with more keyword hits
            if rank > best_priority_rank or (rank == best_priority_rank and len(matched_kw) > len(best_match.get("matched_keywords", []))):
                best_priority_rank = rank

                # Confidence calculation
                confidence = cat_data["base_confidence"]
                if len(matched_kw) > 1:
                    confidence = min(0.98, confidence + 0.04)

                region = item.get("region", "DACH")
                prio_str = cat_data["prio"]

                if cat_name == "ORGANVAKANZ & LEADERSHIP":
                    strategic_angle = f"Region: {region} | Akute Organvakanz / C-Level & Board Transition – Unmittelbarer Beratungs- & Interim-Mandatsanlass."
                elif cat_name == "RESTRUKTURIERUNG & SONDERSITUATIONEN":
                    strategic_angle = f"Region: {region} | Restrukturierungsdruck auf Führungsebene – Bedarf für Sanierungsmoderation & Chief Restructuring Officer (CRO)."
                else:
                    strategic_angle = f"Region: {region} | Strategische Neuausrichtung & M&A – Organbegleitung bei Post-Merger-Integration oder Carve-out."

                relevance_logic = f"Kategorie: {cat_name} | Treffer: {', '.join(matched_kw[:3])} | Quelle: {item.get('source_name', 'Feed')}"

                best_match = {
                    "category": cat_name,
                    "prio": prio_str,
                    "priority_db": cat_data["priority_db"],
                    "confidence_score": round(confidence, 2),
                    "matched_keywords": matched_kw,
                    "relevance_logic": relevance_logic,
                    "strategic_angle": strategic_angle
                }

    return best_match
