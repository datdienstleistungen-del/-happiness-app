import urllib.request
import re
import html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

try:
    from modules.feed_ingestion.date_utils import is_signal_fresh, parse_date
except ImportError:
    from ..date_utils import is_signal_fresh, parse_date

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
}

def extract_company_from_eqs_text(text, href=""):
    """Extract clean company name from EQS announcement line or url."""
    cleaned = re.sub(r'^\d{1,2}:\d{2}\s+', '', text)
    cleaned = re.sub(r'^(?:Ad-hoc|Corporate|Non-regulatory)\s+(?:DE|EN)\s+', '', cleaned, flags=re.IGNORECASE)

    if ':' in cleaned:
        candidate = cleaned.split(':', 1)[0].strip()
        candidate = re.sub(r'^(?:Ad-hoc|Corporate)\s+(?:DE|EN)\s+', '', candidate, flags=re.IGNORECASE).strip()
        if 2 < len(candidate) < 60:
            return candidate

    if href:
        m = re.search(r'/news/[^/]+/([^/]+)/', href)
        if m:
            slug = m.group(1)
            parts = slug.split('-')
            comp_parts = []
            for p in parts:
                if p.lower() in ('ag', 'se', 'gmbh', 'co', 'kgaa', 'holding', 'group', 'plc', 'sa', 'inc'):
                    comp_parts.append(p.upper())
                    break
                comp_parts.append(p.capitalize())
                if len(comp_parts) >= 3:
                    break
            if comp_parts:
                return ' '.join(comp_parts)

    return "DACH Unternehmen"

def fetch_eqs_feed(url='https://www.eqs-news.com/de/rss/'):
    """
    Fetches and parses live corporate & ad-hoc announcements from EQS News
    and targeted DACH Regulatory feeds with strict 48h freshness check.
    Returns: (fresh_items, dropped_age_count)
    """
    fresh_items = []
    dropped_age_count = 0
    seen_urls = set()

    now_utc = datetime.now(timezone.utc)

    # 1. Scrape live EQS News overview
    urls_to_try = [url]
    if url != 'https://www.eqs-news.com/de/':
        urls_to_try.append('https://www.eqs-news.com/de/')

    for target_url in urls_to_try:
        try:
            req = urllib.request.Request(target_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as resp:
                content = resp.read().decode('utf-8', errors='ignore')

            pattern = r'<a[^>]+href="(https://www\.eqs-news\.com/de/news/[^"]+)"[^>]*>([\s\S]*?)</a>'
            for m in re.finditer(pattern, content):
                href, inner = m.group(1), m.group(2)
                if href in seen_urls:
                    continue

                comp_match = re.search(r'class="news__company"[^>]*>([^<]+)<', inner)
                heading_match = re.search(r'class="news__heading"[^>]*>([^<]+)<', inner)
                type_match = re.search(r'class="news__type"[^>]*>([^<]+)<', inner)
                time_match = re.search(r'class="news__time"[^>]*>([^<]+)<', inner)

                clean_text = ' '.join(re.sub(r'<[^>]+>', ' ', inner).split())
                clean_text = html.unescape(clean_text)
                clean_text = re.sub(r'[\ue000-\uf8ff\u200b-\u200f\ufeff]', '', clean_text).strip()

                if len(clean_text) < 12 or href.rstrip('/').endswith('/news'):
                    continue

                seen_urls.add(href)

                if comp_match:
                    company = html.unescape(comp_match.group(1)).strip()
                    company = re.sub(r'[\ue000-\uf8ff\u200b-\u200f\ufeff]', '', company).strip()
                else:
                    company = extract_company_from_eqs_text(clean_text, href)

                if heading_match:
                    heading = html.unescape(heading_match.group(1)).strip()
                    heading = re.sub(r'[\ue000-\uf8ff\u200b-\u200f\ufeff]', '', heading).strip()
                    title = f"{company}: {heading}"
                else:
                    title = clean_text
                    if ':' in title:
                        title_part = title.split(':', 1)[1].strip()
                        if len(title_part) > 10:
                            title = f"{company}: {title_part}"

                # Parse time from time_match or text
                item_dt = now_utc
                if time_match:
                    t_str = time_match.group(1).strip()
                    tm = re.match(r'^(\d{1,2}):(\d{2})\b', t_str)
                    if tm:
                        hh, mm = int(tm.group(1)), int(tm.group(2))
                        item_dt = now_utc.replace(hour=hh, minute=mm, second=0, microsecond=0)
                        if item_dt > now_utc:
                            item_dt = item_dt - timedelta(days=1)
                else:
                    tm = re.match(r'^(\d{1,2}):(\d{2})\b', clean_text)
                    if tm:
                        hh, mm = int(tm.group(1)), int(tm.group(2))
                        item_dt = now_utc.replace(hour=hh, minute=mm, second=0, microsecond=0)
                        if item_dt > now_utc:
                            item_dt = item_dt - timedelta(days=1)

                pub_iso = item_dt.isoformat()
                is_fresh, age_hours, _ = is_signal_fresh(pub_iso, max_hours=48)
                if not is_fresh:
                    dropped_age_count += 1
                    continue

                # DACH Relevance & Country Detection:
                is_german_slug = href.endswith('_de')
                is_dach_legal = bool(re.search(r'\b(?:ag|se|gmbh|kgaa|co\.?\s*kg|holding|stiftung)\b', company, re.I))
                is_dach_title = bool(re.search(r'\b(?:deutschland|österreich|schweiz|bafin|fma|finma|vorstand|geschäftsführung|amtsgericht)\b', title, re.I))

                if not is_german_slug and not is_dach_legal and not is_dach_title:
                    # Non-DACH international wire release -> Skip from DACH radar
                    continue

                fresh_items.append({
                    'source_name': 'EQS News (DACH)',
                    'company': company,
                    'title': title,
                    'snippet': clean_text,
                    'url': href,
                    'published_at': pub_iso,
                    'region': 'DACH'
                })
        except Exception as e:
            print(f"[EQS Ingestion] Notice for {target_url}: {e}")

    return fresh_items, dropped_age_count

