import json
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import MandateRealityCheckEngine

file_path = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_events.json")
public_path = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

events = []
status_counts = {}
role_counts = {}

for ev_dict in data.get("events", []):
    # Strip any old reality_check to force clean evaluation
    ev_dict.pop("reality_check", None)
    ev_dict.pop("reality_check_history", None)
    ev = TriggerEvent.from_dict(ev_dict)
    d = ev.to_dict()
    events.append(d)
    
    st = d["reality_check"]["status"]
    status_counts[st] = status_counts.get(st, 0) + 1
    role = d["reality_check"]["target_role"]
    role_counts[role] = role_counts.get(role, 0) + 1

data["events"] = events
data["version"] = "1.3.0"

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

with open(public_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Total events processed: {len(events)}")
print("\nStatus Distribution:")
for s, count in sorted(status_counts.items()):
    print(f"  {s}: {count}")

print("\nTarget Role Distribution:")
for r, count in sorted(role_counts.items()):
    print(f"  {r}: {count}")

print("\nSample Details:")
for ev in events:
    rc = ev["reality_check"]
    print(f"- {ev['company_name']}: [{rc['status']}] Role: {rc['target_role']} | Rationale: {rc['rationale'][:80]}...")
