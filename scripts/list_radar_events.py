import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('data/research/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
print(f"Total Events: {len(events)}")
for i, ev in enumerate(events):
    print(f"{i+1:2d}. {ev['company_name']:35s} | {ev['category']:35s} | {ev['axis_a_event_certainty']:12s} / {ev['axis_c_mandate_potential']:10s} | {ev['source_url']}")
