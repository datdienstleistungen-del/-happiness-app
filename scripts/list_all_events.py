import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)['events']

for i, e in enumerate(events, 1):
    pub = str(e.get('published_at'))[:10]
    cat = e.get('category')
    comp = e.get('company_name')
    st = e.get('reality_check', {}).get('status')
    role = e.get('reality_check', {}).get('target_role')
    prio = e.get('mandate_priority')
    print(f"#{i:02d} | {comp[:30]:<30} | {pub} | {cat:<32} | {st:<16} | {prio}")
