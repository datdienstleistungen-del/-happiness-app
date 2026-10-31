import os
import sys
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')

from modules.feed_ingestion.continuous_radar import ContinuousRadarEngine
from modules.feed_ingestion.event_model import TriggerEvent
from modules.feed_ingestion.reality_check import MandateRealityCheckEngine, CLASS_MANDAT_PLAUSIBEL

def test_durability():
    print("=" * 70)
    print("🧪 TEST: HUMAN REVIEW PRESERVATION ACROSS RADAR RUNS")
    print("=" * 70)

    # 1. Simulate an event with a manual human decision
    test_event_data = {
        "event_id": "test-uuid-human-durability",
        "company_name": "Test Durability GmbH",
        "country": "DE",
        "category": "c_level_vakanz",
        "description": "Test Durability GmbH: Neuer CEO gesucht",
        "source_url": "https://www.example.com/test-durability",
        "source_type": "press_release",
        "evidence_text": "Gesellschaft sucht Nachfolger für ausgeschiedenen Geschäftsführer.",
        "published_at": "2026-10-27T12:00:00+00:00",
        "reality_check": {
            "status": "MANDAT_PLAUSIBEL",
            "target_role": "INTERIM_CEO",
            "human_review": {
                "reviewed": True,
                "reviewed_at": "2026-10-27T14:30:00+00:00",
                "reviewer_decision": "MANDAT_PLAUSIBEL",
                "reviewer_notes": "Aufsichtsrat hat Personalberatung für Übergangs-CEO mandatiert.",
                "confirmed": True
            }
        }
    }

    # 2. Re-evaluate using RealityCheckEngine (simulating radar scan re-evaluating the event)
    new_rc = MandateRealityCheckEngine.evaluate(test_event_data, previous_check=test_event_data["reality_check"])
    
    assert new_rc["human_review"]["reviewed"] is True, "Human review flag was lost!"
    assert new_rc["human_review"]["reviewer_decision"] == "MANDAT_PLAUSIBEL", "Decision was overwritten!"
    assert new_rc["human_review"]["reviewer_notes"] == "Aufsichtsrat hat Personalberatung für Übergangs-CEO mandatiert.", "Notes were lost!"
    assert new_rc["human_review"]["confirmed"] is True, "Confirmation flag was lost!"

    print("✅ VERIFIED: MandateRealityCheckEngine preserves human_review across runs.")

    # 3. Test follow-up chaining re-evaluation
    new_check, change_log = MandateRealityCheckEngine.reevaluate_on_follow_up(test_event_data, {
        "description": "Folgemeldung: Neuer CEO tritt Amt erst 2027 an",
        "evidence_text": "Künftiger Amtsantritt."
    })

    assert new_check["human_review"]["reviewed"] is True, "Human review flag was lost in follow-up!"
    assert new_check["human_review"]["reviewer_decision"] == "MANDAT_PLAUSIBEL", "Decision overwritten in follow-up!"
    
    print("✅ VERIFIED: reevaluate_on_follow_up preserves human_review in follow-up chaining.")
    print("=" * 70)
    print("All human review preservation assertions passed successfully!")

if __name__ == "__main__":
    test_durability()
