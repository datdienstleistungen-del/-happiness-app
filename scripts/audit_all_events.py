import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])

for idx in range(5):
    e = events[idx]
    print(f"#{idx+1:02d} | Company: {e.get('company_name')} | Country: {e.get('country')}")
    print(f"     Title:           {e.get('description')}")
    print(f"     Source URL:      {e.get('source_url')}")
    print(f"     Source Type:     {e.get('source_type')}")
    print(f"     Published:       {e.get('published_at')}")
    print(f"     Captured:        {e.get('captured_at')}")
    print(f"     Provenance:      {e.get('provenance_status')}")
    print(f"     Reality Check:   {e.get('reality_check', {}).get('status')} ({e.get('reality_check', {}).get('target_role')})")
    print("-" * 80)
