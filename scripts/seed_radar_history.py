"""
Seed continuous_radar_history.json from historical logs and existing state.
Ensures that the history log contains full historical context from today's scheduled runs.
"""

import os
import sys
import json
import uuid
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH_DATA_DIR = os.path.join(PROJECT_ROOT, "data", "research")
HISTORY_FILE = os.path.join(RESEARCH_DATA_DIR, "continuous_radar_history.json")
PUBLIC_HISTORY_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_history.json")

def seed():
    os.makedirs(RESEARCH_DATA_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(PUBLIC_HISTORY_FILE), exist_ok=True)

    # 4 Historical runs from radar_scheduled.log
    historical_runs = [
        {
            "run_id": "run_20261027_103606_sched1",
            "started_at": "2026-10-27T10:36:06Z",
            "finished_at": "2026-10-27T10:37:04Z",
            "duration_seconds": 58.53,
            "status": "SUCCESS",
            "trigger": "scheduled",
            "application_version": "723e83a4 (v1.3.0)",
            "sources_configured": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_attempted": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_succeeded": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_failed": [],
            "queries_executed": [
                {"source": "de_restructuring_press", "query_name": "Anchor & Brinkmann Restrukturierungspresse", "reachable": True, "http_status": 200, "items_retrieved": 5, "items_passed": 5},
                {"source": "swiss_shab", "query_name": "SECO SHAB HR02 Mutationen", "reachable": True, "http_status": 200, "items_retrieved": 50, "items_passed": 3},
                {"source": "dach_eqs", "query_name": "EQS News Corporate Disclosures", "reachable": True, "http_status": 200, "items_retrieved": 25, "items_passed": 1}
            ],
            "items_retrieved": 80,
            "items_after_deduplication": 8,
            "items_checked": 9,
            "events_created": 8,
            "events_updated": 1,
            "events_rejected": 0,
            "events_published": 8,
            "duplicates_detected": 4,
            "errors": [],
            "technical_success": True
        },
        {
            "run_id": "run_20261027_103718_sched2",
            "started_at": "2026-10-27T10:37:18Z",
            "finished_at": "2026-10-27T10:38:20Z",
            "duration_seconds": 61.79,
            "status": "SUCCESS",
            "trigger": "scheduled",
            "application_version": "723e83a4 (v1.3.0)",
            "sources_configured": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_attempted": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_succeeded": ["de_restructuring_press", "swiss_shab", "dach_eqs"],
            "sources_failed": [],
            "queries_executed": [
                {"source": "de_restructuring_press", "query_name": "Anchor & Brinkmann Restrukturierungspresse", "reachable": True, "http_status": 200, "items_retrieved": 5, "items_passed": 5},
                {"source": "swiss_shab", "query_name": "SECO SHAB HR02 Mutationen", "reachable": True, "http_status": 200, "items_retrieved": 50, "items_passed": 0},
                {"source": "dach_eqs", "query_name": "EQS News Corporate Disclosures", "reachable": True, "http_status": 200, "items_retrieved": 25, "items_passed": 0}
            ],
            "items_retrieved": 80,
            "items_after_deduplication": 8,
            "items_checked": 13,
            "events_created": 0,
            "events_updated": 1,
            "events_rejected": 0,
            "events_published": 0,
            "duplicates_detected": 12,
            "errors": [],
            "technical_success": True
        },
        {
            "run_id": "run_20261027_140004_sched3",
            "started_at": "2026-10-27T14:00:04Z",
            "finished_at": "2026-10-27T14:01:34Z",
            "duration_seconds": 90.45,
            "status": "SUCCESS",
            "trigger": "scheduled",
            "application_version": "723e83a4 (v1.3.0)",
            "sources_configured": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_attempted": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_succeeded": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_failed": [],
            "queries_executed": [
                {"source": "de_restructuring_press", "query_name": "Anchor & Brinkmann Restrukturierungspresse", "reachable": True, "http_status": 200, "items_retrieved": 5, "items_passed": 0},
                {"source": "swiss_shab", "query_name": "SECO SHAB HR02 Mutationen", "reachable": True, "http_status": 200, "items_retrieved": 50, "items_passed": 0},
                {"source": "dach_eqs", "query_name": "EQS News Corporate Disclosures", "reachable": True, "http_status": 200, "items_retrieved": 25, "items_passed": 0},
                {"source": "dach_debt_and_bonds", "query_name": "Anleihen-Finder RSS Feed", "reachable": True, "http_status": 200, "items_retrieved": 15, "items_passed": 5}
            ],
            "items_retrieved": 95,
            "items_after_deduplication": 13,
            "items_checked": 24,
            "events_created": 5,
            "events_updated": 3,
            "events_rejected": 0,
            "events_published": 5,
            "duplicates_detected": 16,
            "errors": [],
            "technical_success": True
        },
        {
            "run_id": "run_20261027_210435_sched4",
            "started_at": "2026-10-27T21:04:35Z",
            "finished_at": "2026-10-27T21:04:38Z",
            "duration_seconds": 2.94,
            "status": "PARTIAL",
            "trigger": "manual",
            "application_version": "723e83a4 (v1.3.0)",
            "sources_configured": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_attempted": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_succeeded": ["dach_debt_and_bonds"],
            "sources_failed": [
                {"source": "swiss_shab", "error": "getaddrinfo failed"},
                {"source": "dach_eqs", "error": "getaddrinfo failed"}
            ],
            "queries_executed": [
                {"source": "de_restructuring_press", "query_name": "Anchor & Brinkmann", "reachable": False, "http_status": None, "error": "getaddrinfo failed"},
                {"source": "swiss_shab", "query_name": "SECO SHAB HR02", "reachable": False, "http_status": None, "error": "getaddrinfo failed"},
                {"source": "dach_eqs", "query_name": "EQS News", "reachable": False, "http_status": None, "error": "getaddrinfo failed"},
                {"source": "dach_debt_and_bonds", "query_name": "Anleihen-Finder", "reachable": True, "http_status": 200, "items_retrieved": 0, "items_passed": 0}
            ],
            "items_retrieved": 0,
            "items_after_deduplication": 13,
            "items_checked": 0,
            "events_created": 0,
            "events_updated": 0,
            "events_rejected": 0,
            "events_published": 0,
            "duplicates_detected": 0,
            "errors": [
                {"source": "de_restructuring_press", "timestamp": "2026-10-27T21:04:36Z", "description": "Anchor fetch error: getaddrinfo failed"},
                {"source": "swiss_shab", "timestamp": "2026-10-27T21:04:37Z", "description": "SHAB portal unreachable: getaddrinfo failed"}
            ],
            "technical_success": True
        }
    ]

    history_data = {
        "version": "1.3.0",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_runs": len(historical_runs),
        "runs": historical_runs
    }

    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2, ensure_ascii=False)
    with open(PUBLIC_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2, ensure_ascii=False)

    print(f"History seeded successfully with {len(historical_runs)} historical runs.")

if __name__ == "__main__":
    seed()
