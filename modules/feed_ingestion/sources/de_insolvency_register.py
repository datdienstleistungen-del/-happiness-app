"""
Official German Insolvency & Restructuring Court Filings Collector
Source: Justizportal der Bundesländer - Insolvenzbekanntmachungen (§ 9 InsO)
URL: https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf

Monitors official court orders:
- Preliminary protective measures / Sicherungsmaßnahmen (SICHMASS)
- Commercial entities (GmbH, AG, SE, GmbH & Co. KG, KGaA)
- Automatically excludes micro-entities (UG haftungsbeschränkt) and private consumer insolvencies.

Zero synthetic data. Only verifiable court filings with official docket numbers.
"""

import os
import re
import ssl
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta

try:
    from modules.feed_ingestion.event_model import TriggerEvent
except ImportError:
    from ..event_model import TriggerEvent

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
}

def clean_company_name(raw_name):
    """Cleans company name extracted from table cell."""
    if not raw_name:
        return ""
    c = raw_name.replace('&amp;', '&')
    c = re.sub(r'<[^>]+>', ' ', c)
    c = ' '.join(c.split())
    # Strip leading/trailing punctuation
    c = c.strip(' ,.:-')
    return c

def is_eligible_commercial_entity(name, register):
    """
    Ensures signal is an operative commercial business and not a private person, micro-UG,
    local micro-gastronomy/retail, or numbered shell company.
    """
    n_lower = name.lower()
    r_lower = register.lower()

    # Reject micro-entities
    if 'ug (haftungsbeschränkt)' in n_lower or 'ug haftungsbeschränkt' in n_lower:
        return False
    # Reject private persons / natural persons
    if any(p in n_lower for p in [', herr', ', frau', 'nachlass', 'eheleute', 'geb.', 'geborene', 'verstorbene']):
        return False

    # Reject numbered shell entities (e.g. "1962A GmbH", "4711 UG")
    if re.match(r'^[0-9]+[a-z]?\s+(gmbh|ug|ag|kg)', n_lower):
        return False

    # Reject micro-gastronomy, local trades, small retail & personal services
    micro_keywords = [
        'gaststätte', 'gaststaette', 'restaurant', 'pizzeria', 'kneipe', 'gasthof',
        'bistro', 'café', 'cafe', 'imbiss', 'döner', 'doener', 'bäckerei', 'baeckerei',
        'konditorei', 'metzgerei', 'fleischerei', 'friseur', 'frisör', 'barbershop',
        'kosmetik', 'nagelstudio', 'solarium', 'kiosk', 'spätkauf', 'spaeti',
        'hotel garni', 'pension ', 'fahrschule', 'reinigung', 'autowäsche', 'autowaesche'
    ]
    if any(k in n_lower for k in micro_keywords):
        return False

    # Must have legal form or official register (HRB / HRA)
    has_legal_form = any(lf in n_lower for lf in ['gmbh', ' ag', 'aktien', 'se', 'kgaa', 'kg', 'mbh'])
    has_hr = 'hrb' in r_lower or 'hra' in r_lower
    return has_legal_form or has_hr

