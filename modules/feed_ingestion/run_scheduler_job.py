"""
Automated Background Runner for NeXus Feed Ingestion
Executed on schedule (e.g. every 3 hours via Windows Task Scheduler).
Redirects execution output to modules/feed_ingestion/logs/ingest.log and rotates logs.
"""

import os
import sys
from datetime import datetime, timezone

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

LOG_DIR = os.path.join(PROJECT_ROOT, "modules", "feed_ingestion", "logs")
LOG_FILE = os.path.join(LOG_DIR, "ingest.log")

def rotate_log_if_needed(max_bytes=5 * 1024 * 1024):
    """Keep log file under max_bytes by truncating older lines if necessary."""
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > max_bytes:
            with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            # Keep last 2000 lines
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.writelines(lines[-2000:])
    except Exception as e:
        sys.stderr.write(f"Log rotation error: {e}\n")

def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    rotate_log_if_needed()

    from modules.feed_ingestion.run_ingest import run_ingestion

    with open(LOG_FILE, "a", encoding="utf-8") as log_f:
        header = f"\n\n{'#' * 75}\n[SCHEDULER RUN] {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n{'#' * 75}\n"
        log_f.write(header)
        log_f.flush()

        # Redirect stdout and stderr to the log file during the run
        orig_stdout = sys.stdout
        orig_stderr = sys.stderr
        sys.stdout = log_f
        sys.stderr = log_f

        try:
            exit_code = run_ingestion(dry_run=False, skip_cleanup=False)
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
