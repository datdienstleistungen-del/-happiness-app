import urllib.request
import json
import ssl
import html
import re
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import is_signal_fresh, parse_date
except ImportError:
    from ..date_utils import is_signal_fresh, parse_date

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}

def clean_html(text):
    if not text:
        return ""
    cleaned = re.sub(r'<[^>]+>', ' ', text)
    cleaned = html.unescape(cleaned)
    return ' '.join(cleaned.split())

def extract_swiss_company_from_title(title):
    if not title:
        return "Schweizer Unternehmen"
    # Format e.g. "Mutation Greenbee Sàrl, Genève" or "Mutation ImaOne Helvetica SA, Lancy, neu Genève"
    m = re.search(r'Mutation\s+([^,]+)', title, re.IGNORECASE)
    if m:
        comp = m.group(1).strip()
        if len(comp) > 2:
            return comp
    return "Schweizer Unternehmen"

def check_shab_mutation_relevance(title_text, full_pdf_text=""):
    """
    Evaluates whether a Swiss SHAB HR02 mutation is relevant for Interim Management.
    Returns: (is_relevant: bool, reason: str)
    """
    lower_title = (title_text or "").lower()
    lower_pdf = (full_pdf_text or "").lower()
    combined = f"{lower_title} {lower_pdf}"

    has_hard_insolvency = bool(re.search(r'\b(in liquidation\b|konkurs|konkurseröffnung|nachlassstundung)\b', combined))

    # 1. Check formal correction (Berichtigung)
    if 'berichtigung' in combined and not has_hard_insolvency:
        return False, "ROUTINE_ADMIN_CORRECTION"

    # 2. Check organ role and exit
    has_organ_role = bool(re.search(r'\b(verwaltungsrat|geschäftsführ|direktion|vorstand|präsident des verwaltungsrates|mitglied des verwaltungsrates)\b', combined))
    has_organ_exit = bool(re.search(r'\b(ausgeschiedene personen|erloschene unterschriften|niedergelegt|ausgeschieden|abberufen)\b', combined))

    if not has_organ_exit and not has_hard_insolvency:
        return False, "NO_ORGAN_EXIT"

    # 3. Check 1:1 successor without vacancy
    has_successor = bool(re.search(r'\b(eingetragene personen neu|neu oder mutierend)\b', lower_pdf))
    if has_successor and not has_hard_insolvency:
        return False, "IMMEDIATE_SUCCESSOR_APPOINTED"

    return True, "ORGAN_DEPARTURE_DETECTED"

