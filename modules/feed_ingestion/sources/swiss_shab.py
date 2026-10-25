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

            content_url = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/content"
            pub_link = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/content"

            snippet_text = f"Offizielle SHAB Handelsregister-Mutation ({meta.get('publicationNumber', pub_id)}): {title_text}"

            # Optionally fetch full publication content text if available quickly
            try:
                detail_req = urllib.request.Request(content_url, headers=HEADERS)
                with urllib.request.urlopen(detail_req, context=ssl_ctx, timeout=4) as detail_resp:
                    html_content = detail_resp.read().decode('utf-8', errors='ignore')
                    plain_content = clean_html(html_content)
                    if len(plain_content) > 30:
                        snippet_text = plain_content[:800]
            except Exception:
                pass

            fresh_items.append({
                'source_name': 'Schweizerisches Handelsamtsblatt (SHAB Mutationen)',
                'company': company,
                'title': f"{company}: {title_text}",
                'snippet': snippet_text,
                'url': pub_link,
                'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                'region': 'CH'
            })

    except Exception as e:
        print(f"[Swiss SHAB Ingestion] Notice for {url}: {e}")

    return fresh_items, dropped_age_count
