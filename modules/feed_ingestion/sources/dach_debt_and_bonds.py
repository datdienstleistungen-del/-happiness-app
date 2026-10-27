"""
NeXus HIT - Source Collector: DACH Capital Markets, Bonds & Debt Restructuring
Erfasst öffentlich dokumentierte Anleihe-Restrukturierungen, Gläubigerversammlungen
nach dem Schuldverschreibungsgesetz (SchVG), Stillhalteabkommen und C-Level-Finanzvakanzen
im kapitalmarktorientierten Mittelstand (0 € Budget, öffentlich zugängliche Primärmeldungen).
"""

import urllib.request
import re
import html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.event_model import TriggerEvent
    from modules.feed_ingestion.date_utils import parse_date
except ImportError:
    from ..event_model import TriggerEvent
    from ..date_utils import parse_date

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml,application/xml,text/xml,text/html;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
}

FEED_URLS = [
    'https://www.anleihen-finder.de/feed',
    'https://www.anleihen-finder.de/?s=glaeubiger&feed=rss2',
    'https://www.anleihen-finder.de/?s=restrukturierung&feed=rss2',
    'https://www.anleihen-finder.de/?s=stillhaltevereinbarung&feed=rss2',
    'https://www.anleihen-finder.de/?s=laufzeitverlaengerung&feed=rss2'
]

# Exclusion keywords for generic editorial overviews, interviews or opinion columns
EXCLUDE_PREFIXES = [
    'ANLEIHEN-Woche',
    '«Fußnote»',
    '"Fußnote"',
    'Kolumne',
    'Webcast',
    'Podcast',
    'Marktbericht',
    'Zinskommentar',
    'Gastbeitrag',
    'Fachbeitrag',
    'Gastkommentar',
    'Interview:',
    'Interview mit',
    'Experten-Kommentar',
    'Anleihen-Barometer'
]

FORBIDDEN_GENERIC_NAMES = {
    'anleihe-restrukturierung',
    'restrukturierung',
    'gläubiger',
    'gläubigerversammlung',
    'anleihe',
    'anleihen',
    'dach kapitalmarktemittent',
    'schuldverschreibung',
    'kapitalmarkt'
}

MONTH_MAP = {
    'januar': 1, 'februar': 2, 'märz': 3, 'maerz': 3, 'april': 4,
    'mai': 5, 'juni': 6, 'juli': 7, 'august': 8, 'september': 9,
    'oktober': 10, 'november': 11, 'dezember': 12
}

def extract_explicit_event_date(text):
    """Extract explicit event date if stated in text (e.g. 'am 27. Oktober 2026')."""
    if not text:
        return None
    m = re.search(r'\b(?:am|vom|zum)\s+(\d{1,2})\.\s+([A-Za-zäöüÄÖÜ]+)\s+(202[4-9])\b', text)
    if m:
        day = int(m.group(1))
        m_str = m.group(2).lower()
        year = int(m.group(3))
        month = MONTH_MAP.get(m_str)
        if month and 1 <= day <= 31:
            try:
                return datetime(year, month, day, tzinfo=timezone.utc).strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None

def normalize_company_name(name):
    """Normalizes candidate name and canonical legal form."""
    if not name:
        return ""
    cleaned = name.strip().rstrip(':').rstrip('-')
    cleaned = re.sub(r'^(?:Die|Der|Das)\s+', '', cleaned)
    
    # Well-known issuers normalization
    if cleaned in ("PAUL Tech", "PAUL Tech AG"):
        return "PAUL Tech AG"
    if cleaned in ("Branicks", "Branicks Group", "Branicks Group AG"):
        return "Branicks Group AG"
    if cleaned.startswith("BOOSTER Precision"):
        return "BOOSTER Precision Components GmbH"
    if cleaned == "DEAG":
        return "DEAG Deutsche Entertainment AG"
    if cleaned == "ABO Energy":
        return "ABO Energy GmbH & Co. KGaA"

    return cleaned

