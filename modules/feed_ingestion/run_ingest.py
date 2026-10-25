"""
Main Runner for NeXus Feed Ingestion & HITL Radar
Executes feeds query (EQS News DACH, UK RNS, Swiss SHAB),
filters signals via keyword scoring, stores qualified triggers in inbox as PENDING_REVIEW,
and dispatches mobile Telegram alerts.
"""

import os
import sys
import argparse
from datetime import datetime

# Windows console cp1252 safety
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from modules.feed_ingestion.config import FEED_SOURCES
    from modules.feed_ingestion.sources.dach_eqs import fetch_eqs_feed
    from modules.feed_ingestion.sources.uk_rns import fetch_uk_rns_feed
    from modules.feed_ingestion.sources.swiss_shab import fetch_swiss_shab_feed
    from modules.feed_ingestion.keyword_filter import evaluate_signal
    from modules.feed_ingestion.db_client import SupabaseClient
    from modules.feed_ingestion.telegram_notifier import send_telegram_alert
except ImportError:
    from .config import FEED_SOURCES
    from .sources.dach_eqs import fetch_eqs_feed
    from .sources.uk_rns import fetch_uk_rns_feed
    from .sources.swiss_shab import fetch_swiss_shab_feed
    from .keyword_filter import evaluate_signal
    from .db_client import SupabaseClient
    from .telegram_notifier import send_telegram_alert

def run_ingestion(dry_run=False):
    print("=" * 70)
    print("🚀 NEXUS RADAR FEED INGESTION & HITL PIPELINE")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Mode: {'DRY RUN (Keine DB-Schreibvorgänge)' if dry_run else 'LIVE INGEST (Posteingang / Zur Prüfung)'}")
    print("=" * 70)

    db = None
    if not dry_run:
        try:
            db = SupabaseClient()
            print("✅ Supabase REST Client erfolgreich initialisiert.")
        except Exception as e:
            print(f"❌ Fehler bei Supabase Initialisierung: {e}")
            return 1

    all_raw_items = []

    # 1. Fetch DACH - EQS News
    if FEED_SOURCES.get("eqs_news_dach", {}).get("enabled"):
        print("\n📡 [1/3] Frage DACH Pflichtmitteilungen & Corporate Feeds ab (EQS News)...")
        eqs_items = fetch_eqs_feed(FEED_SOURCES["eqs_news_dach"]["url"])
        print(f"   -> {len(eqs_items)} Meldungen von EQS News empfangen.")
        all_raw_items.extend(eqs_items)

    # 2. Fetch UK - RNS
    if FEED_SOURCES.get("uk_rns", {}).get("enabled"):
        print("\n📡 [2/3] Frage UK London Stock Exchange Regulatory News Service (RNS) ab...")
        rns_items = fetch_uk_rns_feed(FEED_SOURCES["uk_rns"]["url"])
        print(f"   -> {len(rns_items)} Meldungen von UK RNS empfangen.")
        all_raw_items.extend(rns_items)

    # 3. Fetch Swiss - SHAB
    if FEED_SOURCES.get("swiss_shab", {}).get("enabled"):
        print("\n📡 [3/3] Frage Schweizerische Handels- und Finanz-Feeds (SHAB Mutationen) ab...")
        shab_items = fetch_swiss_shab_feed(FEED_SOURCES["swiss_shab"]["url"])
        print(f"   -> {len(shab_items)} Meldungen von Schweizer Feeds empfangen.")
        all_raw_items.extend(shab_items)

    print(f"\n📊 Insgesamt {len(all_raw_items)} Rohmeldungen aus den Feeds aggregiert.")
    print("-" * 70)
    print("🔍 Starte Keyword-Filterung & Relevanz-Scoring...")

    matched_signals = []
    inserted_signals = []
    skipped_duplicates = 0

    for item in all_raw_items:
        eval_result = evaluate_signal(item)
        if eval_result:
            matched_signals.append((item, eval_result))
            print(f"\n🎯 SIGNAL GEFUNDEN: [{eval_result['prio']}] {eval_result['category']}")
            print(f"   Unternehmen: {item.get('company', 'N/A')}")
            print(f"   Titel:       {item.get('title', '')[:80]}")
            print(f"   Matches:     {', '.join(eval_result['matched_keywords'])}")
            print(f"   Score:       {int(eval_result['confidence_score'] * 100)}% ({eval_result['relevance_logic']})")

            if not dry_run and db:
                record, status = db.insert_opportunity(item, eval_result)
                if status == "INSERTED":
                    print(f"   -> 📥 Im Posteingang (PENDING_REVIEW) abgelegt. ID: {record.get('id')}")
                    inserted_signals.append({
                        'id': record.get('id'),
                        'company': item.get('company'),
                        'title': item.get('title'),
                        'category': eval_result['category'],
                        'prio': eval_result['prio'],
                        'source': item.get('url')
                    })
                elif status == "DUPLICATE":
                    print("   -> ⏩ Duplikat bereits in NeXus vorhanden (übersprungen).")
                    skipped_duplicates += 1
                else:
                    print(f"   -> ⚠️ Speichern fehlgeschlagen: {status}")

    print("\n" + "=" * 70)
    print("📈 ZUSAMMENFASSUNG INGESTION-LAUF")
    print(f"• Analysierte Feed-Einträge:       {len(all_raw_items)}")
    print(f"• Relevante Signale identifiziert: {len(matched_signals)}")
    if dry_run:
        print(f"• Simulierte Inbox-Speicherungen:  {len(matched_signals)} (Dry Run)")
    else:
        print(f"• Neu in Inbox (PENDING_REVIEW):   {len(inserted_signals)}")
        print(f"• Bereits vorhandene Duplikate:    {skipped_duplicates}")
    print("=" * 70)

    # Mobile Telegram Alert wenn neue Signale erfasst wurden
    if inserted_signals:
        print("\n📲 Sende Handy-Alarm via Telegram...")
        send_telegram_alert(inserted_signals)
    elif dry_run and matched_signals:
        print("\n📲 [Dry Run] Telegram-Alarm würde für", len(matched_signals), "Signale ausgelöst.")

    return 0

def main():
    parser = argparse.ArgumentParser(description="NeXus Feed Ingestion & HITL Radar")
    parser.add_argument("--dry-run", action="store_true", help="Filter ausführen ohne in Supabase zu speichern")
    args = parser.parse_args()

    sys.exit(run_ingestion(dry_run=args.dry_run))

if __name__ == "__main__":
    main()
