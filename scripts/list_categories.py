import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
for i, e in enumerate(events, 1):
    rc = e.get('reality_check', {})
    print(f"#{i:02d} | {e.get('category'):<35} | {rc.get('status'):<16} | {e.get('mandate_priority'):<30} | {e.get('company_name')[:35]}")
