import json
from collections import defaultdict

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)['events']

url_map = defaultdict(list)
for idx, e in enumerate(events):
    url_map[e.get('source_url', '')].append((idx + 1, e.get('company_name', ''), e.get('category', ''), e.get('event_id', ''), e.get('published_at', '')))

print("=== IDENTICAL SOURCE URLS IN DATASET ===")
dup_count = 0
for url, instances in url_map.items():
    if len(instances) > 1:
        dup_count += (len(instances) - 1)
        print(f"\nURL ({len(instances)} entries): {url}")
        for num, comp, cat, eid, pub in instances:
            print(f"   #{num:02d}: Company: '{comp}' | Cat: {cat} | Published: {pub} | ID: {eid}")

print(f"\nTotal excess duplicate entries: {dup_count}")
