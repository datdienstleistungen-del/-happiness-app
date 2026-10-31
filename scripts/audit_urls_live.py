import json
import urllib.request
import ssl

ctx = ssl._create_unverified_context()
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f).get('events', [])

print(f"Auditing {len(events)} events...\n")

results = []

for idx, e in enumerate(events):
    url = e.get('source_url', '')
    comp = e.get('company_name', '')
    title = e.get('description', '')
    cat = e.get('category', '')
    st = e.get('source_type', '')
    captured = e.get('captured_at', '')
    pub = e.get('published_at', '')
    prov = e.get('provenance_status', '')
    rc = e.get('reality_check', {})
    rc_status = rc.get('status', '')
    rc_role = rc.get('target_role', '')

    # Probe URL
    http_status = None
    http_bytes = 0
    http_error = None
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=8) as resp:
            http_status = resp.status
            data = resp.read()
            http_bytes = len(data)
    except Exception as ex:
        http_error = str(ex)

    item_report = {
        'index': idx + 1,
        'company': comp,
        'title': title,
        'category': cat,
        'source_type': st,
        'source_url': url,
        'published_at': pub,
        'captured_at': captured,
        'provenance_status': prov,
        'reality_status': rc_status,
        'target_role': rc_role,
        'http_status': http_status,
        'http_bytes': http_bytes,
        'http_error': http_error
    }
    results.append(item_report)
    print(f"#{idx+1:02d} {comp[:35]:<35} | HTTP {http_status or 'ERR'} | {url[:60]}")

with open('data/research/radar_provenance_audit_raw.json', 'w', encoding='utf-8') as out:
    json.dump(results, out, indent=2, ensure_ascii=False)

print("\nAudit finished. Saved to data/research/radar_provenance_audit_raw.json")
