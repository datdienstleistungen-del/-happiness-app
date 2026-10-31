import json
from datetime import datetime, timezone

events = json.load(open('public/data/continuous_radar_events.json', encoding='utf-8'))['events']
now = datetime.now(timezone.utc)

RADAR_CATEGORY_MAP = {
  'organ_vakanz': ['c_level_vakanz', 'c_level_vakanz_ch', 'organ_vakanz'],
  'restrukturierung_cro': ['unternehmenskrise_restrukturierung', 'insolvenzantrag_eigenverwaltung', 'transformation_sanierung', 'restrukturierung_cro'],
  'not_governance_ar': ['not_governance_ar', 'unternehmenskrise_restrukturierung'],
  'm_and_a_board': ['fusion_uebernahme_unternehmensverkauf', 'm_and_a_board'],
  'carveout_pe': ['carveout_pe', 'fusion_uebernahme_unternehmensverkauf'],
  'finanz_sondersituation': ['finanzierung_anleihen_restrukturierung', 'finanz_sondersituation']
}

print("=== 8 HOT EVENTS (< 7 DAYS) ===")
for e in events:
    pub = e.get('published_at') or e.get('event_date')
    dt = datetime.fromisoformat(pub.replace('Z', '+00:00'))
    days = (now - dt).total_seconds() / 86400.0
    if days <= 7:
        cat = e.get('category')
        matching_tiles = [tile for tile, cats in RADAR_CATEGORY_MAP.items() if cat in cats]
        print(f"- {e.get('company_name')[:32]:<32} | {cat:<32} | Tiles: {matching_tiles}")
