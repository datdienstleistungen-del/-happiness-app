import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
print(f"Total events in dataset: {len(events)}")

for i, e in enumerate(events, 1):
    cname = e.get('company_name', '')
    cat = e.get('category', '')
    if cat == 'organ_vakanz' or any(k in cname.lower() for k in ['deag', 'pferdewetten', 'photon']):
        rc = e.get('reality_check', {})
        print("="*60)
        print(f"#{i} Event ID: {e.get('event_id')}")
        print(f"Company: {cname}")
        print(f"Category: {cat}")
        print(f"Description: {e.get('description')}")
        print(f"Status: {rc.get('status')} ({rc.get('status_label')})")
        print(f"Target Role: {rc.get('target_role')}")
        print(f"Priority: {e.get('mandate_priority')}")
        print(f"Action Type: {e.get('action_type')}")
        print(f"Rationale: {rc.get('rationale')}")
        print(f"Facts Proven: {rc.get('facts_proven')}")
        print(f"Counter Indicators: {rc.get('counter_indicators')}")
        print(f"Source URL: {e.get('source_url')}")