def parse_german_date(date_str):
    """Parses '30.10.2026' into ISO '2026-10-30'."""
    if not date_str:
        return None
    m = re.search(r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b', date_str)
    if m:
        d, m_num, y = m.groups()
        return f"{y}-{int(m_num):02d}-{int(d):02d}"
    return None

def fetch_de_insolvency_register(days_back=3):
    """
    Queries official court announcements from neu.insolvenzbekanntmachungen.de.
    Returns: list of TriggerEvent objects, list of errors
    """
    ssl_ctx = ssl._create_unverified_context()
    events = []
    errors = []

    try:
        cookie_proc = urllib.request.HTTPCookieProcessor()
        opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx), cookie_proc)
        opener.addheaders = [(k, v) for k, v in HEADERS.items()]

        # 1. Initialize session on start page
        opener.open("https://neu.insolvenzbekanntmachungen.de/ap/", timeout=12)
        suche_resp = opener.open("https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf", timeout=12)
        html = suche_resp.read().decode('utf-8', errors='replace')

        view_state_m = re.search(r'name="jakarta\.faces\.ViewState"[^>]+value="([^"]+)"', html)
        if not view_state_m:
            errors.append("Insolvenzbekanntmachungen: ViewState not found on search page.")
            return events, errors
        view_state = view_state_m.group(1)

        # 2. Date window
        today = datetime.now(timezone.utc)
        date_from = today - timedelta(days=days_back)
        datum_von = date_from.strftime("%Y-%m-%d")
        datum_bis = today.strftime("%Y-%m-%d")

        form_data = {
            'frm_suche': 'frm_suche',
            'frm_suche:lsom_bundesland:codelist:scl_bundesland:mysom': 'NO_CODE',
            'frm_suche:lsi_insolvenzgerichte:codelist:scl_insolvenzgericht:mysom': 'NO_CODE',
            'frm_suche:ldi_datumVon:datumHtml5': datum_von,
            'frm_suche:ldi_datumBis:datumHtml5': datum_bis,
            'frm_suche:lsom_wildcard:lsom': '0',
            'frm_suche:litx_firmaNachName:text': '',
            'frm_suche:litx_vorname:text': '',
            'frm_suche:litx_sitzWohnsitz:text': '',
            'frm_suche:iaz_aktenzeichen:som_registerzeichen:mysom': '',
            'frm_suche:iaz_aktenzeichen:itx_abteilung': '',
            'frm_suche:iaz_aktenzeichen:itx_lfdNr': '',
            'frm_suche:iaz_aktenzeichen:itx_jahr': '',
            'frm_suche:iaz_aktenzeichen:ih_aktenzeichen': '',
            'frm_suche:sbc_ohneAbteilung': '',
            'frm_suche:sbc_ohneDeutUnter': '',
            'frm_suche:lsom_gegenstand:codelist:mysom': 'SICHMASS',
            'frm_suche:ir_registereintrag:som_registergericht:mysom': '',
            'frm_suche:ir_registereintrag:som_registerart:mysom': '',
            'frm_suche:ir_registereintrag:itx_registernummer': '',
            'frm_suche:ir_registereintrag:ih_registereintrag': '',
            'frm_suche:cbt_suchen': 'Suchen',
            'jakarta.faces.ViewState': view_state
        }

        encoded_data = urllib.parse.urlencode(form_data).encode('utf-8')
        req = urllib.request.Request("https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf", data=encoded_data, headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf'
        })

        with opener.open(req, timeout=15) as r:
            res_html = r.read().decode('utf-8', errors='replace')

        tables = re.findall(r'<table[^>]*>([\s\S]*?)</table>', res_html)
        if len(tables) < 2:
            return events, errors

        rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', tables[1])
        for row in rows[1:]:
            cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', row)
            if len(cells) < 6:
                continue

            raw_date = re.sub(r'<[^>]+>', ' ', cells[0]).strip()
            aktenzeichen = re.sub(r'<[^>]+>', ' ', cells[1]).strip()
            court = re.sub(r'<[^>]+>', ' ', cells[2]).strip()
            raw_name = cells[3]
            city = re.sub(r'<[^>]+>', ' ', cells[4]).strip()
            register = re.sub(r'<[^>]+>', ' ', cells[5]).strip()

            company = clean_company_name(raw_name)
            if not company or len(company) < 4:
                continue

            if not is_eligible_commercial_entity(company, register):
                continue

            iso_date = parse_german_date(raw_date)
            pub_at = f"{iso_date}T08:00:00+00:00" if iso_date else None

            description = f"Amtsgericht {court}: Sicherungsmaßnahmen im vorläufigen Insolvenzverfahren angeordnet für {company} (Az. {aktenzeichen})"
            evidence = f"Amtsgericht {court}: Im Insolvenzantragsverfahren über das Vermögen der {company} ({city}{', ' + register if register else ''}) wurden vorläufige Sicherungsmaßnahmen angeordnet (Aktenzeichen: {aktenzeichen})."

            ev = TriggerEvent(
                company_name=company,
                country="DE",
                region="Deutschland",
                category="unternehmenskrise_restrukturierung",
                description=description,
                event_date=iso_date,
                published_at=pub_at,
                source_url="https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf",
                source_type="official_court_filing",
                evidence_text=evidence[:600],
                provenance_status="real_source_verified",
                axis_a_event_certainty="nachgewiesen",
                axis_b_transformation_need="akut",
                axis_c_mandate_potential="mittel",
                mandate_rationale="Gerichtlich angeordnete Sicherungsmaßnahmen im vorläufigen Insolvenzverfahren deuten auf akuten Restrukturierungs- und Sanierungsbedarf hin."
            )
            events.append(ev)

    except Exception as e:
        errors.append(f"Insolvenzbekanntmachungen error: {e}")

    return events, errors
