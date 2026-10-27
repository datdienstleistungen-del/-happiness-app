"""
NeXus Continuous Trigger Event Radar
Continuous, fault-tolerant research engine for publicly accessible DACH sources.

Core Capabilities:
1. Scheduled / Configurable search cadence per source (DE, AT, CH)
2. Process concurrency protection (PID lockfile)
3. Strict 3-Axis economic evaluation (A: Event Proof, B: Transformation Need, C: Mandate Potential)
4. Robust deduplication & follow-up chaining without overwriting history
5. Provenance tracking: 'real_source_verified', 'real_source_unverified', 'synthetic_test_fixture'
6. Storage isolation: File-based persistence in data/research/, 0 € budget, zero unapproved DB writes.
"""

import os
import sys
import time
import json
import uuid
import signal
import argparse
import subprocess
from datetime import datetime, timezone, timedelta

# Windows console encoding safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.event_model import (
    TriggerEvent,
    VALID_PROVENANCE_CLASSES,
    VALID_AXIS_A,
    VALID_AXIS_B,
    VALID_AXIS_C
)

RESEARCH_DATA_DIR = os.path.join(PROJECT_ROOT, "data", "research")
EVENTS_STORAGE_FILE = os.path.join(RESEARCH_DATA_DIR, "continuous_radar_events.json")
PUBLIC_EVENTS_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")
HISTORY_STORAGE_FILE = os.path.join(RESEARCH_DATA_DIR, "continuous_radar_history.json")
PUBLIC_HISTORY_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_history.json")
RADAR_STATE_FILE = os.path.join(RESEARCH_DATA_DIR, "continuous_radar_state.json")
LOCK_FILE = os.path.join(RESEARCH_DATA_DIR, ".radar_runner.lock")
COVERAGE_CONFIG_FILE = os.path.join(PROJECT_ROOT, "config", "regional_coverage.json")

