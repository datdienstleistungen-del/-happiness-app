"""
Pan-European Official Regulatory Feeds Collector:
- Spain: CNMV (Información Privilegiada, Otra Información Relevante, Notas de Prensa)
- France / BeNeLux: AMF France & Euronext Regulatory
Direct structured XML/RSS without general search engines or aggregators.
Enforces strict 48h freshness check.
"""

import urllib.request
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
    'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
}

OFFICIAL_EU_FEEDS = [
    {
        "region": "ES",
        "source_label": "CNMV Otra Información Relevante (ES)",
        "default_comp": "Empresa Española",
        "url": "https://www.cnmv.es/portal/Otra-Informacion-Relevante/RSS.asmx/GetNoticiasCNMV"
    },
    {
        "region": "ES",
        "source_label": "CNMV Información Privilegiada (ES)",
        "default_comp": "Empresa Española",
        "url": "https://www.cnmv.es/portal/informacion-privilegiada/RSS.asmx/GetNoticiasCNMV"
    },
    {
        "region": "ES",
        "source_label": "CNMV Notas de Prensa (ES)",
        "default_comp": "Empresa Española",
        "url": "https://www.cnmv.es/portal/RSS/RSS.asmx/GetDatos?iID=1"
    },
    {
        "region": "EU",
        "source_label": "Euronext / AFM Regulatory Disclosures",
        "default_comp": "European Enterprise",
        "url": "https://www.afm.nl/en/rss"
    }
]

def parse_rss_items_robust(xml_text):
    """Parses XML/RSS items using regex to prevent parser failure on unescaped entities."""
    items = []
    # Match <item> or <Item>
    item_matches = re.findall(r'<item(?:\s+[^>]*)?>([\s\S]*?)</item>', xml_text, re.IGNORECASE)
    for block in item_matches:
        t_m = re.search(r'<title(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</title>', block, re.I)
        l_m = re.search(r'<link(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</link>', block, re.I)
        d_m = re.search(r'<pubDate(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</pubDate>', block, re.I)
        desc_m = re.search(r'<description(?:\s+[^>]*)?>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?</description>', block, re.I)

        title = html.unescape(t_m.group(1).strip()) if t_m else ''
        link = html.unescape(l_m.group(1).strip()) if l_m else ''
        date = html.unescape(d_m.group(1).strip()) if d_m else ''
        desc = html.unescape(desc_m.group(1).strip()) if desc_m else ''

        # Strip remaining HTML tags in description
        desc_clean = re.sub(r'<[^>]+>', ' ', desc).strip()

        if title and (link or desc_clean):
            items.append({
                'title': title,
                'link': link,
                'pubDate': date,
                'description': desc_clean
            })
    return items

def extract_company_from_eu_title(title, default_comp):
    if not title:
        return default_comp
    cleaned = title.strip()
    if ':' in cleaned:
        candidate = cleaned.split(':', 1)[0].strip()
        if 2 < len(candidate) < 60:
            return candidate
    if ' - ' in cleaned:
        candidate = cleaned.split(' - ', 1)[0].strip()
        if 2 < len(candidate) < 60:
            return candidate
    # For CNMV, title is often the exact company name e.g. "PESCANOVA, S.A."
    if any(form in cleaned.upper() for form in ['S.A.', 'SA', 'S.L.', 'SL', 'N.V.', 'NV', 'B.V.', 'BV', 'SPA', 'S.P.A.']):
        return cleaned
    return default_comp

def fetch_eu_markets_feeds(feed_configs=None):
    """
    Fetches pan-European regulatory announcements directly from official feeds
    (CNMV España, AFM / Euronext Regulatory) without third-party search engines.
    Filters out any items older than 48 hours.
    Returns: (fresh_items, dropped_age_count)
    """
    configs = feed_configs if feed_configs is not None else OFFICIAL_EU_FEEDS
    fresh_items = []
    dropped_age_count = 0
    seen_urls = set()

    ssl_ctx = ssl._create_unverified_context()

    for cfg in configs:
        url = cfg["url"]
        region = cfg["region"]
        source_label = cfg["source_label"]
        default_comp = cfg["default_comp"]

        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=12) as resp:
                content = resp.read().decode('utf-8', errors='ignore')

            items = parse_rss_items_robust(content)

            for it in items:
                title_text = it['title']
                link_text = it['link']
                pub_date = it['pubDate']
                snippet_text = it['description']

                if not title_text or link_text in seen_urls:
                    continue

                # Enforce strict 48h freshness check
                is_fresh, age_hours, parsed_dt = is_signal_fresh(pub_date, max_hours=48)
                if not is_fresh:
                    dropped_age_count += 1
                    continue

                seen_urls.add(link_text)

                company = extract_company_from_eu_title(title_text, default_comp)
                full_title = title_text
                if company != default_comp and not title_text.startswith(company):
                    full_title = f"{company}: {title_text}"

                fresh_items.append({
                    'source_name': source_label,
                    'company': company,
                    'title': full_title,
                    'snippet': snippet_text or f"Mitteilung der Aufsichtsbehörde ({source_label}): {full_title}",
                    'url': link_text,
                    'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                    'region': region
                })

        except Exception as e:
            print(f"[EU Markets Ingestion] Notice for {source_label} ({url}): {e}")

    return fresh_items, dropped_age_count
