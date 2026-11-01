import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import MandateRealityCheckEngine

file_path = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_events.json")
public_path = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")

with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

events = data.get("events", [])
print(f"Loaded {len(events)} events.")

cleaned_events = []

for ev_dict in events:
    comp = ev_dict.get("company_name", "")
    desc = ev_dict.get("description", "")
    url = ev_dict.get("source_url", "")

    # 1. Clean Stratec
    if "stratec" in comp.lower() or "stratec" in desc.lower():
        ev_dict["company_name"] = "STRATEC SE"
        ev_dict["category"] = "fusion_uebernahme_unternehmensverkauf"
        ev_dict["description"] = "STRATEC SE: STRATEC VERKAUFT VERLUSTBRINGENDEN GESCHÄFTSBEREICH, NIMMT WERTMINDERUNGEN VOR UND PASST AUSBLICK AN"
        ev_dict["evidence_text"] = "STRATEC SE: STRATEC VERKAUFT VERLUSTBRINGENDEN GESCHÄFTSBEREICH, NIMMT WERTMINDERUNGEN VOR UND PASST AUSBLICK AN"
        ev_dict["country"] = "DE"
        ev_dict["region"] = "DACH"

    # 2. Clean Technology Media And (B2i Digital)
    elif "technology media and" in comp.lower() or "roth technology conference" in desc.lower():
        ev_dict["company_name"] = "B2i Digital, Inc."
        ev_dict["category"] = "corporate_news_auftrag"
        ev_dict["description"] = "B2i Digital, Inc.: Technology, Media and Internet Companies Meet Institutional Investors at the 15th Annual ROTH Technology Conference"
        ev_dict["evidence_text"] = "B2i Digital, Inc.: Technology, Media and Internet Companies Meet Institutional Investors at the 15th Annual ROTH Technology Conference"
        ev_dict["country"] = "US"
        ev_dict["region"] = "Nordamerika"

    # 3. Clean Dexus Finance Pty
    elif "dexus" in comp.lower() or "dexus" in desc.lower():
        ev_dict["company_name"] = "Dexus Finance Pty Limited"
        ev_dict["category"] = "corporate_news_auftrag"
        ev_dict["description"] = "Dexus Finance Pty Limited: 2026 AGM Chair and Group CEO address"
        ev_dict["evidence_text"] = "Dexus Finance Pty Limited: 2026 AGM Chair and Group CEO address"
        ev_dict["country"] = "AU"
        ev_dict["region"] = "Australien"

    # Strip old reality_check to force clean evaluation
    ev_dict.pop("reality_check", None)
    ev_dict.pop("reality_check_history", None)

    ev = TriggerEvent.from_dict(ev_dict)
    d = ev.to_dict()
    cleaned_events.append(d)

data["events"] = cleaned_events
data["version"] = "1.3.1"
data["total_events"] = len(cleaned_events)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

with open(public_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Successfully cleaned and saved {len(cleaned_events)} events.")

# Show status breakdown
status_counts = {}
for e in cleaned_events:
    rc = e.get("reality_check", {})
    st = rc.get("status", "UNKNOWN")
    status_counts[st] = status_counts.get(st, 0) + 1

print("\nUpdated Reality Check Status Breakdown:")
for k, v in sorted(status_counts.items()):
    print(f"  {k}: {v}")

print("\nFocus 9 Cases:")
focus_names = ["Weha", "Branicks", "STRATEC", "Aarau", "Pistiolis", "Stäubli", "B2i Digital", "Dexus", "Knorr-Bremse"]
for e in cleaned_events:
    comp = e.get("company_name", "")
    if any(fn.lower() in comp.lower() for fn in focus_names):
        rc = e.get("reality_check", {})
        print(f"- {comp}: [{rc.get('status')}] Role: {rc.get('target_role')} | Rationale: {rc.get('rationale')[:70]}...")
