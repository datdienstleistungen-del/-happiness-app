import os
import sys
import re
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from modules.feed_ingestion.reality_check import MandateRealityCheckEngine, REALITY_CHECK_LABELS
from modules.feed_ingestion.event_model import TriggerEvent

RESEARCH_FILE = "data/research/continuous_radar_events.json"
PUBLIC_FILE = "public/data/continuous_radar_events.json"
AUDIT_LOG_FILE = "reports/radar_cleanup_audit_20261027.json"

def clean_company_name(name: str) -> str:
    """Strips date prefixes, articles, and industry descriptors from company names."""
    if not name:
        return ""
    c = name.strip()
    # 1. Strip leading date expressions (e.g. "August 2026. ", "12. Oktober 2026: ")
    c = re.sub(r'^(?:\d{1,2}\.\s+)?(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}[\.:,]?\s*', '', c, flags=re.I)
    # 2. Strip leading German articles
    c = re.sub(r'^(?:der|die|das|des|dem|den|ein|eine|einer|eines|einem|einen)\s+', '', c, flags=re.I)
    # 3. Strip leading sector/type descriptors
    c = re.sub(r'^(?:Solarunternehmen|Diagnostik-Startup|Startup|Automobilzulieferer|Zulieferer|Hersteller|Betreiber|Krankenhausbetreiber|Klinikbetreiber|Unternehmen|Traditionsunternehmen|Familienunternehmen)\s+', '', c, flags=re.I)
    # 4. Strip again in case of "Dem Diagnostik-Startup Noscendo" -> "Diagnostik-Startup Noscendo" -> "Noscendo"
    c = re.sub(r'^(?:der|die|das|des|dem|den)\s+', '', c, flags=re.I)
    
    # Specific normalization fixes
    if "süddeutsche gelenkscheibenfabrik" in c.lower() and "& co. kg" not in c.lower():
        c = "Süddeutsche Gelenkscheibenfabrik GmbH & Co. KG"
    elif "booster precision components holding" in c.lower():
        c = "BOOSTER Precision Components GmbH"
    elif "bsh gmbh" in c.lower() and "& co. kg" not in c.lower():
        c = "BSH GmbH & Co. KG"
        
    return c.strip(' ,.:')

def normalize_url(url: str) -> str:
    if not url:
        return ""
    clean = re.sub(r'^https?://(?:www\.)?', '', url).split('?')[0].rstrip('/')
    return clean

