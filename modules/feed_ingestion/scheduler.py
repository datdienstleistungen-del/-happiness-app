"""
NeXus Continuous Ingestion Radar Daemon / Scheduler
Executes run_ingestion() every 3 hours (10,800 seconds) in an infinite, fault-tolerant loop.
Logs output and lead statistics directly to modules/feed_ingestion/ingest.log (and logs/ingest.log).
Guaranteed resilience: Catches network errors, HTTP timeouts, and unexpected exceptions without crashing.
"""

import os
import sys
import time
import argparse
from datetime import datetime, timezone

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE_MAIN = os.path.join(MODULE_DIR, "ingest.log")
LOG_DIR_SUB = os.path.join(MODULE_DIR, "logs")
LOG_FILE_SUB = os.path.join(LOG_DIR_SUB, "ingest.log")

INTERVAL_SECONDS = 3 * 60 * 60  # 10,800 seconds (3 hours)
MAX_LOG_SIZE = 5 * 1024 * 1024   # 5 MB log limit per file

def rotate_log_if_needed(file_path):
    """Truncate log file keeping last 2000 lines if it exceeds MAX_LOG_SIZE."""
    try:
        if os.path.exists(file_path) and os.path.getsize(file_path) > MAX_LOG_SIZE:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(lines[-2000:])
    except Exception as e:
        sys.stderr.write(f"Log rotation warning for {file_path}: {e}\n")

class MultiLogger:
    """Writes output simultaneously to terminal (if present) and log files."""
    def __init__(self, *files):
        self.files = files
        self.orig_stdout = sys.stdout

    def write(self, message):
        try:
            self.orig_stdout.write(message)
            self.orig_stdout.flush()
        except Exception:
            pass
        for f in self.files:
            try:
                f.write(message)
                f.flush()
            except Exception:
                pass

    def flush(self):
        try:
            self.orig_stdout.flush()
        except Exception:
            pass
        for f in self.files:
            try:
                f.flush()
            except Exception:
                pass

def execute_ingestion_cycle(iteration_num=1):
    """Executes a single protected ingestion cycle."""
    os.makedirs(LOG_DIR_SUB, exist_ok=True)
    rotate_log_if_needed(LOG_FILE_MAIN)
    rotate_log_if_needed(LOG_FILE_SUB)

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    header = (
        f"\n\n{'=' * 75}\n"
        f"🚀 [NEXUS RADAR SCHEDULER CYCLE #{iteration_num}] {now_utc}\n"
        f"Cadence: Every 3 hours (10,800s) | Target: Pan-European C-Level Vacancies (<=48h)\n"
        f"{'=' * 75}\n"
    )

    with open(LOG_FILE_MAIN, "a", encoding="utf-8") as f_main, \
         open(LOG_FILE_SUB, "a", encoding="utf-8") as f_sub:
        
        logger = MultiLogger(f_main, f_sub)
        logger.write(header)

        # Temporarily redirect stdout and stderr to the dual logger
        orig_stdout = sys.stdout
        orig_stderr = sys.stderr
        sys.stdout = logger
        sys.stderr = logger

        exit_code = 0
        try:
            from modules.feed_ingestion.run_ingest import run_ingestion
            exit_code = run_ingestion(dry_run=False, skip_cleanup=False)
            logger.write(f"\n[{datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}] ✅ Ingestion-Zyklus #{iteration_num} erfolgreich beendet (ExitCode {exit_code}).\n")
        except Exception as e:
            import traceback
            err_msg = f"\n[{datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}] ⚠️ Ausnahmefehler während Zyklus #{iteration_num}: {e}\n{traceback.format_exc()}\n"
            logger.write(err_msg)
            exit_code = 1
        finally:
            sys.stdout = orig_stdout
            sys.stderr = orig_stderr

    return exit_code

def run_daemon(interval=INTERVAL_SECONDS):
    """Runs the scheduler continuously every `interval` seconds."""
    print("=" * 75)
    print("🛰️  NEXUS CONTINUOUS RADAR SCHEDULER DAEMON GESTARTET")
    print(f"Intervall:       {interval} Sekunden ({interval // 3600} Stunden)")
    print(f"Zentrales Log:   {LOG_FILE_MAIN}")
    print(f"Start-Zeit:      {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("Beenden mit:     STRG + C")
    print("=" * 75)

    iteration = 1
    while True:
        try:
            print(f"\n[DAEMON] Starte Durchlauf #{iteration} um {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}...")
            execute_ingestion_cycle(iteration_num=iteration)
            iteration += 1

            next_run = datetime.now(timezone.utc).timestamp() + interval
            next_run_str = datetime.fromtimestamp(next_run, tz=timezone.utc).strftime('%H:%M:%S UTC')
            print(f"[DAEMON] Zyklus beendet. Nächster Durchlauf in {interval}s um {next_run_str}.")
            
            # Ausfallsicherer Sleep mit Unterbrechungs-Check
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[DAEMON] Beendigung durch Benutzer (KeyboardInterrupt). Auf Wiedersehen.")
            break
        except Exception as e:
            # Fatal daemon protection: never crash completely on unexpected OS/threading errors
            sys.stderr.write(f"\n[DAEMON FATAL RECOVERY] Unerwarteter Fehler in der Daemon-Schleife: {e}\n")
            time.sleep(60)

def main():
    parser = argparse.ArgumentParser(description="NeXus Feed Ingestion Scheduler Daemon")
    parser.add_argument("--once", action="store_true", help="Führe nur einen einzelnen Ingestion-Durchlauf aus und beende dann.")
    parser.add_argument("--interval", type=int, default=INTERVAL_SECONDS, help="Intervall in Sekunden (Standard: 10800 = 3h).")
    args = parser.parse_args()

    if args.once:
        print("[SCHEDULER] Einzelner Testlauf wird gestartet...")
        code = execute_ingestion_cycle(iteration_num=1)
        sys.exit(code)
    else:
        run_daemon(interval=args.interval)

if __name__ == "__main__":
    main()
