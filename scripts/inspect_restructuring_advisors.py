import json
import re

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f).get('events', [])

print(f"Total events: {len(events)}\n")

patterns = [
    r'sanierungsgeschäftsführer(?:\s+bestellt|\s+berufen)?',
    r'sachwalter(?:\s+bestellt)?',
    r'restrukturierungsberater\s+mandatiert',
    r'eigenverwaltung\s+unter\s+führung\s+von',
    r'generalbevollmächtigte[rn]?',
    r'sanierungsexperte\s+.*?\b(?:bestellt|berufen|begleitet)',
    r'(?:kanzlei|sozietät|rechtsanwalt|ra|dr\.)\s+.*?\b(?:als\s+sanierungsgeschäftsführer|sachwalter|generalbevollmächtigter)',
    r'mandatierte\s+(?:kanzlei|beratung)',
    r'begleitet\s+von\s+.*?\b(?:kanzlei|beratung|sanierungsexperten)'
]

for idx, e in enumerate(events, 1):
    text = f"{e.get('company_name')} {e.get('description')} {e.get('evidence_text')} {e.get('mandate_rationale')}".lower()
    matches = []
    for pat in patterns:
        m = re.findall(pat, text, re.IGNORECASE)
        if m:
            matches.extend(m)
    
    if matches:
        rc = e.get('reality_check', {})
        print(f"#{idx:02d} | {e.get('company_name')[:35]:<35} | Status: {rc.get('status')} | Target Role: {rc.get('target_role')}")
        print(f"     Matched: {matches}")
        print(f"     Text snippet: {e.get('evidence_text')[:180]}...")
        print("-" * 75)
