import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
print(f"Total events: {len(events)}")
print(f"{'Company':<35} | {'Published':<12} | {'Event Date':<12} | {'Captured':<12}")
print("-" * 80)
for e in events:
    comp = e.get('company_name', '')[:35]
    pub = str(e.get('published_at', ''))[:10]
    evt_d = str(e.get('event_date', ''))[:10]
    cap = str(e.get('captured_at', ''))[:10]
    print(f"{comp:<35} | {pub:<12} | {evt_d:<12} | {cap:<12}")
