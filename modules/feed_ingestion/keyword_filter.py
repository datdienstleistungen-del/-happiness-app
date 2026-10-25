import re
import unicodedata

try:
    from modules.feed_ingestion.config import SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS
except ImportError:
    from .config import SIGNAL_CATEGORIES, NEGATIVE_KEYWORDS

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

def evaluate_signal(item):
    """
    Evaluates feed item title and snippet against defined category keywords.
    1. Negative filter check: Discards small businesses and tips/advice articles with Score 0.
    2. Focus on C-Level & Board Vacancies (ORGANVAKANZ & LEADERSHIP).
    Returns None if no relevant match or negative filter hit; returns evaluation dict otherwise.
    """
    title = item.get('title', '')
    snippet = item.get('snippet', '')
    raw_text = f"{title} {snippet}"
    norm_text = normalize_text(raw_text)

    # 1. Negative Filter Check (Score 0 / Drop)
    is_neg, neg_kw = check_negative_filter(raw_text)
    if is_neg:
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
