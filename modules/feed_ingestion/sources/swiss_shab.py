import urllib.request
import xml.etree.ElementTree as ET
import html
import re
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
}

def fetch_swiss_shab_feed(url=None):
    """Fetch and parse live Swiss SHAB / Handelsregister mutation signals."""
    if not url:
        url = 'https://news.google.com/rss/search?q=%22Handelsregister%22+OR+SHAB+OR+%22Mutationen%22+OR+%22Konkurs%22&hl=de-CH&gl=CH&ceid=CH:de'
        
    items = []
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
            pub_date = d.text if d is not None and d.text else datetime.utcnow().isoformat() + 'Z'

            if not title_text:
                continue

            # In Google News RSS, titles typically end with "- Publisher"
            company = "Schweizer Unternehmen"
            clean_title = title_text
            if ' - ' in title_text:
                parts = title_text.rsplit(' - ', 1)
                clean_title = parts[0].strip()
                source_pub = parts[1].strip()
            else:
                source_pub = "SHAB / CH News"

            # Check if company name is mentioned at start e.g. "UBS AG: ..." or in quotes
            quote_match = re.search(r'["\']([^"\']+(?:AG|GmbH|SA|Sàrl|Holding|Genossenschaft))["\']', clean_title, re.IGNORECASE)
            if quote_match:
                company = quote_match.group(1).strip()
            elif ':' in clean_title:
                prefix = clean_title.split(':', 1)[0].strip()
                if len(prefix) < 40 and not prefix.lower().startswith('handelsregister'):
                    company = prefix

            items.append({
                'source_name': f'SHAB Mutationen & Corporate (CH) [{source_pub}]',
                'company': company,
                'title': clean_title,
                'snippet': f"Meldung Handelsregister / SHAB Schweiz: {clean_title}",
                'url': link_text,
                'published_at': pub_date,
                'region': 'CH'
            })
    except Exception as e:
        print(f"[Swiss SHAB Ingestion] Notice for {url}: {e}")

    return items
