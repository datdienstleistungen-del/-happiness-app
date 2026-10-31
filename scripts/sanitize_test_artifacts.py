import json

files = ["data/research/continuous_radar_events.json", "public/data/continuous_radar_events.json"]

for fpath in files:
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    cleaned_count = 0
    for ev in data.get("events", []):
        hr = ev.get("reality_check", {}).get("human_review", {})
        if "Automatisierter Audit-Test" in (hr.get("reviewer_notes") or ""):
            ev["reality_check"]["human_review"] = {
                "reviewed": False,
                "reviewed_at": None,
                "reviewer_decision": None,
                "reviewer_notes": "",
                "confirmed": False
            }
            # Clean from history
            ev["reality_check_history"] = [
                h for h in ev.get("reality_check_history", [])
                if "Automatisierter Audit-Test" not in (h.get("reviewer_notes") or "")
            ]
            cleaned_count += 1
            print(f"Cleaned test artifact from: {ev['company_name']} in {fpath}")

    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print("Sanitization complete.")
