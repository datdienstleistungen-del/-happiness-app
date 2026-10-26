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

                    # FILTER: Wenn reine Adress-, Statuten- oder Zweckänderung OHNE Organ-Austritt -> SOFORT VERWERFEN!
                    if not has_organ_exit and not has_organ_role:
                        # Reines Rauschen (z.B. Domizilwechsel, Statutenkorrektur) -> drop
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

            fresh_items.append({
                'source_name': 'Schweizerisches Handelsamtsblatt (SHAB Mutationen)',
                'company': company,
                'title': f"{company}: {title_text}",
                'snippet': snippet_text,
                'url': pub_link,
                'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                'region': 'CH',
                'has_organ_exit': has_organ_exit,
                'has_successor': has_successor
            })

    except Exception as e:
        print(f"[Swiss SHAB Ingestion] Notice for {url}: {e}")

    return fresh_items, dropped_age_count
