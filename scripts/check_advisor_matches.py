import json
import re

with open('public/data/continuous_radar_events.json', 'r', encoding='utf-8') as f:
    events = json.load(f)['events']

advisor_patterns = [
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
    matches = [pat for pat in advisor_patterns if re.search(pat, text, re.IGNORECASE)]
    if matches:
        print(f"Match #{idx:02d}: {e.get('company_name')[:35]} | Current Status: {e.get('reality_check', {}).get('status')}")
        print(f"   Patterns: {matches}")
