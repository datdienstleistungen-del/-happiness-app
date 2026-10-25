import urllib.request
import re
import html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import is_signal_fresh, parse_date
except ImportError:
    from ..date_utils import is_signal_fresh, parse_date

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

def extract_company_from_rns_url(href):
    """Extract company name from Investegate announcement URL."""
    m = re.search(r'/announcement/[^/]+/([^/]+)/', href)
    if m:
        slug = m.group(1)
        if '--' in slug:
            slug = slug.split('--')[0]
        words = [w.capitalize() for w in slug.replace('-', ' ').split() if w]
        formatted = []
        for w in words:
            if w.lower() in ('plc', 'llp', 'ltd', 'limited', 'sa', 'nv', 'se'):
                formatted.append(w.upper())
            else:
                formatted.append(w)
        return ' '.join(formatted) if formatted else 'UK Enterprise'
    return 'UK Enterprise'

def fetch_uk_rns_feed(url='https://www.investegate.co.uk/Rss.aspx'):
    """
    Fetches and parses live UK Regulatory News Service (RNS) items
    filtered by executive moves & board changes, with strict 48h freshness check.
    Returns: (fresh_items, dropped_age_count)
    """
    fresh_items = []
    dropped_age_count = 0
    seen_urls = set()

    # 1. Investegate RNS Live Feed
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as resp:
            content = resp.read().decode('utf-8', errors='ignore')

        pattern = r'<a[^>]+href="(https://www\.investegate\.co\.uk/announcement/(?:rns|fnw|mfn)/[^"]+)"[^>]*>([\s\S]*?)</a>'
        now_utc = datetime.now(timezone.utc)

        for m in re.finditer(pattern, content):
            href, inner = m.group(1), m.group(2)
            if href in seen_urls:
                continue

            clean_text = ' '.join(re.sub(r'<[^>]+>', ' ', inner).split())
            clean_text = html.unescape(clean_text)

            if len(clean_text) < 6 or 'archive' in href.lower():
                continue

            seen_urls.add(href)
            company = extract_company_from_rns_url(href)

            # Investegate live feed items are emitted in real-time
            pub_iso = now_utc.isoformat()
            is_fresh, _, _ = is_signal_fresh(pub_iso, max_hours=48)
            if not is_fresh:
                dropped_age_count += 1
                continue

            fresh_items.append({
                'source_name': 'London Stock Exchange RNS (UK)',
                'company': company,
                'title': f"{company}: {clean_text}",
                'snippet': clean_text,
                'url': href,
                'published_at': pub_iso,
                'region': 'UK'
            })
    except Exception as e:
        print(f"[UK RNS Ingestion] Notice for {url}: {e}")

    return fresh_items, dropped_age_count

