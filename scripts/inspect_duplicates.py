import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
urls = {}
for i, e in enumerate(events):
    u = e.get('source_url', '').rstrip('/')
    urls.setdefault(u, []).append((i, e))

print(f"Total events: {len(events)}")
print(f"Unique URLs: {len(urls)}")

for u, evts in urls.items():
    if len(evts) > 1:
        print("="*80)
        print(f"DUPLICATE URL: {u}")
        for idx, e in evts:
            rc = e.get('reality_check', {})
            print(f"  Index #{idx+1:02d} | ID: {e.get('event_id')}")
            print(f"    Company:     {e.get('company_name')}")
            print(f"    Category:    {e.get('category')}")
            print(f"    Status:      {rc.get('status')} | Target Role: {rc.get('target_role')}")
            print(f"    Priority:    {e.get('mandate_priority')}")
            print(f"    Description: {e.get('description')}")
            print(f"    Published:   {e.get('published_at')} | Event Date: {e.get('event_date')}")
            print(f"    History entries: {len(e.get('history', []))}")
