import json

with open('data/research/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
print(f"Total events: {len(events)}")
for i, e in enumerate(events, 1):
    rc = e.get('reality_check', {})
    print(f"#{i:02d} | {e.get('company_name')[:35]:<35} | {rc.get('status'):<16} | {rc.get('target_role'):<12} | {e.get('mandate_priority'):<28} | {e.get('source_url')}")