def extract_company_name_from_debt_item(title, desc_lead):
    """
    Extracts high-precision company name from debt/bond announcement headline or lead paragraph.
    Handles forms like 'Branicks-Gläubiger...', 'PAUL Tech AG', 'BOOSTER Precision Components', etc.
    """
    # 1. Check lead text for explicit full legal company name
    if desc_lead:
        # e.g. "Die Gläubigerversammlung der PAUL Tech AG hat..."
        m_lead = re.search(r'\b(?:der|die|das|von)\s+([A-ZÄÖÜ][\w\s\.\-&]+?(?:AG|SE|GmbH\s*&\s*Co\.\s*KG|GmbH\s*&\s*Co\.\s*KGaA|GmbH|KGaA|Group|Holding))\b', desc_lead)
        if m_lead:
            cand = m_lead.group(1).strip()
            if 3 < len(cand) < 60 and not cand.startswith(("Gläubiger", "Anleihe", "Bundes", "Vorstand", "Abstimmung")):
                norm = normalize_company_name(cand)
                if norm.lower() not in FORBIDDEN_GENERIC_NAMES:
                    return norm

    # 2. Check title prefixes before hyphen e.g. "PAUL Tech-Gläubiger stimmen..." -> "PAUL Tech AG"
    m_hyphen = re.match(r'^([A-ZÄÖÜ][\w\s\.\-&]+?)-Gläubiger\b', title)
    if m_hyphen:
        base = m_hyphen.group(1).strip()
        norm = normalize_company_name(base)
        if norm.lower() not in FORBIDDEN_GENERIC_NAMES:
            return norm

    # 3. Check title colon prefix: "pferdewetten.de AG: Frank Hartmann wird neuer CFO"
    if ':' in title:
        cand = title.split(':', 1)[0].strip()
        if 3 < len(cand) < 60 and not cand.startswith(("ANLEIHEN", "Fußnote", "Update", "Gastbeitrag")):
            norm = normalize_company_name(cand)
            if norm.lower() not in FORBIDDEN_GENERIC_NAMES:
                return norm

    # 4. Check for known corporate names in title
    m_comp = re.search(r'\b([A-ZÄÖÜ][\w\s\.\-&]+?(?:AG|SE|GmbH\s*&\s*Co\.\s*KG|GmbH\s*&\s*Co\.\s*KGaA|GmbH|KGaA|Group|Holding))\b', title)
    if m_comp:
        cand = m_comp.group(1).strip()
        if 3 < len(cand) < 60:
            norm = normalize_company_name(cand)
            if norm.lower() not in FORBIDDEN_GENERIC_NAMES:
                return norm

    # 5. Fallback heuristics for prominent companies
    if title.startswith("BOOSTER"):
        return "BOOSTER Precision Components GmbH"

    return ""

