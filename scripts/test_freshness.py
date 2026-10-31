import json
from datetime import datetime, timezone

now = datetime.now(timezone.utc)
events = json.load(open('public/data/continuous_radar_events.json', encoding='utf-8'))['events']

counts = {'HOT': 0, 'MONITORING': 0, 'ARCHIVE': 0}

print(f"{'Company':<32} | {'Published':<10} | {'Days':<5} | {'Category'}")
print("-" * 65)

for e in events:
    pub = e.get('published_at') or e.get('event_date')
    if pub:
        dt = datetime.fromisoformat(pub.replace('Z', '+00:00'))
        days = (now - dt).total_seconds() / 86400.0
    else:
        days = 999.0
    
    if days <= 7:
        cat = 'HOT'
    elif days <= 30:
        cat = 'MONITORING'
    else:
        cat = 'ARCHIVE'
        
    counts[cat] += 1
    print(f"{e.get('company_name', '')[:32]:<32} | {str(pub)[:10]:<10} | {days:5.1f} | {cat}")

print("-" * 65)
print(f"Summary: {counts}")
