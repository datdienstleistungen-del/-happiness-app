import json
import os
import sys
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import MandateRealityCheckEngine
RESEARCH_FILE = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_events.json")
PUBLIC_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")

with open(RESEARCH_FILE, "r", encoding="utf-8") as f:
    raw_data = json.load(f)

events = raw_data.get("events", [])
print(f"Total events to process: {len(events)}")

updated_events = []
freshness_counts = {"HOT_FIRST_MOVER": 0, "MONITORING": 0, "ARCHIVE": 0}
status_counts = {}

for edata in events:
    # Preserve any existing human_review
    prev_rc = edata.get("reality_check")
    
    # Re-evaluate reality check
    new_rc = MandateRealityCheckEngine.evaluate(edata, previous_check=prev_rc)
    edata["reality_check"] = new_rc
    
    # Instantiate TriggerEvent to ensure priority and fields are properly calculated
    te = TriggerEvent.from_dict(edata)
    
    # Calculate priority based on new reality check
    calc_pri, calc_act = te.determine_mandate_priority()
    te.mandate_priority = calc_pri
    te.action_type = calc_act
    from modules.feed_ingestion.event_model import MANDATE_PRIORITY_LABELS
    te.mandate_priority_label = MANDATE_PRIORITY_LABELS.get(calc_pri, "Watchlist / General Distress")
    
    out_dict = te.to_dict()
    updated_events.append(out_dict)
    
    cat = out_dict.get("freshness_category")
    freshness_counts[cat] = freshness_counts.get(cat, 0) + 1
    
    st = new_rc.get("status")
    status_counts[st] = status_counts.get(st, 0) + 1

raw_data["events"] = updated_events
raw_data["last_updated"] = datetime.now(timezone.utc).isoformat()

with open(RESEARCH_FILE, "w", encoding="utf-8") as f:
    json.dump(raw_data, f, indent=2, ensure_ascii=False)

with open(PUBLIC_FILE, "w", encoding="utf-8") as f:
    json.dump(raw_data, f, indent=2, ensure_ascii=False)

print(f"Successfully updated {len(updated_events)} events.")
print(f"Freshness distribution: {freshness_counts}")
print(f"Status distribution: {status_counts}")

print("\n--- Key cases check ---")
for e in updated_events:
    name = e["company_name"]
    if any(k in name for k in ["ABO Energy", "Wohnstift", "DEAG", "pferdewetten", "Photon", "PAUL Tech", "Weha"]):
        rc = e["reality_check"]
        print(f"{name[:28]:<28} | pub: {str(e.get('published_at'))[:10]} | fresh: {e.get('freshness_category'):<16} | st: {rc.get('status'):<16} | prio: {e.get('mandate_priority'):<28} | role: {rc.get('target_role')}")
        if rc.get("counter_indicators"):
            print(f"   CI: {rc['counter_indicators'][0]}")
