"""
Collector for Verified German Restructuring & Insolvency Disclosures
Sources: Primary public press portals of leading insolvency administration & restructuring firms:
- Anchor Rechtsanwälte (www.anchor.eu)
- Brinkmann & Partner (www.brinkmann-partner.de)
- PLUTA Rechtsanwalts GmbH (www.pluta.net)
- Schultze & Braun (www.schultze-braun.de)
- BBL Brockdorff (www.bbl-law.com)

Zero synthetic data. Only verifiable corporate events with official URLs,
provenance class 'real_source_verified', and extracted facts.
"""

import os
import re
import ssl
import json
import urllib.request
from datetime import datetime, timezone, timedelta

try:
    from modules.feed_ingestion.event_model import TriggerEvent
    from modules.feed_ingestion.date_utils import is_signal_fresh
except ImportError:
    from ..event_model import TriggerEvent
    from ..date_utils import is_signal_fresh

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
}

MONTH_MAP = {
    'januar': '01', 'februar': '02', 'märz': '03', 'maerz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12'
}

def clean_html(text):
    if not text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', text)
    return ' '.join(clean.split())

def parse_german_date(text):
    """Parses '23. Oktober 2026' or '23.10.2026' into ISO YYYY-MM-DD."""
    if not text:
        return None
    m = re.search(r'\b(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})\b', text)
    if m:
        day, month_str, year = m.groups()
        m_num = MONTH_MAP.get(month_str.lower())
        if m_num:
            return f"{year}-{m_num}-{int(day):02d}"
    m_num_date = re.search(r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b', text)
    if m_num_date:
        d, m, y = m_num_date.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
    return None

def clean_extracted_company(c):
    if not c or len(c.strip()) < 4:
        return ""
    # 1. Strip leading law firm or press prefixes
    c = re.sub(r'^(?:PLUTA|BBL|Anchor|Schultze\s*\&\s*Braun|Brinkmann\s*(?:\&\s*Partner)?|GÖRG)[\s\:\-]+', '', c, flags=re.I)
    
    # 2. Strip complex narrative prefixes like "Sanierung von", "Insolvenzverwalter der", "übernimmt Geschäftsbetrieb der"
    c = re.sub(r'^.*?\b(?:übernimmt\s+geschäftsbetrieb\s+der|übertragende\s+sanierung\s+(?:von|der)|sanierungserfolg\s+(?:im\s+verfahren\s+der|für\s+die|für)?|sanierung\s+(?:von|der)|im\s+insolvenzverfahren\s+der|insolvenzverfahren\s+der|geschäftsbetriebe?\s+(?:an\s+die|der)|insolvenz\s+der|vorläufiger\s+insolvenzverwalter\s+(?:der|von)|insolvenzverwalter\s+(?:der|von)|sachwalter\s+(?:der|von))\s+', '', c, flags=re.I)
    
    # 3. Strip sector prefixes
    c = re.sub(r'^(?:Solarunternehmen|Diagnostik-Startup|Startup|Automobilzulieferer|Zulieferer|Hersteller|Betreiber|Krankenhausbetreiber|Klinikbetreiber|Unternehmen|Traditionsunternehmen|Familienunternehmen|Sondermaschinenbauer|Möbelkantenhersteller|LED-Spezialist)\s+', '', c, flags=re.I)

    # 4. Strip articles, prepositions & dates
    c = re.sub(r'^(?:der|die|das|des|dem|den|von|für|bei|an|an\s+die|ein|eine|einer)\s+', '', c, flags=re.I)
    c = re.sub(r'^(?:\d{1,2}\.\s+)?(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}[\.:,]?\s*', '', c, flags=re.I)
    c = re.sub(r'^\d{4}\s+', '', c)
    c = re.sub(r'^(?:der|die|das|des|dem|den|von|für|bei|an|an\s+die|ein|eine|einer)\s+', '', c, flags=re.I)
    c = c.strip(' ,.:-')

    if c.lower() in ['gmbh', 'ag', 'aktiengesellschaft', 'se', 'kgaa', 'gmbh & co. kg', 'ug']:
        return ""
    return c

def extract_legal_company(text):
    """
    Extracts formal legal company name (GmbH, AG, SE, KGaA, GmbH & Co. KG).
    Strips law firm names, prepositions, and journalist noise.
    """
    if not text:
        return ""
    text = text.replace('&amp;', '&')
    pattern = r'\b([A-ZÄÖÜ0-9][\w\.\-\&\(\)\/]+(?:\s+[\w\.\-\&\(\)\/]+){0,5}\s+(?:GmbH\s*\&\s*Co\.\s*KG|GmbH|Aktiengesellschaft|AG|SE|KGaA))\b'
    m = re.search(pattern, text)
    if m:
        c = m.group(1).strip()
        c = clean_extracted_company(c)
        if c and not any(lf in c.lower() for lf in ['pluta', 'schultze & braun', 'bbl brockdorff', 'anchor rechtsanwälte']):
            return c
    return ""

def classify_restructuring_category(text):
    """Categorizes the corporate trigger event."""
    t = text.lower()
    if any(k in t for k in ["eigenverwaltung", "270b inso", "270d inso", "270 inso", "schutzschirm"]):
        return "insolvenzantrag_eigenverwaltung"
    if any(k in t for k in ["vorläufige insolvenz", "insolvenzverfahren eröffnet", "insolvenzantrag", "insolvenzverwalter bestellt"]):
        return "unternehmenskrise_restrukturierung"
    if any(k in t for k in ["werksschließung", "standortschließung", "produktionsverlagerung", "stellenabbau", "stilllegung"]):
        return "werksschliessung_verlagerung"
    if any(k in t for k in ["investorenlösung", "übernimmt geschäftsbetrieb", "verkaufsprozess", "investorenprozess", "m&a", "carve-out"]):
        return "fusion_uebernahme_unternehmensverkauf"
    if any(k in t for k in ["sanierung", "turnaround", "restrukturierungskonzept", "transformation"]):
        return "transformation_sanierung"
    return "unternehmenskrise_restrukturierung"

def evaluate_restructuring_event(title, snippet, url, source_name):
    """Evaluates 3-axis score for a verified restructuring disclosure."""
    combined = f"{title} {snippet}".lower()
    axis_a = "nachgewiesen"
    
    if any(k in combined for k in ["eigenverwaltung", "schutzschirm", "insolvenzverfahren", "akute krise", "sanierung", "investorensuche"]):
        axis_b = "akut"
    elif any(k in combined for k in ["abgeschlossen", "gerettet", "erfolgreich beendet"]):
        axis_b = "mittel"
    else:
        axis_b = "mittel"
        
    if "eigenverwaltung" in combined or "cro" in combined or "sanierungsberater" in combined:
        axis_c = "hoch"
        rationale = "Eigenverwaltungs-/Schutzschirmverfahren erfordern erfahrene Restrukturierungsorgane (CRO / Sanierungs-Geschäftsführer)."
    elif "investorenprozess" in combined or "verkaufsprozess" in combined:
        axis_c = "mittel"
        rationale = "Laufender M&A-/Investorenprozess in Sondersituation bietet Potenzial für PM/M&A-Interim-Unterstützung."
    elif "erfolgreiche sanierung" in combined or "übernimmt geschäftsbetrieb" in combined:
        axis_c = "mittel"
        rationale = "Übernahme durch Erwerber kann Post-Merger-Integration (PMI) Interim-Bedarf auslösen."
    else:
        axis_c = "spekulativ"
        rationale = "Restrukturierungsmeldung vorhanden; Mandatsbedarf hängt von bestehender Beraterbesetzung ab."
        
    return axis_a, axis_b, axis_c, rationale

def fetch_de_restructuring_press(max_age_days=60):
    """
    Scrapes and verifies primary German restructuring disclosures from Top-5 restructuring law firms:
    1. Anchor Rechtsanwälte
    2. Brinkmann & Partner
    3. PLUTA Rechtsanwalts GmbH
    4. Schultze & Braun
    5. BBL Brockdorff
    Returns: list of TriggerEvent objects, list of errors
    """
    ssl_ctx = ssl._create_unverified_context()
    events = []
    errors = []

    # -------------------------------------------------------------
    # Source 1: Anchor Rechtsanwälte
    # -------------------------------------------------------------
    anchor_url = "https://www.anchor.eu/anchor/aktuelles/kategorien/pressemeldungen/"
    try:
        req = urllib.request.Request(anchor_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as r:
            html = r.read().decode('utf-8', errors='replace')
            
        articles = re.findall(r'<article[^>]*>([\s\S]*?)</article>', html)
        for art in articles[:10]:
            link_m = re.search(r'href="([^"]+)"', art)
            title_m = re.search(r'<h[234][^>]*>([\s\S]*?)</h[234]>', art)
            if not link_m or not title_m:
                continue
                
            art_url = link_m.group(1).strip()
            title = clean_html(title_m.group(1))
            
            published_at = None
            snippet = title
            try:
                sub_req = urllib.request.Request(art_url, headers=HEADERS)
                with urllib.request.urlopen(sub_req, context=ssl_ctx, timeout=4) as sub_r:
                    sub_html = sub_r.read().decode('utf-8', errors='replace')
                    
                meta_time = re.search(r'<meta[^>]+property=[\'"]article:published_time[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', sub_html)
                published_at = meta_time.group(1) if meta_time else None
                
                h1_idx = sub_html.find('<h1')
                content_chunk = sub_html[h1_idx:] if h1_idx != -1 else sub_html
                paras = re.findall(r'<p[^>]*>([\s\S]*?)</p>', content_chunk)
                body_paras = []
                for p in paras:
                    c = clean_html(p)
                    if len(c) > 35 and not any(k in c.lower() for k in ['datenschutzerklärung', 'cookie', 'impressum', 'kontakt', 'pressemeldungen ,']):
                        body_paras.append(c)
                snippet = ' '.join(body_paras[:2]) if body_paras else title
            except Exception:
                pass

            company = extract_legal_company(f"{title} {snippet}")
            if not company:
                continue

            event_date = parse_german_date(snippet) or parse_german_date(title)
            category = classify_restructuring_category(f"{title} {snippet}")
            axis_a, axis_b, axis_c, rationale = evaluate_restructuring_event(title, snippet, art_url, "Anchor Rechtsanwälte")
            
            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category=category,
                description=title,
                event_date=event_date,
                published_at=published_at,
                source_url=art_url,
                source_type="law_firm_press",
                evidence_text=snippet[:600],
                provenance_status="real_source_verified",
                axis_a_event_certainty=axis_a,
                axis_b_transformation_need=axis_b,
                axis_c_mandate_potential=axis_c,
                mandate_rationale=rationale
            )
            events.append(ev)
    except Exception as e:
        errors.append(f"Anchor Rechtsanwälte fetch error: {e}")

    # -------------------------------------------------------------
    # Source 2: Brinkmann & Partner
    # -------------------------------------------------------------
    brinkmann_url = "https://www.brinkmann-partner.de/aktuelles/"
    try:
        req = urllib.request.Request(brinkmann_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as r:
            html = r.read().decode('utf-8', errors='replace')
            
        links = re.findall(r'<a[^>]+href="(https://www\.brinkmann-partner\.de/[^"]+)"[^>]*>([\s\S]*?)</a>', html)
        seen_links = set()
        for href, inner in links:
            if href in seen_links or href.rstrip('/') == 'https://www.brinkmann-partner.de':
                continue
            title = clean_html(inner)
            if len(title) < 25 or not any(k in title.lower() for k in ['gmbh', 'ag', 'insolvenz', 'sanierung', 'investor', 'fortführung', 'betrieb']):
                continue
                
            seen_links.add(href)
            company = extract_legal_company(title)
            if not company:
                continue

            category = classify_restructuring_category(title)
            axis_a, axis_b, axis_c, rationale = evaluate_restructuring_event(title, title, href, "Brinkmann & Partner")

            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category=category,
                description=title,
                event_date=None,
                published_at=None,
                source_url=href,
                source_type="law_firm_press",
                evidence_text=title,
                provenance_status="real_source_verified",
                axis_a_event_certainty=axis_a,
                axis_b_transformation_need=axis_b,
                axis_c_mandate_potential=axis_c,
                mandate_rationale=rationale
            )
            events.append(ev)
    except Exception as e:
        errors.append(f"Brinkmann & Partner fetch error: {e}")

    # -------------------------------------------------------------
    # Source 3: PLUTA Rechtsanwalts GmbH
    # -------------------------------------------------------------
    pluta_url = "https://www.pluta.net/presse/pressemitteilungen.html"
    try:
        req = urllib.request.Request(pluta_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as r:
            html = r.read().decode('utf-8', errors='replace')

        items = re.findall(r'<a[^>]+href="(/pressemitteilung/[^"]+)"[^>]*>([\s\S]*?)</a>', html)
        seen_pluta = set()
        for href, inner in items:
            art_url = "https://www.pluta.net" + href
            if art_url in seen_pluta:
                continue
            seen_pluta.add(art_url)
            text = clean_html(inner)
            cleaned_title = re.sub(r'^Pressemitteilung\s+', '', text)
            cleaned_title = re.sub(r'\s+(?:Insolvenz|Transaktionen|Sanierung)\s*$', '', cleaned_title)

            pub_date = parse_german_date(cleaned_title)
            company = extract_legal_company(cleaned_title)
            snippet = cleaned_title

            # If company name not in headline, fetch article detail
            if not company:
                try:
                    sreq = urllib.request.Request(art_url, headers=HEADERS)
                    with urllib.request.urlopen(sreq, context=ssl_ctx, timeout=4) as sr:
                        s_html = sr.read().decode('utf-8', errors='replace')
                    paras = re.findall(r'<p[^>]*>([\s\S]*?)</p>', s_html)
                    p_text = ' '.join([clean_html(p) for p in paras[:3]])
                    c = extract_legal_company(f"{cleaned_title} {p_text}")
                    if c:
                        company = c
                        snippet = p_text[:600]
                except Exception:
                    pass

            if not company:
                continue

            category = classify_restructuring_category(f"{cleaned_title} {snippet}")
            axis_a, axis_b, axis_c, rationale = evaluate_restructuring_event(cleaned_title, snippet, art_url, "PLUTA Rechtsanwälte")

            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category=category,
                description=cleaned_title,
                event_date=pub_date,
                published_at=pub_date,
                source_url=art_url,
                source_type="law_firm_press",
                evidence_text=snippet[:600],
                provenance_status="real_source_verified",
                axis_a_event_certainty=axis_a,
                axis_b_transformation_need=axis_b,
                axis_c_mandate_potential=axis_c,
                mandate_rationale=rationale
            )
            events.append(ev)
    except Exception as e:
        errors.append(f"PLUTA fetch error: {e}")

    # -------------------------------------------------------------
    # Source 4: Schultze & Braun
    # -------------------------------------------------------------
    sb_url = "https://www.schultze-braun.de/newsroom/pressemitteilungen/"
    try:
        req = urllib.request.Request(sb_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as r:
            html = r.read().decode('utf-8', errors='replace')

        cards = re.findall(r'(<div[^>]+class="[^"]*card[^"]*"[\s\S]*?)(?=<div[^>]+class="[^"]*card[^"]*"|\Z)', html)
        seen_sb = set()
        for c in cards:
            href = re.search(r'href="(/news/[^"]+)"', c)
            h2 = re.search(r'<h[234][^>]*>([\s\S]*?)</h[234]>', c)
            if not href or not h2:
                continue

            art_url = "https://www.schultze-braun.de" + href.group(1)
            if art_url in seen_sb:
                continue
            seen_sb.add(art_url)

            title = clean_html(h2.group(1))
            date_m = re.search(r'\b(?:\d{1,2}\.\s+[A-Za-zäöüÄÖÜ]+\s+\d{4}|\d{1,2}\.\d{1,2}\.\d{4})\b', c)
            pub_date = parse_german_date(date_m.group(0)) if date_m else None

            company = extract_legal_company(title)
            snippet = title

            if not company and any(k in title.lower() for k in ['sanierung', 'eigenverwaltung', 'übernahme', 'insolvenz']):
                try:
                    sreq = urllib.request.Request(art_url, headers=HEADERS)
                    with urllib.request.urlopen(sreq, context=ssl_ctx, timeout=4) as sr:
                        s_html = sr.read().decode('utf-8', errors='replace')
                    paras = re.findall(r'<p[^>]*>([\s\S]*?)</p>', s_html)
                    p_text = ' '.join([clean_html(p) for p in paras[:3]])
                    c_cand = extract_legal_company(f"{title} {p_text}")
                    if c_cand:
                        company = c_cand
                        snippet = p_text[:600]
                except Exception:
                    pass

            if not company:
                continue

            category = classify_restructuring_category(f"{title} {snippet}")
            axis_a, axis_b, axis_c, rationale = evaluate_restructuring_event(title, snippet, art_url, "Schultze & Braun")

            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category=category,
                description=title,
                event_date=pub_date,
                published_at=pub_date,
                source_url=art_url,
                source_type="law_firm_press",
                evidence_text=snippet[:600],
                provenance_status="real_source_verified",
                axis_a_event_certainty=axis_a,
                axis_b_transformation_need=axis_b,
                axis_c_mandate_potential=axis_c,
                mandate_rationale=rationale
            )
            events.append(ev)
    except Exception as e:
        errors.append(f"Schultze & Braun fetch error: {e}")

    # -------------------------------------------------------------
    # Source 5: BBL Brockdorff
    # -------------------------------------------------------------
    bbl_url = "https://bbl-law.com/presse/"
    try:
        req = urllib.request.Request(bbl_url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as r:
            html = r.read().decode('utf-8', errors='replace')

        items = re.findall(r'(<div[^>]+class="c-teaser\s+c-teaser--news[\s\S]*?)(?=<div[^>]+class="c-teaser\s+c-teaser--news|\Z)', html)
        seen_bbl = set()
        for it in items:
            href_m = re.search(r'href="([^"]+)"', it)
            headline_m = re.search(r'class="c-teaser__headline">([\s\S]*?)</span>', it)
            if not href_m or not headline_m:
                continue

            art_url = href_m.group(1).strip()
            if art_url in seen_bbl:
                continue
            seen_bbl.add(art_url)

            title = clean_html(headline_m.group(1))
            date_m = re.search(r'\b(\d{1,2}\.\d{1,2}\.\d{4})\b', it)
            pub_date = parse_german_date(date_m.group(1)) if date_m else None

            company = extract_legal_company(title)
            snippet = title

            if not company and any(k in title.lower() for k in ['sanierung', 'eigenverwaltung', 'insolvenz', 'm&a', 'geschäftsbetrieb']):
                try:
                    sreq = urllib.request.Request(art_url, headers=HEADERS)
                    with urllib.request.urlopen(sreq, context=ssl_ctx, timeout=4) as sr:
                        s_html = sr.read().decode('utf-8', errors='replace')
                    paras = re.findall(r'<p[^>]*>([\s\S]*?)</p>', s_html)
                    p_text = ' '.join([clean_html(p) for p in paras[:3]])
                    c_cand = extract_legal_company(f"{title} {p_text}")
                    if c_cand:
                        company = c_cand
                        snippet = p_text[:600]
                except Exception:
                    pass

            if not company:
                continue

            category = classify_restructuring_category(f"{title} {snippet}")
            axis_a, axis_b, axis_c, rationale = evaluate_restructuring_event(title, snippet, art_url, "BBL Brockdorff")

            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category=category,
                description=title,
                event_date=pub_date,
                published_at=pub_date,
                source_url=art_url,
                source_type="law_firm_press",
                evidence_text=snippet[:600],
                provenance_status="real_source_verified",
                axis_a_event_certainty=axis_a,
                axis_b_transformation_need=axis_b,
                axis_c_mandate_potential=axis_c,
                mandate_rationale=rationale
            )
            events.append(ev)
    except Exception as e:
        errors.append(f"BBL Brockdorff fetch error: {e}")

    return events, errors
