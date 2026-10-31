"""
Sync Continuous Radar Events directly into Supabase (nexus_opportunities)
Bridges vetted restructuring, StaRUG, and corporate mandate events
from data/research/continuous_radar_events.json to Harro Goerndt's NeXus Posteingang.
"""

import os
import sys
import json
from datetime import datetime, timezone

# Windows console encoding safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.config import DEFAULT_USER_ID
from modules.feed_ingestion.db_client import SupabaseClient

def run_sync(dry_run=False):
    print("=" * 75)
    print("🛰️ NEXUS RADAR -> SUPABASE POSTEINGANG BRIDGE")
    print(f"Ziel-Benutzer: {DEFAULT_USER_ID} (Harro Goerndt)")
    print(f"Modus: {'DRY RUN (Simulation)' if dry_run else 'LIVE SYNC (Schreibt in Posteingang)'}")
    print("=" * 75)

    events_file = os.path.join(PROJECT_ROOT, "data", "research", "continuous_radar_events.json")
    if not os.path.exists(events_file):
        print(f"❌ Datei nicht gefunden: {events_file}")
        return 1

    with open(events_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    raw_events = data.get("events", []) if isinstance(data, dict) else data
    print(f"Geladene Radar-Ereignisse gesamt: {len(raw_events)}")

    # Filter auf aktive Mandats-Kandidaten (MANDAT_PLAUSIBEL & BEOBACHTEN)
    candidates = [
        ev for ev in raw_events
        if ev.get("reality_check", {}).get("status") in ("MANDAT_PLAUSIBEL", "BEOBACHTEN")
    ]
    print(f"Qualifizierte Mandats- & Restrukturierungskandidaten: {len(candidates)}")

    db = None
    if not dry_run:
        try:
            db = SupabaseClient()
            print("✅ Supabase REST Client erfolgreich verbunden.")
        except Exception as e:
            print(f"❌ Fehler bei Supabase Verbindung: {e}")
            return 1

    inserted_count = 0
    duplicate_count = 0
    skipped_count = 0

    for idx, ev in enumerate(candidates, 1):
        comp_name = (ev.get("company_name") or "").strip()
        desc = (ev.get("description") or ev.get("evidence_text") or "").strip()
        source_url = (ev.get("source_url") or "").strip()
        pub_at = ev.get("published_at") or ev.get("event_date") or datetime.now(timezone.utc).isoformat()
        rc_status = ev.get("reality_check", {}).get("status", "BEOBACHTEN")
        rc = ev.get("reality_check", {})
        
        # Titel kürzen falls zu lang
        title = desc[:200] if len(desc) > 200 else desc
        if not title:
            title = f"Restrukturierungs-Signal {comp_name}"

        is_plausible = (rc_status == "MANDAT_PLAUSIBEL")
        tier = "TIER_1_TOP" if is_plausible else "TIER_2_MID"
        lead_score = 90 if is_plausible else 75
        confidence = 0.90 if is_plausible else 0.75

        vacuum = "BESTANDEN: Organvakuum / Sanierungsbedarf plausibel" if is_plausible else "BEOBACHTUNG: Restrukturierung / StaRUG / Gläubigerverfahren"
        urgency = rc.get("criteria_eval", {}).get("action_pressure") or ("akut" if is_plausible else "erhöht")
        rationale = rc.get("rationale") or ev.get("mandate_rationale") or "Geprüfter Restrukturierungsfall im Continuous Radar"
        budget = "-"

        deal_audit = {
            "tier": tier,
            "status": "pending",
            "company_name": comp_name,
            "legal_form": ev.get("legal_form", ""),
            "event_type": title,
            "event_date": pub_at[:10] if pub_at else None,
            "vacuum_check": vacuum,
            "urgency_check": urgency,
            "audit_rationale": rationale,
            "audit_verdict": "QUALIFIZIERT_MANDATSBEDARF" if is_plausible else "QUALIFIZIERT_BEOBACHTUNG",
            "estimated_budget": budget,
            "confidence": confidence
        }

        item = {
            "company": comp_name,
            "title": title,
            "url": source_url,
            "snippet": ev.get("evidence_text") or desc,
            "region": ev.get("region", "DACH"),
            "event_date": pub_at[:10] if pub_at else None,
            "published_at": pub_at
        }

        eval_result = {
            "category": "RESTRUKTURIERUNG & MANDAT",
            "confidence_score": confidence,
            "lead_score": lead_score,
            "strategic_angle": rationale,
            "matched_keywords": [rc_status, ev.get("action_type") or "Sanierung", tier]
        }

        print(f"[{idx:02d}/{len(candidates)}] [{rc_status}] {comp_name}: {title[:60]}...")

        if dry_run:
            print(f"   -> [DRY RUN] Würde als {tier} (Score: {lead_score}) in Posteingang gespeichert werden.")
            inserted_count += 1
            continue

        if db.opportunity_exists(source_url, title):
            print("   -> ⏩ Duplikat existiert bereits in nexus_opportunities.")
            duplicate_count += 1
            continue

        rec, status = db.insert_opportunity(item, eval_result, user_id=DEFAULT_USER_ID, deal_audit=deal_audit, max_age_hours=720)
        if status == "INSERTED":
            print(f"   -> 📥 Erfolgreich in NeXus Posteingang gespeichert (ID: {rec.get('id')})")
            inserted_count += 1
        elif status == "DUPLICATE":
            print("   -> ⏩ Duplikat existiert bereits.")
            duplicate_count += 1
        else:
            print(f"   -> ⚠️ Übersprungen ({status})")
            skipped_count += 1

    print("\n" + "=" * 75)
    print("📊 SYNC ZUSAMMENFASSUNG:")
    print(f"• Geprüfte Kandidaten:     {len(candidates)}")
    print(f"• Neu in Posteingang:      {inserted_count}")
    print(f"• Bereits vorhanden:       {duplicate_count}")
    print(f"• Nicht übernommen:        {skipped_count}")
    print("=" * 75)

    return 0

if __name__ == "__main__":
    dry_mode = "--dry-run" in sys.argv
    sys.exit(run_sync(dry_run=dry_mode))
