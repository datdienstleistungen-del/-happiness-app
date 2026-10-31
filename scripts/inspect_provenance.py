import json

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

events = data.get('events', [])
print(f"Total events in public: {len(events)}")

specific_cases = [
    "DEAG",
    "pferdewetten",
    "Photon Energy",
    "Knorr-Bremse"
]

print("=== SPECIFIC CASES ===")
for e in events:
    name = e.get('company_name', '')
    if any(k.lower() in name.lower() for k in specific_cases):
        print(json.dumps(e, indent=2, ensure_ascii=False))
        print("="*80)