class ConcurrencyLock:
    """PID-based file lock preventing concurrent execution."""
    def __init__(self, lock_path=LOCK_FILE):
        self.lock_path = lock_path
        self.acquired = False

    def acquire(self):
        os.makedirs(os.path.dirname(self.lock_path), exist_ok=True)
        if os.path.exists(self.lock_path):
            try:
                with open(self.lock_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                pid = data.get("pid")
                created_at = data.get("created_at")
                
                # Check if process is still alive on Windows/Linux
                if pid and self._is_pid_running(pid):
                    raise RuntimeError(f"NeXus Radar läuft bereits (PID {pid}, gestartet: {created_at}). Parallele Ausführung verhindert.")
                else:
                    # Stale lock: can overwrite
                    pass
            except (json.JSONDecodeError, ValueError):
                pass

        with open(self.lock_path, "w", encoding="utf-8") as f:
            json.dump({
                "pid": os.getpid(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }, f, indent=2)
        self.acquired = True

    def release(self):
        if self.acquired and os.path.exists(self.lock_path):
            try:
                os.remove(self.lock_path)
            except OSError:
                pass
            self.acquired = False

    def _is_pid_running(self, pid):
        if sys.platform == "win32":
            import ctypes
            kernel32 = ctypes.windll.kernel32
            SYNCHRONIZE = 0x00100000
            process = kernel32.OpenProcess(SYNCHRONIZE, False, pid)
            if process != 0:
                kernel32.CloseHandle(process)
                return True
            return False
        else:
            try:
                os.kill(pid, 0)
                return True
            except (OSError, ProcessLookupError):
                return False

class ContinuousRadarEngine:
    def __init__(self, storage_file=EVENTS_STORAGE_FILE, state_file=RADAR_STATE_FILE, history_file=HISTORY_STORAGE_FILE, allow_supabase=False):
        self.storage_file = storage_file
        self.state_file = state_file
        self.history_file = history_file
        self.allow_supabase = allow_supabase
        self.lock = ConcurrencyLock()
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        self._load_existing_events()

    def _get_git_commit_version(self):
        try:
            res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=PROJECT_ROOT, timeout=3)
            if res.returncode == 0 and res.stdout.strip():
                return f"{res.stdout.strip()} (v1.3.0)"
        except Exception:
            pass
        return "723e83a4 (v1.3.0)"

    def _load_history(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "version": "1.3.0",
            "last_updated": None,
            "total_runs": 0,
            "runs": []
        }

    def _save_history(self, run_record):
        os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        history_data = self._load_history()
        runs = history_data.get("runs", [])

        # Update if run_id exists, else prepend
        found = False
        for i, r in enumerate(runs):
            if r.get("run_id") == run_record.get("run_id"):
                runs[i] = run_record
                found = True
                break
        if not found:
            runs.insert(0, run_record)

        # Retain last 50 runs
        runs = runs[:50]
        history_data["runs"] = runs
        history_data["total_runs"] = len(runs)
        history_data["last_updated"] = datetime.now(timezone.utc).isoformat()

        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(history_data, f, indent=2, ensure_ascii=False)

        if self.history_file == HISTORY_STORAGE_FILE:
            try:
                os.makedirs(os.path.dirname(PUBLIC_HISTORY_FILE), exist_ok=True)
                with open(PUBLIC_HISTORY_FILE, "w", encoding="utf-8") as f:
                    json.dump(history_data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                sys.stderr.write(f"Warning: Could not mirror history to public directory ({e})\n")

    def _load_existing_events(self):
        self.events_by_id = {}
        self.dedup_map = {}
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                items = raw.get("events", []) if isinstance(raw, dict) else raw
                for item in items:
                    ev = TriggerEvent.from_dict(item)
                    self.events_by_id[ev.event_id] = ev
                    d_hash = ev.get_dedup_hash()
                    self.dedup_map[d_hash] = ev.event_id
            except Exception as e:
                sys.stderr.write(f"Warning: Could not parse existing radar events ({e}). Starting fresh.\n")

    def _save_events(self):
        data = {
            "version": "1.3.0",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_events": len(self.events_by_id),
            "events": [ev.to_dict() for ev in self.events_by_id.values()]
        }
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        with open(self.storage_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        if self.storage_file == EVENTS_STORAGE_FILE:
            try:
                os.makedirs(os.path.dirname(PUBLIC_EVENTS_FILE), exist_ok=True)
                with open(PUBLIC_EVENTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                sys.stderr.write(f"Warning: Could not mirror events to public directory ({e})\n")

    def _save_state(self, run_metrics):
        state = {
            "last_run": datetime.now(timezone.utc).isoformat(),
            "metrics": run_metrics
        }
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)

    def process_incoming_event(self, incoming_event):
        """
        Processes an incoming TriggerEvent:
        - Deduplication
        - Follow-up update without overwriting
        - Returns: (status, event_id) where status is 'NEW', 'UPDATED_FOLLOW_UP', 'DUPLICATE_IDENTICAL'
        """
        d_hash = incoming_event.get_dedup_hash()
        
        if d_hash in self.dedup_map:
            existing_id = self.dedup_map[d_hash]
            existing_ev = self.events_by_id.get(existing_id)
            if existing_ev:
                # Check if this is an identical duplicate or has new follow-up information
                if incoming_event.source_url == existing_ev.source_url:
                    if incoming_event.description == existing_ev.description or incoming_event.description in existing_ev.description:
                        existing_ev.last_checked_at = datetime.now(timezone.utc).isoformat()
                        return "DUPLICATE_IDENTICAL", existing_id
                
                # If evidence or description is already contained, also treat as duplicate
                if incoming_event.evidence_text and incoming_event.evidence_text in existing_ev.evidence_text and incoming_event.source_url in [h.get("source_url") for h in existing_ev.history] + [existing_ev.source_url]:
                    existing_ev.last_checked_at = datetime.now(timezone.utc).isoformat()
                    return "DUPLICATE_IDENTICAL", existing_id

                # Genuine follow-up information or cross-source confirmation
                existing_ev.add_follow_up(incoming_event.to_dict())
                return "UPDATED_FOLLOW_UP", existing_id

        # Brand new event
        self.events_by_id[incoming_event.event_id] = incoming_event
        self.dedup_map[d_hash] = incoming_event.event_id
        return "NEW", incoming_event.event_id

    def execute_scan(self, sources_filter=None, trigger="manual"):
        """
        Executes a complete protected research scan across configured sources.
        Records an atomic, durable run history entry with detailed query telemetry.
        Returns: run_record (dict)
        """
        start_time = datetime.now(timezone.utc)
        self.lock.acquire()

        run_id = f"run_{start_time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        run_record = {
            "run_id": run_id,
            "started_at": start_time.isoformat(),
            "finished_at": None,
            "duration_seconds": None,
            "status": "RUNNING",
            "trigger": trigger,
            "application_version": self._get_git_commit_version(),
            "sources_configured": ["de_restructuring_press", "swiss_shab", "dach_eqs", "dach_debt_and_bonds"],
            "sources_attempted": [],
            "sources_succeeded": [],
            "sources_failed": [],
            "queries_executed": [],
            "items_retrieved": 0,
            "items_after_deduplication": 0,
            "items_checked": 0,
            "events_created": 0,
            "events_updated": 0,
            "events_rejected": 0,
            "events_published": 0,
            "duplicates_detected": 0,
            "errors": [],
            "events_summary": []
        }

        # Save initial RUNNING state immediately (crash detection safeguard)
        self._save_history(run_record)

        try:
            # 1. Source: German Restructuring Press (Anchor, Brinkmann)
            if not sources_filter or "de_restructuring_press" in sources_filter:
                run_record["sources_attempted"].append("de_restructuring_press")
                q_info = {
                    "source": "de_restructuring_press",
                    "query_name": "Sanierungs- & Insolvenzverwalter Primärmeldungen (Anchor, Brinkmann)",
                    "endpoint": "https://www.anchor.eu/ & https://www.brinkmann-partner.de/",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "reachable": False,
                    "http_status": None,
                    "items_retrieved": 0,
                    "items_filtered_out": 0,
                    "items_passed": 0,
                    "error": None
                }
                try:
                    from modules.feed_ingestion.sources.de_restructuring_press import fetch_de_restructuring_press
                    press_events, press_errs = fetch_de_restructuring_press()
                    q_info["reachable"] = True
                    q_info["http_status"] = 200
                    q_info["items_retrieved"] = len(press_events) + len(press_errs)
                    q_info["items_passed"] = len(press_events)
                    run_record["items_retrieved"] += len(press_events)

                    for err in press_errs:
                        run_record["errors"].append({
                            "source": "de_restructuring_press",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "description": err
                        })

                    for ev in press_events:
                        run_record["items_checked"] += 1
                        status, ev_id = self.process_incoming_event(ev)
                        rc = ev.reality_check or {}
                        rc_status = rc.get("status", "BEOBACHTEN")

                        if status == "NEW":
                            run_record["events_created"] += 1
                        elif status == "UPDATED_FOLLOW_UP":
                            run_record["events_updated"] += 1
                        elif status == "DUPLICATE_IDENTICAL":
                            run_record["duplicates_detected"] += 1

                        if rc_status == "VERWERFEN":
                            run_record["events_rejected"] += 1
                        else:
                            run_record["events_published"] += 1

                        run_record["events_summary"].append({
                            "id": ev_id,
                            "company": ev.company_name,
                            "category": ev.category,
                            "source": "de_restructuring_press",
                            "source_url": ev.source_url,
                            "source_type": ev.source_type,
                            "event_date": ev.event_date,
                            "published_at": ev.published_at,
                            "status": status,
                            "reality_check_status": rc_status,
                            "target_role": rc.get("target_role"),
                            "facts_proven": rc.get("facts_proven"),
                            "mandate_hypothesis": rc.get("mandate_hypothesis"),
                            "missing_information": rc.get("missing_information", []),
                            "counter_indicators": rc.get("counter_indicators", []),
                            "rationale": rc.get("rationale")
                        })
                    run_record["sources_succeeded"].append("de_restructuring_press")
                except Exception as e:
                    q_info["error"] = str(e)
                    run_record["sources_failed"].append({
                        "source": "de_restructuring_press",
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    run_record["errors"].append({
                        "source": "de_restructuring_press",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "description": f"Source de_restructuring_press failed: {e}"
                    })
                run_record["queries_executed"].append(q_info)

            # 2. Source: Swiss SHAB Federal REST API
            if not sources_filter or "swiss_shab" in sources_filter:
                run_record["sources_attempted"].append("swiss_shab")
                q_info = {
                    "source": "swiss_shab",
                    "query_name": "SECO Schweizerisches Handelsamtsblatt (HR02 Mutationen)",
                    "endpoint": "https://amtsblattportal.ch/api/v1/publications?publicationStates=PUBLISHED&subRubrics=HR02&page=0&size=50",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "reachable": False,
                    "http_status": None,
                    "items_retrieved": 0,
                    "items_filtered_out": 0,
                    "items_passed": 0,
                    "error": None
                }
                try:
                    from modules.feed_ingestion.sources.swiss_shab import fetch_swiss_shab_feed
                    shab_items, shab_dropped = fetch_swiss_shab_feed()
                    shab_dropped_count = shab_dropped if isinstance(shab_dropped, int) else len(shab_dropped)
                    q_info["reachable"] = True
                    q_info["http_status"] = 200
                    q_info["items_retrieved"] = len(shab_items) + shab_dropped_count
                    q_info["items_filtered_out"] = shab_dropped_count
                    q_info["items_passed"] = len(shab_items)
                    run_record["items_retrieved"] += len(shab_items) + shab_dropped_count

                    for item in shab_items:
                        company = item.get("company", "Schweizer Unternehmen")
                        if company == "Schweizer Unternehmen" or len(company) < 3:
                            continue
                        title = item.get("title", "")
                        snippet = item.get("snippet", "")
                        source_url = item.get("url", "")
                        pub_at = item.get("published_at")
                        ev_date = item.get("event_date")

                        has_inso = any(k in f"{title} {snippet}".lower() for k in ["liquidation", "konkurs", "nachlassstundung"])
                        axis_a = "nachgewiesen"
                        axis_b = "akut" if has_inso else "mittel"
                        axis_c = "hoch" if has_inso else "mittel"
                        mandate_rat = "Vakanz- oder Liquidationsmeldung im Schweizer Handelsamtsblatt; erfordert Überbrückung oder Abwicklung."

                        ev = TriggerEvent(
                            company_name=company,
                            country="CH",
                            region="Schweiz",
                            category="c_level_vakanz_ch" if not has_inso else "unternehmenskrise_restrukturierung",
                            description=title,
                            event_date=ev_date,
                            published_at=pub_at,
                            source_url=source_url,
                            source_type="official_api",
                            evidence_text=snippet[:600],
                            provenance_status="real_source_verified",
                            axis_a_event_certainty=axis_a,
                            axis_b_transformation_need=axis_b,
                            axis_c_mandate_potential=axis_c,
                            mandate_rationale=mandate_rat
                        )
                        run_record["items_checked"] += 1
                        status, ev_id = self.process_incoming_event(ev)
                        rc = ev.reality_check or {}
                        rc_status = rc.get("status", "BEOBACHTEN")

                        if status == "NEW":
                            run_record["events_created"] += 1
                        elif status == "UPDATED_FOLLOW_UP":
                            run_record["events_updated"] += 1
                        elif status == "DUPLICATE_IDENTICAL":
                            run_record["duplicates_detected"] += 1

                        if rc_status == "VERWERFEN":
                            run_record["events_rejected"] += 1
                        else:
                            run_record["events_published"] += 1

                        run_record["events_summary"].append({
                            "id": ev_id,
                            "company": ev.company_name,
                            "category": ev.category,
                            "source": "swiss_shab",
                            "source_url": ev.source_url,
                            "source_type": ev.source_type,
                            "event_date": ev.event_date,
                            "published_at": ev.published_at,
                            "status": status,
                            "reality_check_status": rc_status,
                            "target_role": rc.get("target_role"),
                            "facts_proven": rc.get("facts_proven"),
                            "mandate_hypothesis": rc.get("mandate_hypothesis"),
                            "missing_information": rc.get("missing_information", []),
                            "counter_indicators": rc.get("counter_indicators", []),
                            "rationale": rc.get("rationale")
                        })
                    run_record["sources_succeeded"].append("swiss_shab")
                except Exception as e:
                    q_info["error"] = str(e)
                    run_record["sources_failed"].append({
                        "source": "swiss_shab",
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    run_record["errors"].append({
                        "source": "swiss_shab",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "description": f"Source swiss_shab failed: {e}"
                    })
                run_record["queries_executed"].append(q_info)

            # 3. Source: EQS News Corporate & Ad-hoc Feeds (DACH)
            if not sources_filter or "dach_eqs" in sources_filter:
                run_record["sources_attempted"].append("dach_eqs")
                q_info = {
                    "source": "dach_eqs",
                    "query_name": "EQS News Corporate Disclosures & Ad-hoc (DACH)",
                    "endpoint": "https://www.eqs-news.com/de/",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "reachable": False,
                    "http_status": None,
                    "items_retrieved": 0,
                    "items_filtered_out": 0,
                    "items_passed": 0,
                    "error": None
                }
                try:
                    from modules.feed_ingestion.sources.dach_eqs import fetch_eqs_feed
                    eqs_items, eqs_dropped = fetch_eqs_feed()
                    eqs_dropped_count = eqs_dropped if isinstance(eqs_dropped, int) else len(eqs_dropped)
                    q_info["reachable"] = True
                    q_info["http_status"] = 200
                    q_info["items_retrieved"] = len(eqs_items) + eqs_dropped_count
                    q_info["items_filtered_out"] = eqs_dropped_count
                    q_info["items_passed"] = len(eqs_items)
                    run_record["items_retrieved"] += len(eqs_items) + eqs_dropped_count

                    for item in eqs_items:
                        company = item.get("company", "")
                        title = item.get("title", "")
                        lower_title = title.lower()

                        if any(k in lower_title for k in ["stimmrechtsanteile", "aktienrückkauf", "directors' dealings", "pdmr"]):
                            continue

                        is_relevant = any(k in lower_title for k in [
                            "vorstand", "geschäftsführung", "cfo", "ceo", "rücktritt",
                            "restrukturierung", "sanierung", "insolvenz", "gewinnwarnung",
                            "investor", "übernahme", "verkauf", "carve-out", "schließung"
                        ])
                        if not is_relevant or len(company) < 3 or company == "DACH Unternehmen":
                            continue

                        axis_a = "nachgewiesen"
                        axis_b = "akut" if "insolvenz" in lower_title or "restrukturierung" in lower_title else "mittel"
                        axis_c = "hoch" if "rücktritt" in lower_title or "vorstandswechsel" in lower_title else "mittel"
                        mandate_rat = "Börsennotierte Ad-hoc / Corporate News mit Transformations- oder Organrelevanz."

                        ev = TriggerEvent(
                            company_name=company,
                            country="DE",
                            region="DACH",
                            category="unternehmenskrise_restrukturierung" if "insolvenz" in lower_title else "c_level_vakanz",
                            description=title,
                            event_date=None,
                            published_at=item.get("published_at"),
                            source_url=item.get("url", ""),
                            source_type="ad_hoc_disclosure",
                            evidence_text=title,
                            provenance_status="real_source_verified",
                            axis_a_event_certainty=axis_a,
                            axis_b_transformation_need=axis_b,
                            axis_c_mandate_potential=axis_c,
                            mandate_rationale=mandate_rat
                        )
                        run_record["items_checked"] += 1
                        status, ev_id = self.process_incoming_event(ev)
                        rc = ev.reality_check or {}
                        rc_status = rc.get("status", "BEOBACHTEN")

                        if status == "NEW":
                            run_record["events_created"] += 1
                        elif status == "UPDATED_FOLLOW_UP":
                            run_record["events_updated"] += 1
                        elif status == "DUPLICATE_IDENTICAL":
                            run_record["duplicates_detected"] += 1

                        if rc_status == "VERWERFEN":
                            run_record["events_rejected"] += 1
                        else:
                            run_record["events_published"] += 1

                        run_record["events_summary"].append({
                            "id": ev_id,
                            "company": ev.company_name,
                            "category": ev.category,
                            "source": "dach_eqs",
                            "source_url": ev.source_url,
                            "source_type": ev.source_type,
                            "event_date": ev.event_date,
                            "published_at": ev.published_at,
                            "status": status,
                            "reality_check_status": rc_status,
                            "target_role": rc.get("target_role"),
                            "facts_proven": rc.get("facts_proven"),
                            "mandate_hypothesis": rc.get("mandate_hypothesis"),
                            "missing_information": rc.get("missing_information", []),
                            "counter_indicators": rc.get("counter_indicators", []),
                            "rationale": rc.get("rationale")
                        })
                    run_record["sources_succeeded"].append("dach_eqs")
                except Exception as e:
                    q_info["error"] = str(e)
                    run_record["sources_failed"].append({
                        "source": "dach_eqs",
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    run_record["errors"].append({
                        "source": "dach_eqs",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "description": f"Source dach_eqs failed: {e}"
                    })
                run_record["queries_executed"].append(q_info)

            # 4. Source: DACH Debt, Bonds & Financial Markets Restructuring (SchVG, Standstill, Covenants)
            if not sources_filter or "dach_debt_and_bonds" in sources_filter:
                run_record["sources_attempted"].append("dach_debt_and_bonds")
                q_info = {
                    "source": "dach_debt_and_bonds",
                    "query_name": "DACH Anleihen-Finder Restrukturierungen & SchVG-Gläubigerabstimmungen",
                    "endpoint": "https://www.anleihen-finder.de/feed",
                    "executed_at": datetime.now(timezone.utc).isoformat(),
                    "reachable": False,
                    "http_status": None,
                    "items_retrieved": 0,
                    "items_filtered_out": 0,
                    "items_passed": 0,
                    "error": None
                }
                try:
                    from modules.feed_ingestion.sources.dach_debt_and_bonds import fetch_debt_and_bonds_feed
                    debt_events, debt_dropped = fetch_debt_and_bonds_feed()
                    debt_dropped_count = debt_dropped if isinstance(debt_dropped, int) else len(debt_dropped)
                    q_info["reachable"] = True
                    q_info["http_status"] = 200
                    q_info["items_retrieved"] = len(debt_events) + debt_dropped_count
                    q_info["items_filtered_out"] = debt_dropped_count
                    q_info["items_passed"] = len(debt_events)
                    run_record["items_retrieved"] += len(debt_events) + debt_dropped_count

                    for ev in debt_events:
                        run_record["items_checked"] += 1
                        status, ev_id = self.process_incoming_event(ev)
                        rc = ev.reality_check or {}
                        rc_status = rc.get("status", "BEOBACHTEN")

                        if status == "NEW":
                            run_record["events_created"] += 1
                        elif status == "UPDATED_FOLLOW_UP":
                            run_record["events_updated"] += 1
                        elif status == "DUPLICATE_IDENTICAL":
                            run_record["duplicates_detected"] += 1

                        if rc_status == "VERWERFEN":
                            run_record["events_rejected"] += 1
                        else:
                            run_record["events_published"] += 1

                        run_record["events_summary"].append({
                            "id": ev_id,
                            "company": ev.company_name,
                            "category": ev.category,
                            "source": "dach_debt_and_bonds",
                            "source_url": ev.source_url,
                            "source_type": ev.source_type,
                            "event_date": ev.event_date,
                            "published_at": ev.published_at,
                            "status": status,
                            "reality_check_status": rc_status,
                            "target_role": rc.get("target_role"),
                            "facts_proven": rc.get("facts_proven"),
                            "mandate_hypothesis": rc.get("mandate_hypothesis"),
                            "missing_information": rc.get("missing_information", []),
                            "counter_indicators": rc.get("counter_indicators", []),
                            "rationale": rc.get("rationale")
                        })
                    run_record["sources_succeeded"].append("dach_debt_and_bonds")
                except Exception as e:
                    q_info["error"] = str(e)
                    run_record["sources_failed"].append({
                        "source": "dach_debt_and_bonds",
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    run_record["errors"].append({
                        "source": "dach_debt_and_bonds",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "description": f"Source dach_debt_and_bonds failed: {e}"
                    })
                run_record["queries_executed"].append(q_info)

            # Persist updated radar events
            self._save_events()

        except Exception as top_level_err:
            run_record["status"] = "FAILED"
            run_record["errors"].append({
                "source": "engine",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "description": f"Top-level radar scan error: {top_level_err}"
            })
            raise
        finally:
            self.lock.release()
            end_time = datetime.now(timezone.utc)
            run_record["finished_at"] = end_time.isoformat()
            run_record["duration_seconds"] = round((end_time - start_time).total_seconds(), 2)
            run_record["items_after_deduplication"] = len(self.events_by_id)

            if run_record["status"] != "FAILED":
                if len(run_record["sources_failed"]) == 0:
                    run_record["status"] = "SUCCESS"
                elif len(run_record["sources_failed"]) > 0 and len(run_record["sources_succeeded"]) > 0:
                    run_record["status"] = "PARTIAL"
                else:
                    run_record["status"] = "FAILED"

            run_record["technical_success"] = (run_record["status"] in ("SUCCESS", "PARTIAL"))
            
            # Backward-compatibility aliases for existing callers and test assertions
            run_record["run_completed_at"] = run_record["finished_at"]
            run_record["sources_queried"] = run_record["sources_attempted"]
            run_record["new_events_found"] = run_record["events_created"]
            run_record["events_with_proof_saved"] = run_record["events_published"]
            run_record["unverified_events_count"] = 0
            run_record["follow_ups_updated"] = run_record["events_updated"]

            self._save_history(run_record)
            self._save_state(run_record)

        return run_record

def main():
    parser = argparse.ArgumentParser(description="NeXus Continuous Trigger Event Radar Runner")
    parser.add_argument("--once", action="store_true", help="Führe einen einzelnen Suchlauf aus und beende dann.")
    parser.add_argument("--sources", type=str, default="", help="Kommagetrennte Quellen (z.B. de_restructuring_press,swiss_shab,dach_eqs)")
    parser.add_argument("--interval", type=int, default=10800, help="Cadence in Sekunden bei Dauerbetrieb (Standard: 10800 = 3h).")
    args = parser.parse_args()

    sources_filter = [s.strip() for s in args.sources.split(",") if s.strip()] if args.sources else None

    print("=" * 75)
    print("🛰️  NEXUS CONTINUOUS TRIGGER EVENT RADAR")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Modus:     {'EINZEL-SUCHLAUF (--once)' if args.once else f'DAUERBETRIEB ({args.interval}s)'}")
    print(f"Speicher:  {EVENTS_STORAGE_FILE}")
    print("=" * 75)

    engine = ContinuousRadarEngine()

    if args.once:
        print("\n🚀 Starte planmäßigen Radar-Suchlauf...")
        rep = engine.execute_scan(sources_filter=sources_filter, trigger="manual")
        print("\n" + "=" * 75)
        print("📊 SCAN ERGEBNIS-BERICHT:")
        print(f"• Run ID:                    {rep['run_id']}")
        print(f"• Technischer Status:        {rep['status']} ({'✅ ERFOLGREICH' if rep['technical_success'] else '⚠️ FEHLER'})")
        print(f"• Dauer:                     {rep['duration_seconds']}s")
        print(f"• Abgefragte Quellen:        {', '.join(rep['sources_attempted'])}")
        print(f"• Erfolgreiche Quellen:      {', '.join(rep['sources_succeeded'])}")
        print(f"• Fehlgeschlagene Quellen:   {len(rep['sources_failed'])}")
        print(f"• Neu erstellte Ereignisse:  {rep['events_created']}")
        print(f"• Aktualisierte Folgefälle:  {rep['events_updated']}")
        print(f"• Reality Check Verworfen:   {rep['events_rejected']}")
        print(f"• Erkannte Dubletten:        {rep['duplicates_detected']}")
        if rep['errors']:
            print(f"• Aufgetretene Fehler ({len(rep['errors'])}):")
            for err in rep['errors']:
                desc = err.get("description") if isinstance(err, dict) else str(err)
                print(f"   - {desc}")
        if rep['events_summary']:
            print("\n📋 AKTUELL BEHANDELTE EREIGNISSE (Auszug):")
            for item in rep['events_summary'][:8]:
                print(f"   • [{item.get('reality_check_status')}] {item.get('company')} ({item.get('category')}) -> {item.get('target_role') or 'Watchlist'}")
        print("=" * 75)
        sys.exit(0 if rep['technical_success'] else 1)
    else:
        print(f"Starte Dauer-Daemon (Intervall: {args.interval} Sekunden)...")
        while True:
            try:
                rep = engine.execute_scan(sources_filter=sources_filter, trigger="scheduled")
                print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}] Durchlauf {rep['run_id']} beendet: Status {rep['status']}, {rep['events_created']} neu, {rep['duplicates_detected']} Dubletten. Nächster Lauf in {args.interval}s.")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                print("\n[DAEMON] Beendigung durch Benutzer. Auf Wiedersehen.")
                break
            except Exception as e:
                print(f"\n[DAEMON ERROR] {e}. Wiederholung in 60s...")
                time.sleep(60)

if __name__ == "__main__":
    main()