def main():
    print("=" * 80)
    print("🧹 NEXUS RADAR DATA RECONCILIATION & CLEANUP")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    if not os.path.exists(RESEARCH_FILE):
        print(f"ERROR: {RESEARCH_FILE} does not exist.")
        return

    with open(RESEARCH_FILE, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)

    events = raw_data.get("events", [])
    print(f"Initial event count: {len(events)}")

    # Group by normalized URL
    url_groups = {}
    for ev in events:
        n_url = normalize_url(ev.get("source_url", ""))
        url_groups.setdefault(n_url, []).append(ev)

    print(f"Unique source URLs: {len(url_groups)}")

    canonical_events = []
    audit_trail = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "initial_count": len(events),
        "unique_urls": len(url_groups),
        "duplicate_merges": [],
        "cleaned_company_names": [],
        "reclassified_events": [],
        "final_count": 0
    }

    for n_url, group in url_groups.items():
        if len(group) == 1:
            canonical_events.append(group[0])
        else:
            # Sort group: prioritize event with more history or longer company name
            group.sort(key=lambda x: (len(x.get("history", [])), len(x.get("company_name", ""))), reverse=True)
            primary = group[0]
            secondaries = group[1:]

            merge_entry = {
                "source_url": primary.get("source_url"),
                "canonical_id": primary.get("event_id"),
                "canonical_company": primary.get("company_name"),
                "merged_duplicates": []
            }

            for sec in secondaries:
                merge_entry["merged_duplicates"].append({
                    "duplicate_id": sec.get("event_id"),
                    "duplicate_company": sec.get("company_name"),
                    "duplicate_description": sec.get("description")
                })
                # Add to history if not present
                hist_item = {
                    "recorded_at": sec.get("captured_at") or sec.get("last_checked_at") or datetime.now(timezone.utc).isoformat(),
                    "source_url": sec.get("source_url"),
                    "source_type": sec.get("source_type"),
                    "evidence_text": sec.get("evidence_text"),
                    "description": sec.get("description"),
                    "published_at": sec.get("published_at"),
                    "event_date": sec.get("event_date"),
                    "report_type": "reconciled_duplicate"
                }
                primary.setdefault("history", []).append(hist_item)

            audit_trail["duplicate_merges"].append(merge_entry)
            canonical_events.append(primary)

    # Process all canonical events: clean names, re-evaluate reality check and priority
    processed_events = []
    for ev in canonical_events:
        old_name = ev.get("company_name", "")
        clean_name = clean_company_name(old_name)
        if clean_name != old_name:
            audit_trail["cleaned_company_names"].append({
                "event_id": ev.get("event_id"),
                "original_name": old_name,
                "cleaned_name": clean_name
            })
            ev["company_name"] = clean_name

        # Re-evaluate reality check using updated rules
        old_rc = ev.get("reality_check", {})
        old_status = old_rc.get("status")
        old_role = old_rc.get("target_role")
        old_prio = ev.get("mandate_priority")

        # Evaluate fresh
        new_rc = MandateRealityCheckEngine.evaluate(ev, previous_check=old_rc)
        ev["reality_check"] = new_rc

        # Evaluate priority via TriggerEvent model
        temp_te = TriggerEvent.from_dict(ev)
        new_prio, new_action = temp_te.determine_mandate_priority()
        ev["mandate_priority"] = new_prio
        ev["action_type"] = new_action
        from modules.feed_ingestion.event_model import MANDATE_PRIORITY_LABELS
        ev["mandate_priority_label"] = MANDATE_PRIORITY_LABELS.get(new_prio, "Watchlist / General Distress")

        # Track reclassifications
        if (old_status != new_rc.get("status") or 
            old_role != new_rc.get("target_role") or 
            old_prio != new_prio):
            audit_trail["reclassified_events"].append({
                "event_id": ev.get("event_id"),
                "company": ev.get("company_name"),
                "changes": {
                    "status": {"before": old_status, "after": new_rc.get("status")},
                    "target_role": {"before": old_role, "after": new_rc.get("target_role")},
                    "priority": {"before": old_prio, "after": new_prio},
                    "action_type": {"before": ev.get("action_type"), "after": new_action}
                },
                "rationale": new_rc.get("rationale")
            })

        processed_events.append(ev)

    audit_trail["final_count"] = len(processed_events)

    print(f"Processed canonical events: {len(processed_events)}")
    print(f"Duplicate pairs merged: {len(audit_trail['duplicate_merges'])}")
    print(f"Company names cleaned: {len(audit_trail['cleaned_company_names'])}")
    print(f"Events reclassified: {len(audit_trail['reclassified_events'])}")

    # Save to research file and public file
    out_payload = {
        "version": "1.3.0",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_events": len(processed_events),
        "events": processed_events
    }

    with open(RESEARCH_FILE, 'w', encoding='utf-8') as f:
        json.dump(out_payload, f, indent=2, ensure_ascii=False)
    print(f"Saved cleaned dataset to {RESEARCH_FILE}")

    os.makedirs(os.path.dirname(PUBLIC_FILE), exist_ok=True)
    with open(PUBLIC_FILE, 'w', encoding='utf-8') as f:
        json.dump(out_payload, f, indent=2, ensure_ascii=False)
    print(f"Mirrored cleaned dataset to {PUBLIC_FILE}")

    os.makedirs(os.path.dirname(AUDIT_LOG_FILE), exist_ok=True)
    with open(AUDIT_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(audit_trail, f, indent=2, ensure_ascii=False)
    print(f"Saved full audit trail to {AUDIT_LOG_FILE}")

    print("\nSummary of Reclassifications:")
    for rec in audit_trail["reclassified_events"]:
        print(f" - {rec['company']}:")
        for k, v in rec['changes'].items():
            print(f"     {k}: {v['before']} -> {v['after']}")

if __name__ == "__main__":
    main()