def fetch_swiss_shab_feed(url=None):
    """
    Fetches and parses live official Swiss SHAB / Handelsregister mutation signals
    directly via the federal official REST API (amtsblattportal.ch / SECO),
    strictly filtering for management/board changes (HR02 Mutationen) within 48h.
    No general search engines or scrapers used.
    Returns: (fresh_items, dropped_age_count)
    """
    if not url:
        url = 'https://amtsblattportal.ch/api/v1/publications?publicationStates=PUBLISHED&subRubrics=HR02&page=0&size=50'

    fresh_items = []
    dropped_age_count = 0
    seen_ids = set()

    ssl_ctx = ssl._create_unverified_context()

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        publications = data.get('content', []) if isinstance(data, dict) else []

        for pub in publications:
            meta = pub.get('meta', {})
            pub_id = meta.get('id')
            if not pub_id or pub_id in seen_ids:
                continue

            pub_date = meta.get('publicationDate') or meta.get('creationDate')
            is_fresh, age_hours, parsed_dt = is_signal_fresh(pub_date, max_hours=48)
            if not is_fresh:
                dropped_age_count += 1
                continue

            seen_ids.add(pub_id)

            titles = meta.get('title', {})
            title_text = titles.get('de') or titles.get('fr') or titles.get('it') or titles.get('en') or 'Mutation Handelsregister'
            company = extract_swiss_company_from_title(title_text)

            pub_link = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/pdf"
            pdf_url = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/pdf"

            snippet_text = f"Offizielle SHAB Handelsregister-Mutation ({meta.get('publicationNumber', pub_id)}): {title_text}"
            has_organ_exit = False
            has_successor = False
            extracted_facts = ""
            full_pdf_text = ""
            dormant_months = 0
            previous_pub_date = None
            is_dormant_shell = False
            has_art_731b = False
            sole_organ_exit = False
            has_remaining_organ = True
            is_purpose_shell = False
            purpose_category = None

            # Fetch full publication PDF content text via official SECO PDF API
            try:
                import io
                import PyPDF2
                detail_req = urllib.request.Request(pdf_url, headers=HEADERS)
                with urllib.request.urlopen(detail_req, context=ssl_ctx, timeout=5) as detail_resp:
                    pdf_bytes = detail_resp.read()
                    reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
                    full_pdf_text = ' '.join(' '.join(page.extract_text().split()) for page in reader.pages)
                    
                    # Prüfe auf Organ-Relevanz: Verwaltungsrat, Geschäftsführer, Vorstand, Direktion
                    lower_pdf = full_pdf_text.lower()
                    has_organ_role = bool(re.search(r'\b(verwaltungsrat|geschäftsführ|direktion|vorstand|präsident des verwaltungsrates|mitglied des verwaltungsrates)\b', lower_pdf))
                    
                    if 'ausgeschiedene personen' in lower_pdf or 'erloschene unterschriften' in lower_pdf:
                        has_organ_exit = True
                    if 'eingetragene personen neu' in lower_pdf or 'neu oder mutierend' in lower_pdf:
                        has_successor = True

                    # 1. Dormant Months Check (Vorherige Publikation > 36 Monate -> Dormant_Shell)
                    prev_pub_match = re.search(
                        r'(?:Vorangehende Publikation im SHAB|Pr[eé]c[eé]dente publication dans la FOSC|Precedente pubblicazione nel FUSC).*?(?:Datum|date|data|vom|du|del)?[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})|\((?:SHAB|FOSC|FUSC)(?:\s+Nr\.?\s*\d+)?\s+(?:vom|du|del)\s+(\d{1,2}\.\d{1,2}\.\d{4})',
                        full_pdf_text,
                        re.IGNORECASE
                    )
                    if prev_pub_match:
                        prev_date_str = prev_pub_match.group(1) or prev_pub_match.group(2)
                        try:
                            prev_dt = datetime.strptime(prev_date_str, '%d.%m.%Y')
                            previous_pub_date = prev_date_str
                            cur_dt = parsed_dt if parsed_dt else datetime.now(timezone.utc)
                            dormant_months = (cur_dt.year - prev_dt.year) * 12 + (cur_dt.month - prev_dt.month)
                            if dormant_months > 18:
                                is_dormant_shell = True
                        except Exception:
                            pass

                    # 2. Total Organ Vacancy Check (Art. 731b OR & sole organ exit)
                    has_art_731b = bool(re.search(r'\b(731b\s*or|731b\s*co|organmangel|mängel in der organisation)\b', lower_pdf))
                    sole_organ_exit = bool(re.search(r'\b(einziges mitglied|seul administrateur|administrateur unique|alleiniges organ|alleiniger geschäftsführer|seul gérant|kein zeichnungsberechtigtes organ|die gesellschaft hat kein organ mehr)\b', lower_pdf))
                    # Check if other board members / management exist
                    has_remaining_organ = bool(re.search(r'\b(präsident des verwaltungsrates|delegierte[rn]? des verwaltungsrates|mitglied des verwaltungsrates|geschäftsführ|direktion|direktor)\b', lower_pdf))
                    if sole_organ_exit:
                        has_remaining_organ = False

                    # 3. Purpose Filter (Private Vermögensverwaltung / Reine Liegenschaften / Domizilhülle)
                    if re.search(r'\b(verwaltung (?:des )?eigenen vermögens|familiengesellschaft|private vermögensanlage|anlage und verwaltung (?:von )?eigenem vermögen|gestion de fortune privée|gestion de son propre patrimoine|amministrazione del proprio patrimonio)\b', lower_pdf):
                        is_purpose_shell = True
                        purpose_category = "Private Vermögensverwaltung"
                    elif re.search(r'\b(halten und verwalten von liegenschaften|erwerb,? (?:halten,? )?verwalten von liegenschaften|erwerb,? belastung,? veräusserung und verwaltung von grundeigentum|erwerb,? halten und verkauf von immobilien|verwaltung von eigenem grundbesitz|reine immobilienholding|achat,? vente et gestion de biens immobiliers)\b', lower_pdf) or re.search(r'\b(immo ag|immobilien ag|immo sa|immobilière sa|real estate ag)\b', company.lower()):
                        is_purpose_shell = True
                        purpose_category = "Reiner Liegenschaftsbesitzer"
                    elif re.search(r'\b(domizilgewährung|gewährung von domizilen|übernahme von domizilmandaten|domicile provider|briefkastengesellschaft|adresse de complaisance|octroi de domicile)\b', lower_pdf):
                        is_purpose_shell = True
                        purpose_category = "Domizilhülle / Briefkastengesellschaft"

                    # FILTER: Dormante Hüllen (>18 Monate Stillstand) oder Zweck-Vehikel sofort verwerfen!
                    if is_dormant_shell or is_purpose_shell or dormant_months > 18:
                        continue

                    # FILTER: Wenn reine Adress-, Statuten- oder Zweckänderung OHNE Organ-Austritt -> SOFORT VERWERFEN!
                    if not has_organ_exit and not has_organ_role:
                        # Reines Rauschen (z.B. Domizilwechsel, Statutenkorrektur) -> drop
                        continue

                    # FILTER BERICHTIGUNG: Reine formale Berichtigungen (z.B. CATNOIR Übersetzungs-Korrekturen) sofort verwerfen!
                    is_berichtigung = 'berichtigung' in title_text.lower() or 'berichtigung' in lower_pdf
                    has_hard_insolvency = ('in liquidation' in lower_pdf or 'konkurs' in lower_pdf or 'nachlassstundung' in lower_pdf)
                    if is_berichtigung and not has_hard_insolvency:
                        continue

                    # Extrahiere den relevanten Abschnitt
                    if 'Ausgeschiedene Personen' in full_pdf_text:
                        idx = full_pdf_text.find('Ausgeschiedene Personen')
                        extracted_facts = full_pdf_text[idx:idx+500]
                    else:
                        extracted_facts = full_pdf_text[120:620]

                    snippet_text = extracted_facts
            except Exception as e:
                # Fallback if PDF fails
                pass

            # Falls kein Organwechsel vorliegt und kein Austritt: verwerfen
            if not has_organ_exit and not ('in liquidation' in snippet_text.lower() or 'konkurs' in snippet_text.lower()):
                continue

            # FILTER BERICHTIGUNG FALLBACK:
            if 'berichtigung' in title_text.lower() and not ('in liquidation' in snippet_text.lower() or 'konkurs' in snippet_text.lower()):
                continue

            # GESCHÄFTSMODELL-FILTER (HARRO MANDATS-ORIGINATION):
            # Wenn ein Nachfolger bereits im selben Beschluss eingetragen ist (1:1 Stabwechsel),
            # liegt KEIN unbesetztes Interim-Vakuum vor -> SOFORT VERWERFEN!
            if has_successor and not ('in liquidation' in snippet_text.lower()):
                continue

            fresh_items.append({
                'source_name': 'Schweizerisches Handelsamtsblatt (SHAB Mutationen)',
                'company': company,
                'title': f"{company}: {title_text}",
                'snippet': snippet_text,
                'url': pub_link,
                'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                'region': 'CH',
                'has_organ_exit': has_organ_exit,
                'has_successor': has_successor,
                'dormant_months': dormant_months,
                'previous_pub_date': previous_pub_date,
                'is_dormant_shell': is_dormant_shell,
                'has_art_731b': has_art_731b,
                'sole_organ_exit': sole_organ_exit,
                'has_remaining_organ': has_remaining_organ,
                'is_purpose_shell': is_purpose_shell,
                'purpose_category': purpose_category,
                'raw_pdf_text': full_pdf_text
            })

    except Exception as e:
        print(f"[Swiss SHAB Ingestion] Notice for {url}: {e}")

    return fresh_items, dropped_age_count
