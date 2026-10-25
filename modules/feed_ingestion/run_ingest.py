"""
Main Runner for NeXus Pan-European Feed Ingestion & HITL Radar
Focus: C-Level & Board Vacancies across Europe (Max 48h freshness)
Sources:
- DACH: EQS News & Corporate Ad-hoc Disclosures
- UK: London Stock Exchange Regulatory News Service (RNS)
- CH: Swiss SHAB Mutationen & Leadership changes
- EU: Spain (CNMV), France (AMF/Euronext), Pan-EU (Euronext/BusinessWire)
"""

import os
import sys
import argparse
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

try:
    from modules.feed_ingestion.config import FEED_SOURCES, MAX_AGE_HOURS
    from modules.feed_ingestion.sources.dach_eqs import fetch_eqs_feed
    from modules.feed_ingestion.sources.uk_rns import fetch_uk_rns_feed
    from modules.feed_ingestion.sources.swiss_shab import fetch_swiss_shab_feed
    from modules.feed_ingestion.sources.eu_markets import fetch_eu_markets_feeds
    from modules.feed_ingestion.keyword_filter import evaluate_signal
    from modules.feed_ingestion.gatekeeper import verify_mandate_signal_llm
    from modules.feed_ingestion.db_client import SupabaseClient
    from modules.feed_ingestion.telegram_notifier import send_telegram_alert
except ImportError:
    from .config import FEED_SOURCES, MAX_AGE_HOURS
    from .sources.dach_eqs import fetch_eqs_feed
    from .sources.uk_rns import fetch_uk_rns_feed
    from .sources.swiss_shab import fetch_swiss_shab_feed
    from .sources.eu_markets import fetch_eu_markets_feeds
    from .keyword_filter import evaluate_signal
    from .gatekeeper import verify_mandate_signal_llm
    from .db_client import SupabaseClient
    from .telegram_notifier import send_telegram_alert

