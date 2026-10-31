import json
import os

path1 = "data/research/continuous_radar_events.json"
path2 = "public/data/continuous_radar_events.json"

for p in [path1, path2]:
    print(f"=== CHECKING {p} ===")
    if not os.path.exists(p):
        print(f"File {p} does not exist!")
        continue
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    found = False
    for ev in data.get("events", []):
        hr = ev.get("reality_check", {}).get("human_review", {})
        if hr.get("reviewed") or hr.get("confirmed") or hr.get("reviewer_notes"):
            found = True
            print(f"Event: {ev['company_name']} (ID: {ev.get('event_id')})")
            print(f"  Human Review: {hr}")
            print(f"  Reality Check History: {ev.get('reality_check_history')}")
    if not found:
        print("No human review entries found.")
