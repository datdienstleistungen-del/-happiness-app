import re
try:
    from modules.feed_ingestion.config import SIGNAL_CATEGORIES
except ImportError:
    from .config import SIGNAL_CATEGORIES

def normalize_text(text):
    """Normalize text for consistent keyword matching."""
    if not text:
        return ""
    t = text.lower()
    # Replacements for German umlauts for fuzzy keyword hits
    t = t.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return t

def evaluate_signal(item):
    """
    Evaluates feed item title and snippet against defined category keywords.
    Returns None if no relevant keywords match, or evaluation dict if matched.
    """
    raw_text = f"{item.get('title', '')} {item.get('snippet', '')}"
    norm_text = normalize_text(raw_text)

    best_match = None
    best_priority_rank = 0  # 3: ORGANVAKANZ (Prio 1), 2: RESTRUKTURIERUNG (Prio 2), 1: M&A (Prio 3)

    category_ranks = {
        "ORGANVAKANZ & LEADERSHIP": 3,
        "RESTRUKTURIERUNG & SONDERSITUATIONEN": 2,
        "M&A & TRANSFORMATION": 1
    }

    for cat_name, cat_data in SIGNAL_CATEGORIES.items():
        matched_kw = []
        for kw in cat_data["keywords"]:
            norm_kw = normalize_text(kw)
            # Match word boundary or exact substring
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
                    confidence = min(0.98, confidence + 0.05)
                
                # Add strategic angle
                region = item.get("region", "DACH")
                prio_str = cat_data["prio"]
                
                if cat_name == "ORGANVAKANZ & LEADERSHIP":
                    strategic_angle = f"Region: {region} | Prio: {prio_str} | Akute Organvakanz / Führungslücke – Unmittelbarer Bedarf für Executive Interim & Mandatsübernahme."
                elif cat_name == "RESTRUKTURIERUNG & SONDERSITUATIONEN":
                    strategic_angle = f"Region: {region} | Prio: {prio_str} | Sanierungs- & Restrukturierungsdruck – Mandatsbedarf für CRO / Sanierungsmoderation & Krisenmanagement."
                else:
                    strategic_angle = f"Region: {region} | Prio: {prio_str} | M&A- / Carve-Out-Dynamik – Begleitung bei Unternehmenstransformation & Post-Merger-Integration."

                relevance_logic = f"Kategorie: {cat_name} | Match: {', '.join(matched_kw)} | Quelle: {item.get('source_name', 'Feed')}"

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
