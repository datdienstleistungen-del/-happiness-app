import urllib.request
import xml.etree.ElementTree as ET
import html
import re
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import is_signal_fresh, parse_date
except ImportError:
    from ..date_utils import is_signal_fresh, parse_date

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
}

def fetch_swiss_shab_feed(url=None):
    """
    Fetches and parses live Swiss SHAB / Handelsregister mutation signals,
    focused strictly on management/board changes with a 48h freshness gate.
    Returns: (fresh_items, dropped_age_count)
    """
    if not url:
        url = 'https://news.google.com/rss/search?q=(%22Handelsregister%22+OR+%22SHAB%22+OR+%22Mutationen%22)+AND+(%22Amtsniederlegung%22+OR+%22R%C3%BCcktritt%22+OR+%22Vorstand%22+OR+%22Gesch%C3%A4ftsf%C3%BChrer%22+OR+%22Verwaltungsrat%22+OR+%22Ausscheiden%22+OR+%22Interim%22)+when:2d&hl=de-CH&gl=CH&ceid=CH:de&tbs=qdr:d'

    fresh_items = []
    dropped_age_count = 0
    seen_urls = set()

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read()

        root = ET.fromstring(content)
        for it in root.findall('.//item'):
            t = it.find('title')
            l = it.find('link')
            d = it.find('pubDate')

            title_text = html.unescape(t.text if t is not None and t.text else '')
            link_text = l.text if l is not None and l.text else ''
            pub_date = d.text if d is not None and d.text else None

            if not title_text or link_text in seen_urls:
                continue

            # Hard 48h freshness check
            is_fresh, age_hours, parsed_dt = is_signal_fresh(pub_date, max_hours=48)
            if not is_fresh:
                dropped_age_count += 1
                continue

            seen_urls.add(link_text)

            company = "Schweizer Unternehmen"
            clean_title = title_text
            if ' - ' in title_text:
                parts = title_text.rsplit(' - ', 1)
                clean_title = parts[0].strip()
                source_pub = parts[1].strip()
            else:
                source_pub = "SHAB / CH News"

            quote_match = re.search(r'["\']([^"\']+(?:AG|GmbH|SA|Sàrl|Holding|Genossenschaft))["\']', clean_title, re.IGNORECASE)
            if quote_match:
                company = quote_match.group(1).strip()
            elif ':' in clean_title:
                prefix = clean_title.split(':', 1)[0].strip()
                if len(prefix) < 40 and not prefix.lower().startswith('handelsregister'):
                    company = prefix

            fresh_items.append({
                'source_name': f'SHAB Mutationen & Leadership (CH) [{source_pub}]',
                'company': company,
                'title': clean_title,
                'snippet': f"Meldung Handelsregister / SHAB Schweiz: {clean_title}",
                'url': link_text,
                'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                'region': 'CH'
            })
    except Exception as e:
        print(f"[Swiss SHAB Ingestion] Notice for {url}: {e}")

    return fresh_items, dropped_age_count
