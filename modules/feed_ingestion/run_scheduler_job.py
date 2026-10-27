"""
Automated Background Runner for NeXus Continuous Trigger Event Radar
Executed on schedule (e.g. daily via Windows Task Scheduler).
Redirects execution output to modules/feed_ingestion/logs/radar_scheduled.log and rotates logs.
Zero productive Supabase writes. Persists exclusively to data/research/continuous_radar_events.json.
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

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

LOG_DIR = os.path.join(PROJECT_ROOT, "modules", "feed_ingestion", "logs")
LOG_FILE = os.path.join(LOG_DIR, "radar_scheduled.log")

def rotate_log_if_needed(max_bytes=5 * 1024 * 1024):
    """Keep log file under max_bytes by truncating older lines if necessary."""
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > max_bytes:
            with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.writelines(lines[-2000:])
    except Exception as e:
        sys.stderr.write(f"Log rotation error: {e}\n")

def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    rotate_log_if_needed()

    from modules.feed_ingestion.continuous_radar import ContinuousRadarEngine

    with open(LOG_FILE, "a", encoding="utf-8") as log_f:
        header = f"\n\n{'#' * 75}\n[RADAR SCHEDULER RUN] {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n{'#' * 75}\n"
        log_f.write(header)
        log_f.flush()

        orig_stdout = sys.stdout
        orig_stderr = sys.stderr
        sys.stdout = log_f
        sys.stderr = log_f

        exit_code = 0
        try:
            engine = ContinuousRadarEngine()
            rep = engine.execute_scan(trigger="scheduled")
            log_f.write(f"\n[SCAN FINISHED] Run ID: {rep.get('run_id')} | Status: {rep.get('status')}\n")
            log_f.write(f"  Duration: {rep.get('duration_seconds')}s\n")
            log_f.write(f"  Sources Succeeded: {', '.join(rep.get('sources_succeeded', []))}\n")
            if rep.get('sources_failed'):
                log_f.write(f"  Sources Failed: {', '.join([s.get('source', '') if isinstance(s, dict) else str(s) for s in rep.get('sources_failed', [])])}\n")
            log_f.write(f"  Created: {rep.get('events_created', 0)} | Published: {rep.get('events_published', 0)} | Rejected: {rep.get('events_rejected', 0)}\n")
            log_f.write(f"  Updated: {rep.get('events_updated', 0)} | Duplicates: {rep.get('duplicates_detected', 0)}\n")
            if rep.get('errors'):
                log_f.write(f"  Errors: {json.dumps(rep.get('errors'), ensure_ascii=False)}\n")
            exit_code = 0 if rep.get('technical_success') else 1
        except Exception as e:
            sys.stderr.write(f"\n[CRITICAL ERROR DURING RUN] {e}\n")
            exit_code = 1
        finally:
            sys.stdout = orig_stdout
            sys.stderr = orig_stderr
            log_f.flush()

    sys.exit(exit_code)

if __name__ == "__main__":
    main()
