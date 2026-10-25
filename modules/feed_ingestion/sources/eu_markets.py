"""
Pan-European Market Feeds Collector:
- Spain: CNMV & Mercado Continuo
- France: AMF & Euronext Paris
- Pan-European: Euronext / BusinessWire Regulatory Disclosures
Enforces strict 48h freshness check.
"""

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

# Targeted pan-European regulatory endpoints with strict &tbs=qdr:d (past 24h)
EU_FEEDS = [
    {
        "region": "ES",
        "source_label": "CNMV & Mercado Continuo (ES)",
        "default_comp": "Empresa Española",
        "url": "https://news.google.com/rss/search?q=(CNMV+OR+%22Mercado+Continuo%22+OR+%22Bolsas+y+Mercados%22)+AND+(dimision+OR+renuncia+OR+%22cese+de+funciones%22+OR+%22relevo+de+la+direccion%22+OR+%22nombramiento+interino%22+OR+%22consejero+delegado%22+OR+%22director+general%22)+when:2d&hl=es&gl=ES&ceid=ES:es&tbs=qdr:d"
    },
    {
        "region": "FR",
        "source_label": "Euronext Paris & AMF (FR)",
        "default_comp": "Société Française",
        "url": "https://news.google.com/rss/search?q=(Euronext+OR+AMF+OR+%22communiqu%C3%A9%22)+AND+(%22d%C3%A9mission%22+OR+%22d%C3%A9part%22+OR+%22int%C3%A9rim%22+OR+%22directeur+g%C3%A9n%C3%A9ral%22+OR+%22vacance+de+poste%22+OR+%22gouvernance%22)+when:2d&hl=fr&gl=FR&ceid=FR:fr&tbs=qdr:d"
    },
    {
        "region": "EU",
        "source_label": "Pan-European Regulatory (Euronext / BusinessWire)",
        "default_comp": "European Enterprise",
        "url": "https://news.google.com/rss/search?q=(%22Business+Wire%22+OR+%22Euronext%22+OR+%22regulatory+disclosure%22+OR+%22regulatory+news%22)+AND+(%22resignation%22+OR+%22steps+down%22+OR+%22interim+CEO%22+OR+%22interim+CFO%22+OR+%22board+changes%22+OR+%22leadership+transition%22)+when:2d&hl=en-150&gl=DE&ceid=DE:en&tbs=qdr:d"
    }
]

def fetch_eu_markets_feeds(feed_configs=None):
    """
    Fetches pan-European regulatory announcements across Spain, France, and Euronext/BusinessWire.
    Filters out any items older than 48 hours.
    Returns: (fresh_items, dropped_age_count)
    """
    configs = feed_configs if feed_configs is not None else EU_FEEDS
    fresh_items = []
    dropped_age_count = 0
    seen_urls = set()

    for cfg in configs:
        url = cfg["url"]
        region = cfg["region"]
        source_label = cfg["source_label"]
        default_comp = cfg["default_comp"]

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

                # Enforce strict 48h freshness check
                is_fresh, age_hours, parsed_dt = is_signal_fresh(pub_date, max_hours=48)
                if not is_fresh:
                    dropped_age_count += 1
                    continue

                seen_urls.add(link_text)

                company = default_comp
                clean_title = title_text
                source_pub = source_label

                if ' - ' in title_text:
                    parts = title_text.rsplit(' - ', 1)
                    clean_title = parts[0].strip()
                    source_pub = parts[1].strip()

                if ':' in clean_title:
                    prefix = clean_title.split(':', 1)[0].strip()
                    if 2 < len(prefix) < 45 and not prefix.lower().startswith(('communique', 'comunicado', 'aviso')):
                        company = prefix

                fresh_items.append({
                    'source_name': f'{source_label} [{source_pub}]',
                    'company': company,
                    'title': clean_title,
                    'snippet': f"Meldung ({region}): {clean_title}",
                    'url': link_text,
                    'published_at': parsed_dt.isoformat() if parsed_dt else pub_date,
                    'region': region
                })
        except Exception as e:
            print(f"[EU Markets Ingestion] Notice for {source_label}: {e}")

    return fresh_items, dropped_age_count
