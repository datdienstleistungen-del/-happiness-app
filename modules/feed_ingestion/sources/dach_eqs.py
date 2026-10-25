import urllib.request
import re
import html
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
}

def extract_company_from_eqs_text(text, href=""):
    """Extract clean company name from EQS announcement line or url."""
    cleaned = re.sub(r'^\d{1,2}:\d{2}\s+', '', text)
    cleaned = re.sub(r'^(?:Ad-hoc|Corporate|Non-regulatory)\s+(?:DE|EN)\s+', '', cleaned, flags=re.IGNORECASE)
    
    # Check if there is "Company: Title" structure
    if ':' in cleaned:
        candidate = cleaned.split(':', 1)[0].strip()
        # Remove repeated prefix words
        candidate = re.sub(r'^(?:Ad-hoc|Corporate)\s+(?:DE|EN)\s+', '', candidate, flags=re.IGNORECASE).strip()
        if len(candidate) > 2 and len(candidate) < 60:
            return candidate

    # Fallback to URL slug
    if href:
        m = re.search(r'/news/[^/]+/([^/]+)/', href)
        if m:
            slug = m.group(1)
            # Take the first 2-3 words of slug
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
    """Fetch and parse live corporate & ad-hoc announcements from EQS News."""
    items = []
    seen_urls = set()

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
                
                clean_text = ' '.join(re.sub(r'<[^>]+>', ' ', inner).split())
                clean_text = html.unescape(clean_text)
                
                if len(clean_text) < 12 or href.rstrip('/').endswith('/news'):
                    continue

                seen_urls.add(href)
                company = extract_company_from_eqs_text(clean_text, href)

                # Clean title
                title = clean_text
                if ':' in title:
                    title_part = title.split(':', 1)[1].strip()
                    if len(title_part) > 10:
                        title = f"{company}: {title_part}"

                items.append({
                    'source_name': 'EQS News (DACH)',
                    'company': company,
                    'title': title,
                    'snippet': clean_text,
                    'url': href,
                    'published_at': datetime.utcnow().isoformat() + 'Z',
                    'region': 'DACH'
                })
        except Exception as e:
            print(f"[EQS Ingestion] Notice for {target_url}: {e}")

    return items