def fetch_debt_and_bonds_feed(max_items=30):
    """
    Fetches, filters, and parses bondholder restructuring, standstill, and debt signals.
    Returns: (list_of_TriggerEvent, dropped_count)
    """
    events = []
    dropped_count = 0
    seen_urls = set()

    for feed_url in FEED_URLS:
        try:
            req = urllib.request.Request(feed_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read()

            try:
                root = ET.fromstring(content)
                items = root.findall('.//item')
            except Exception:
                continue

            for item in items:
                link_elem = item.find('link')
                title_elem = item.find('title')
                pub_elem = item.find('pubDate')
                desc_elem = item.find('description')

                if link_elem is None or title_elem is None:
                    continue

                source_url = link_elem.text.strip() if link_elem.text else ''
                if not source_url or source_url in seen_urls:
                    continue
                seen_urls.add(source_url)

                raw_title = title_elem.text.strip() if title_elem.text else ''
                title = html.unescape(raw_title)

                # Skip editorial week reviews, columns & guest commentaries
                if any(title.startswith(p) for p in EXCLUDE_PREFIXES):
                    dropped_count += 1
                    continue

                raw_desc = desc_elem.text.strip() if (desc_elem is not None and desc_elem.text) else ''
                desc_clean = ' '.join(re.sub(r'<[^>]+>', ' ', html.unescape(raw_desc)).split())

                # Skip guest commentaries and opinion columns in description
                if desc_clean.startswith(("Gastbeitrag", "Expertenbeitrag", "Kommentar von")):
                    dropped_count += 1
                    continue

                combined_text = f"{title} {desc_clean}".lower()

                # Trigger keywords for financial distress, debt renegotiation & governance
                is_restructuring = any(k in combined_text for k in [
                    'restrukturierung', 'sanierung', 'sanierungskonzept', 'idw s6'
                ])
                is_creditor_vote = any(k in combined_text for k in [
                    'gläubigerversammlung', 'gläubigerabstimmung', 'gläubiger stimmen',
                    'abstimmung ohne versammlung', 'laufzeit-verlängerung', 'laufzeitverlängerung',
                    'anleihebedingungen', 'zinsstundung', 'kuponschnitt'
                ])
                is_standstill = any(k in combined_text for k in [
                    'stillhaltevereinbarung', 'stillhalteabkommen', 'standstill',
                    'covenants', 'financial covenants', 'kreditauflagen'
                ])
                is_c_level_change = any(k in combined_text for k in [
                    'neuer cfo', 'neuer ceo', 'neuer vorstand', 'finanzvorstand',
                    'vorstandsvorsitzender', 'cfo wechsel', 'amtsniederlegung'
                ])
                is_capital_measure = any(k in combined_text for k in [
                    'kapitalherabsetzung', 'kapitalschnitt', 'starug', 'überbrückungskredit'
                ])

                if not (is_restructuring or is_creditor_vote or is_standstill or is_c_level_change or is_capital_measure):
                    dropped_count += 1
                    continue

                # Extract clean company name
                company_name = extract_company_name_from_debt_item(title, desc_clean)
                if not company_name or company_name.lower() in FORBIDDEN_GENERIC_NAMES or len(company_name) < 3:
                    dropped_count += 1
                    continue

                # Parse publication date
                pub_dt = parse_date(pub_elem.text if pub_elem is not None else None)
                if not pub_dt:
                    pub_dt = datetime.now(timezone.utc)
                published_at_iso = pub_dt.isoformat()

                # Extract event date if explicitly mentioned in text
                event_date = extract_explicit_event_date(desc_clean)

                # Determine category
                if is_creditor_vote or is_standstill:
                    category = "finanzierung_anleihen_restrukturierung"
                elif is_c_level_change:
                    category = "c_level_vakanz"
                elif is_restructuring or is_capital_measure:
                    category = "unternehmenskrise_restrukturierung"
                else:
                    category = "finanzierung_anleihen_restrukturierung"

                # 3-Axis Evaluation
                axis_a = "nachgewiesen"

                if is_creditor_vote or is_standstill or is_restructuring:
                    axis_b = "akut"
                    axis_c = "hoch"
                    mandate_rat = (
                        "Kapitalmarkt-Restrukturierung / Gläubigerabstimmung nach SchVG oder Stillhaltevereinbarung. "
                        "Sehr hoher Bedarf an erfahrenem Interim-CFO / Sanierungsberater für Verhandlungen mit Gläubigergruppen und Liquiditätsplanung."
                    )
                elif is_c_level_change:
                    axis_b = "mittel"
                    axis_c = "hoch"
                    mandate_rat = "Organwechsel auf C-Level (Vorstand/CFO) bei kapitalmarktorientiertem Emittenten."
                else:
                    axis_b = "mittel"
                    axis_c = "mittel"
                    mandate_rat = "Kapitalmaßnahme in Sondersituation; Begleitung durch Interims-Finanzexperten plausibel."

                ev = TriggerEvent(
                    company_name=company_name,
                    country="DE",
                    region="DACH",
                    category=category,
                    description=title,
                    event_date=event_date,
                    published_at=published_at_iso,
                    source_url=source_url,
                    source_type="capital_markets_press",
                    evidence_text=desc_clean[:600] if desc_clean else title,
                    provenance_status="real_source_verified",
                    axis_a_event_certainty=axis_a,
                    axis_b_transformation_need=axis_b,
                    axis_c_mandate_potential=axis_c,
                    mandate_rationale=mandate_rat
                )

                events.append(ev)
                if len(events) >= max_items:
                    break

        except Exception:
            continue

    return events, dropped_count
