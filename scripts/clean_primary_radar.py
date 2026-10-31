"""
Script to triage / discard synthetic test fixtures from the active Primary Radar (nexus_opportunities & nexus_trigger_events).
Marks the 4 German test fixtures as rejected / TIER_3 / Synthetic_Test_Fixture.
"""

import sys
import os
import json
import urllib.request
import urllib.parse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from modules.feed_ingestion.db_client import SupabaseClient

TARGET_IDS = [
    "a963f9bd-f5b3-41a5-a9c3-19c0c8eeda49",  # SolarWorld Industries Saxony GmbH
    "b9ab1071-47cd-4f57-b218-c866cdd83269",  # Kranbau Eberswalde Engineering SE
    "fd9d6818-50a8-4921-8ade-4f5c26771709",  # Hanseatic Power Solutions GmbH
    "38008838-2efe-4fc8-926c-27e508f9f813",  # Quanten-Technologie Holding AG
]

def clean_radar():
    cli = SupabaseClient()
    headers = cli._headers(return_rep=True)

    print("=== AUSKÄMMEN DES PRIMÄR-RADARS (AUSSORTIERUNG SYNTHETISCHER FIXTURES) ===")

    for opp_id in TARGET_IDS:
        # 1. Fetch current opportunity
        url_get = f"{cli.base_rest}/nexus_opportunities?id=eq.{opp_id}&select=id,title,review_status,priority,notes"
        req_get = urllib.request.Request(url_get, headers=cli._headers())
        try:
            with urllib.request.urlopen(req_get, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if not data:
                    print(f"[-] Opportunity {opp_id} nicht gefunden.")
                    continue
                opp = data[0]
                title = opp.get("title")
                print(f"\n[>] Ziel: {title}")
                print(f"    ID: {opp_id} | Status alt: {opp.get('review_status')} | Priority alt: {opp.get('priority')}")
        except Exception as e:
            print(f"[!] Fehler beim Laden von {opp_id}: {e}")
            continue

        # 2. Patch nexus_opportunities
        url_patch = f"{cli.base_rest}/nexus_opportunities?id=eq.{opp_id}"
        patch_payload = {
            "review_status": "rejected",
            "priority": "TIER_3",
            "tags": ["TIER_3", "Auto_Discarded", "Synthetic_Test_Fixture"],
            "notes": "Synthetische Test-Fixture - Im Evidenz-Audit aus dem Primär-Radar aussortiert.",
            "review_notes": json.dumps({
                "deal_coach": {
                    "tier": "TIER_3",
                    "status": "discarded",
                    "rejection_reason": "Synthetic_Test_Fixture",
                    "audit_timestamp": "2026-10-27T10:00:00Z"
                }
            })
        }
        
        req_patch = urllib.request.Request(
            url_patch,
            data=json.dumps(patch_payload).encode('utf-8'),
            headers=headers,
            method='PATCH'
        )
        try:
            with urllib.request.urlopen(req_patch, timeout=10) as resp:
                patched_data = json.loads(resp.read().decode('utf-8'))
                print(f"    [+] nexus_opportunities aktualisiert -> review_status='rejected', priority='TIER_3'")
        except Exception as e:
            print(f"    [!] Fehler beim Patchen von Opportunity {opp_id}: {e}")

        # 3. Find and patch trigger events via nexus_opportunity_triggers
        url_link = f"{cli.base_rest}/nexus_opportunity_triggers?opportunity_id=eq.{opp_id}&select=trigger_id"
        req_link = urllib.request.Request(url_link, headers=cli._headers())
        try:
            with urllib.request.urlopen(req_link, timeout=10) as resp:
                links = json.loads(resp.read().decode('utf-8'))
                for l in links:
                    trig_id = l.get('trigger_id')
                    if trig_id:
                        # Fetch current trigger title / content
                        url_trig_patch = f"{cli.base_rest}/nexus_trigger_events?id=eq.{trig_id}"
                        # Check what trigger event contains
                        req_trig_get = urllib.request.Request(f"{url_trig_patch}&select=id,title,signal_type", headers=cli._headers())
                        with urllib.request.urlopen(req_trig_get, timeout=10) as trg_resp:
                            trg_info = json.loads(trg_resp.read().decode('utf-8'))
                            print(f"    [+] Zugehöriges Trigger-Event: {trg_info}")

                        # Update trigger signal_type or tag if needed
                        patch_trig_payload = {
                            "signal_type": "SYNTHETIC_TEST_FIXTURE_DISCARDED"
                        }
                        req_trig_patch = urllib.request.Request(
                            url_trig_patch,
                            data=json.dumps(patch_trig_payload).encode('utf-8'),
                            headers=headers,
                            method='PATCH'
                        )
                        with urllib.request.urlopen(req_trig_patch, timeout=10) as p_resp:
                            print(f"    [+] nexus_trigger_events ({trig_id}) aktualisiert -> signal_type='SYNTHETIC_TEST_FIXTURE_DISCARDED'")
        except Exception as e:
            print(f"    [!] Hinweis zu Trigger Event: {e}")

    print("\n=== AUSKÄMMEN ABGESCHLOSSEN ===")

if __name__ == "__main__":
    clean_radar()
