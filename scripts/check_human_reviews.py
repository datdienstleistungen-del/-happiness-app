import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)['events']

reviewed = [e for e in events if e.get('reality_check', {}).get('human_review', {}).get('reviewed')]
print(f"Events with human_review.reviewed == True: {len(reviewed)}")
for r in reviewed:
    hr = r['reality_check']['human_review']
    print(f"  - {r.get('company_name')}: decision={hr.get('reviewer_decision')}, notes={hr.get('reviewer_notes')}, reviewed_at={hr.get('reviewed_at')}")