def run_ingestion(dry_run=False, skip_cleanup=False):
    print("=" * 75)
    print("🚀 NEXUS PAN-EUROPEAN C-LEVEL & BOARD VACANCY RADAR (MAX 48H)")
    print(f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Mode: {'DRY RUN (Keine DB-Schreibvorgänge)' if dry_run else 'LIVE INGEST (Posteingang / Zur Prüfung)'}")
    print("=" * 75)

    db = None
    if not dry_run:
        try:
            db = SupabaseClient()
            print("✅ Supabase REST Client erfolgreich initialisiert.")
        except Exception as e:
            print(f"❌ Fehler bei Supabase Initialisierung: {e}")
            return 1

    # 1. BEREINIGUNG: Alte Pending-Einträge (>48h / Rauschen wie Misenso, Aluwag) löschen
    deleted_stale_count = 0
    if not dry_run and db and not skip_cleanup:
        print("\n🧹 [1/5] Bereinige veraltete Pending-Einträge (>48h & Alt-Konkurse) im Posteingang...")
        deleted_stale_count, deleted_titles = db.cleanup_stale_pending_opportunities(max_hours=MAX_AGE_HOURS)
        print(f"   -> {deleted_stale_count} veraltete/irrelevante Einträge aus Posteingang gelöscht.")
        if deleted_titles:
            for dt in deleted_titles[:3]:
                print(f"      - Gelöscht: {dt[:80]}")
            if len(deleted_titles) > 3:
                print(f"      ... und {len(deleted_titles) - 3} weitere gelöscht.")

    all_fresh_items = []
    total_dropped_age = 0
    total_raw_loaded = 0

    # 2. DACH - EQS News & Ad-hoc
    if FEED_SOURCES.get("eqs_news_dach", {}).get("enabled"):
        print("\n📡 [2/5] DACH: Frage EQS News & Corporate Ad-hoc Feeds ab...")
        dach_items, dach_dropped = fetch_eqs_feed(FEED_SOURCES["eqs_news_dach"]["url"])
        total_raw_loaded += len(dach_items) + dach_dropped
        total_dropped_age += dach_dropped
        print(f"   -> {len(dach_items)} frische Meldungen empfangen ({dach_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(dach_items)

    # 3. UK - LSE RNS
    if FEED_SOURCES.get("uk_rns", {}).get("enabled"):
        print("\n📡 [3/5] UK: Frage London Stock Exchange RNS (Executive Moves & Board Changes) ab...")
        rns_items, rns_dropped = fetch_uk_rns_feed(FEED_SOURCES["uk_rns"]["url"])
        total_raw_loaded += len(rns_items) + rns_dropped
        total_dropped_age += rns_dropped
        print(f"   -> {len(rns_items)} frische Meldungen empfangen ({rns_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(rns_items)

    # 4. CH - SHAB Mutationen & Leadership
    if FEED_SOURCES.get("swiss_shab", {}).get("enabled"):
        print("\n📡 [4/5] CH: Frage Schweizer SHAB & Handelsregister Mutationen (Führung & Organe) ab...")
        shab_items, shab_dropped = fetch_swiss_shab_feed(FEED_SOURCES["swiss_shab"]["url"])
        total_raw_loaded += len(shab_items) + shab_dropped
        total_dropped_age += shab_dropped
        print(f"   -> {len(shab_items)} frische Meldungen empfangen ({shab_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(shab_items)

    # 5. Pan-European Markets: ES, FR, Pan-EU
    print("\n📡 [5/5] EU: Frage paneuropäische Pflichtmitteilungen (Spanien CNMV, Frankreich AMF, Euronext/BusinessWire) ab...")
    eu_items, eu_dropped = fetch_eu_markets_feeds()
    total_raw_loaded += len(eu_items) + eu_dropped
    total_dropped_age += eu_dropped
    print(f"   -> {len(eu_items)} frische Meldungen empfangen ({eu_dropped} wegen Alter >48h verworfen).")
    all_fresh_items.extend(eu_items)

    print("\n" + "-" * 75)
    print(f"📊 INGESTION STATISTIK (ZEITFILTER <= {MAX_AGE_HOURS}H):")
    print(f"• Rohmeldungen aus Feeds geladen:             {total_raw_loaded}")
    print(f"• Wegen Alter (>48h) sofort verworfen (Drop): {total_dropped_age}")
    print(f"• Tagesaktuelle Meldungen im Zeitfenster:     {len(all_fresh_items)}")
    print("-" * 75)
    print("🔍 Starte Scoring: C-Level & Board Vacancies (ORGANVAKANZEN & LEADERSHIP)...")

    matched_signals = []
    inserted_signals = []
    skipped_duplicates = 0

    for item in all_fresh_items:
        eval_result = evaluate_signal(item)
        if not eval_result:
            continue

        print(f"\n🎯 STUFE 1 TREFFER: [{eval_result['prio']}] {eval_result['category']}")
        print(f"   Unternehmen: {item.get('company', 'N/A')} ({item.get('region', 'EU')})")
        print(f"   Titel:       {item.get('title', '')[:85]}")

        # STUFE 2: LLM Gatekeeper (Mistral / OpenRouter Free-Tier)
        print("   -> 🤖 Prüfe mit Stufe 2 (LLM-Gatekeeper)...")
        is_valid, reason, llm_data = verify_mandate_signal_llm(item, eval_result)
        if not is_valid:
            print(f"   -> 🛑 STUFE 2 DROP (LLM-Gatekeeper): {reason}")
            continue

        # Extrahierte saubere Fakten aus Stufe 2 übernehmen
        if llm_data:
            if llm_data.get('company_name'):
                item['company'] = llm_data['company_name']
            if llm_data.get('role'):
                item['role'] = llm_data['role']
            if llm_data.get('person_name'):
                item['person'] = llm_data['person_name']
            if llm_data.get('event_type'):
                eval_result['event_type'] = llm_data['event_type']
            if llm_data.get('confidence'):
                eval_result['confidence_score'] = round(float(llm_data['confidence']), 2)

        print(f"   -> ✅ STUFE 2 BESTANDEN: {item.get('company')} | {item.get('role', '')} | {item.get('person', '')} ({int(eval_result['confidence_score'] * 100)}%)")
        matched_signals.append((item, eval_result))

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
                print("   -> ⏩ Duplikat bereits in NeXus erfasst (übersprungen).")
                skipped_duplicates += 1
            else:
                print(f"   -> ⚠️ Speichern fehlgeschlagen: {status}")

    print("\n" + "=" * 75)
    print("📈 FINALE ZUSAMMENFASSUNG DES RADAR-LAUFS")
    print(f"• Rohmeldungen insgesamt geladen:            {total_raw_loaded}")
    print(f"• Wegen Alter (>48h) verworfen:              {total_dropped_age}")
    print(f"• Echte C-Level & Board Vakanzen (<=48h):    {len(matched_signals)}")
    if not dry_run and not skip_cleanup:
        print(f"• Bereinigte Alt-Einträge im Posteingang:    {deleted_stale_count}")
    if dry_run:
        print(f"• Simulierte Inbox-Speicherungen:            {len(matched_signals)} (Dry Run)")
    else:
        print(f"• Neu in Inbox (PENDING_REVIEW) gespeichert: {len(inserted_signals)}")
        print(f"• Bereits vorhandene Duplikate:              {skipped_duplicates}")
    print("=" * 75)

    if matched_signals:
        print("\n📋 QUALIFIZIERTE C-LEVEL- & FÜHRUNGSVAKANZEN DER LETZTEN 24-48 STUNDEN:")
        for idx, (item, eval_res) in enumerate(matched_signals, 1):
            print(f"{idx}. [{item.get('region', 'EU')}] {item.get('company', 'Unternehmen')}: {item.get('title', '')[:80]}")
            print(f"   Treffer: {', '.join(eval_res['matched_keywords'])} | Relevanz: {eval_res['strategic_angle']}")

    # Mobile Telegram Alert wenn neue Signale erfasst wurden
    if inserted_signals:
        print("\n📲 Sende Handy-Alarm via Telegram...")
        send_telegram_alert(inserted_signals)
    elif dry_run and matched_signals:
        print("\n📲 [Dry Run] Telegram-Alarm würde für", len(matched_signals), "Signale ausgelöst.")

    return 0

def main():
    parser = argparse.ArgumentParser(description="NeXus Pan-European C-Level Feed Ingestion & HITL Radar")
    parser.add_argument("--dry-run", action="store_true", help="Filter ausführen ohne in Supabase zu speichern")
    parser.add_argument("--skip-cleanup", action="store_true", help="Bereinigung alter Pending-Einträge überspringen")
    args = parser.parse_args()

    sys.exit(run_ingestion(dry_run=args.dry_run, skip_cleanup=args.skip_cleanup))

if __name__ == "__main__":
    main()
