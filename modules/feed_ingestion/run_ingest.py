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
import re
import json
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
    from modules.feed_ingestion.deal_coach import audit_mandate_lead
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
    from .deal_coach import audit_mandate_lead
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
    if FEED_SOURCES.get("eqs_news_dach", {}).get("enabled", True):
        print("\n📡 [1/4] DACH (EQS): Frage EQS News & Corporate Ad-hoc Feeds ab...")
        url = FEED_SOURCES.get("eqs_news_dach", {}).get("url", "https://www.eqs-news.com/de/rss/")
        dach_items, dach_dropped = fetch_eqs_feed(url)
        total_raw_loaded += len(dach_items) + dach_dropped
        total_dropped_age += dach_dropped
        print(f"   -> {len(dach_items)} frische Meldungen empfangen ({dach_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(dach_items)

    # 3. UK - London Stock Exchange RNS & Investegate
    if FEED_SOURCES.get("uk_rns", {}).get("enabled", True):
        print("\n📡 [2/4] UK (RNS): Frage London Stock Exchange RNS (Executive Moves & Board Changes) ab...")
        url = FEED_SOURCES.get("uk_rns", {}).get("url", "https://www.investegate.co.uk/Rss.aspx")
        rns_items, rns_dropped = fetch_uk_rns_feed(url)
        total_raw_loaded += len(rns_items) + rns_dropped
        total_dropped_age += rns_dropped
        print(f"   -> {len(rns_items)} frische Meldungen empfangen ({rns_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(rns_items)

    # 4. CH - Schweizer SHAB Mutationen & Leadership
    if FEED_SOURCES.get("swiss_shab", {}).get("enabled", True):
        print("\n📡 [3/4] Schweiz (SHAB): Frage Schweizer SHAB & Handelsregister Mutationen (Führung & Organe) ab...")
        url = FEED_SOURCES.get("swiss_shab", {}).get("url")
        shab_items, shab_dropped = fetch_swiss_shab_feed(url)
        total_raw_loaded += len(shab_items) + shab_dropped
        total_dropped_age += shab_dropped
        print(f"   -> {len(shab_items)} frische Meldungen empfangen ({shab_dropped} wegen Alter >48h verworfen).")
        all_fresh_items.extend(shab_items)

    # 5. Südeuropa & EU: Spanien CNMV, Frankreich AMF, Euronext
    print("\n📡 [4/4] Südeuropa / EU (CNMV & AMF): Frage CNMV (Spanien), AMF (Frankreich) und Euronext ab...")
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
    tier1_count = 0
    tier2_count = 0
    tier3_dropped_count = 0
    other_review_count = 0

    # FAST-PATH GATE 0: Müllschlucker für 0 € Rauschen (Städte, Behörden, Kleinstgewerbe, PR)
    GATE0_NOISE_PATTERNS = [
        (r'(\.gov\b|\bstädtepartnerschaft\b|\bministry\b|\bbotschaft\b|\brathaus\b|\bstaatskanzlei\b)', 'Behördliche / diplomatische Mitteilung'),
        (r'(\bmuseum\b|\bbeauty\b|\bwinners of the\b|\bsponsoring\b|\bjubiläum\b|\bmesseauftritt\b|\bgolfturnier\b|\bgala\b)', 'Reine PR-, Sponsoring- oder Reputationsmeldung'),
        (r'(\bsagl\b|\bsàrl\b|\bsarl\b|\be\.k\.\b|\bgbr\b|\bug \(haftungsbeschränkt\)|\batelier\b|\bnettoyages?\b|\bhotel\b|\brestaurant\b|\bpneus\b|\bcleaning\b)', 'Kleinstgewerbe / lokaler Handwerksbetrieb / Sàrl / Sagl'),
        (r'(\bforschungsergebnisse\b|\beducation center\b|\btibetan medicine\b|\bforschungszentrum\b|\bverein\b)', 'Forschungs-, Bildungs- oder Vereinsmeldung ohne Organmandat'),
        (r'(\btransaction in own shares\b|\baktienrückkauf\b|\bstimmrechtsanteile\b|\bmajor shareholding\b|\btotal voting rights\b|\bpdmr shareholding\b|\bdirector/pdmr\b)', 'Passive Börsenroutine / Stimmrechte / Aktienrückkauf'),
    ]

    for idx, item in enumerate(all_fresh_items, 1):
        raw_headline = item.get('title', '')
        raw_snippet = item.get('snippet', '')
        raw_company = item.get('company', '')
        full_text = f"{raw_headline} {raw_snippet} {raw_company}".lower()

        # ── GATE 0: Vorfilterung (Alles Unwirtschaftliche sofort verwerfen) ──
        matched_noise = None
        for pattern, reason in GATE0_NOISE_PATTERNS:
            if re.search(pattern, full_text):
                matched_noise = reason
                break

        if matched_noise:
            print(f"[{idx:02d}/{len(all_fresh_items)}] ❌ [GATE 0 DROP]: {raw_headline[:65]} -> {matched_noise}")
            continue

        # Stufe 1: Struktur-, Substanz- & Rechtsformprüfung
        eval_result = evaluate_signal(item)
        if not eval_result:
            print(f"[{idx:02d}/{len(all_fresh_items)}] ❌ [GATE 0/1 DROP]: Rechtsform, Substanz oder Organrolle nicht erfüllt: {raw_headline[:65]}")
            continue

        print(f"\n[{idx:02d}/{len(all_fresh_items)}] ⚖️ DealCoach-Revision: {item.get('company', 'N/A')} ({item.get('region', 'EU')})")
        print(f"   Titel: {item.get('title', '')[:85]}")

        # STUFE 2: DealCoach Automatisierte Revision (Nur für echte Unternehmen)
        is_valid, reason, deal_audit = audit_mandate_lead(item, eval_result)
        if not deal_audit:
            deal_audit = {
                'status': 'pending',
                'tier': 'TIER_2_MID',
                'company_name': item.get('company', ''),
                'audit_rationale': reason or 'Echtes Unternehmen, zur Prüfung im Boutique-Pool vorgelegt.',
                'vacuum_check': 'Organprüfung erforderlich',
                'urgency_check': 'Manuelle Prüfung erforderlich',
                'audit_verdict': 'QUALIFIZIERT_MANDATSBEDARF',
                'estimated_budget': '-',
                'confidence': 0.75
            }

        # ── K.O.-DROP CHECK (TIER 3 / DISCARDED) ──
        if not is_valid or deal_audit.get('status') == 'discarded' or deal_audit.get('tier') == 'TIER_3':
            tier3_dropped_count += 1
            rej_reason = deal_audit.get('rejection_reason') or reason
            print(f"   ❌ [K.O. FILTER DROP / TIER 3]: {item.get('company')} -> {rej_reason}")
            print(f"      • Begründung: {deal_audit.get('audit_rationale', 'Ausgesondert')[:100]}")
            continue

        raw_tier = deal_audit.get('tier', 'TIER_2_MID')
        if raw_tier in ('TIER_1_TOP', 'TIER_1'):
            tier = 'TIER_1_TOP'
            tier1_count += 1
        else:
            tier = 'TIER_2_MID'
            tier2_count += 1
            deal_audit['tier'] = tier
            other_review_count += 1

        # Extrahierte Fakten und DealCoach-Audit übernehmen
        if deal_audit.get('company_name'):
            item['company'] = deal_audit['company_name']
        if deal_audit.get('role'):
            item['role'] = deal_audit['role']
        if deal_audit.get('person_name'):
            item['person'] = deal_audit['person_name']
        if deal_audit.get('event_type'):
            eval_result['event_type'] = deal_audit['event_type']
        if deal_audit.get('confidence'):
            eval_result['confidence_score'] = round(float(deal_audit['confidence']), 2)
        if deal_audit.get('event_date'):
            item['event_date'] = deal_audit['event_date']
            eval_result['event_date'] = deal_audit['event_date']

        eval_result['deal_audit'] = deal_audit
        eval_result['tier'] = tier
        eval_result['priority_db'] = tier

        if tier == "TIER_1_TOP":
            dest_desc = "Mandats-Desk (Haupt-Posteingang · TIER 1)"
        elif tier == "TIER_2_MID":
            dest_desc = "Boutique-Pool (Mandats-Archiv · TIER 2)"
        else:
            dest_desc = "Mandats-Desk (Zur Prüfung · Voreinschätzung DealCoach)"

        print(f"   -> 🎯 DEALCOACH VOREINSCHÄTZUNG: [{tier}] -> {dest_desc}")
        print(f"      • Zielgesellschaft: {item.get('company')} | {item.get('role', '')} ({int(eval_result['confidence_score'] * 100)}%)")
        print(f"      • Vakuum-Check:     {deal_audit.get('vacuum_check', 'N/A')}")
        print(f"      • Dringlichkeit:    {deal_audit.get('urgency_check', 'N/A')}")
        print(f"      • Begründung:       {deal_audit.get('audit_rationale', 'N/A')}")
        print(f"      • Budget-Band:      {deal_audit.get('estimated_budget', 'N/A')}")
        matched_signals.append((item, eval_result))

        if not dry_run and db:
            record, status = db.insert_opportunity(item, eval_result, deal_audit=deal_audit)
            if status == "INSERTED":
                print(f"   -> 📥 Erfolgreich in Datenbank gespeichert. ID: {record.get('id')}")
                inserted_signals.append({
                    'id': record.get('id'),
                    'company': item.get('company'),
                    'title': item.get('title'),
                    'category': eval_result['category'],
                    'prio': tier,
                    'tier': tier,
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
    print(f"• Aspiranten im Zeitfenster geprüft:         {len(all_fresh_items)}")
    print(f"• 🏆 TIER_1_TOP (Mandats-Desk Posteingang):  {tier1_count}")
    print(f"• 💎 TIER_2_MID (Boutique-Pool Archiv):       {tier2_count}")
    print(f"• 🗑️ TIER_3 (K.O.-Kriterien / Ausgesondert): {tier3_dropped_count}")
    print(f"• ⚖️ PRÜFUNG_EMPFOHLEN (Zur Prüfung Harro):   {other_review_count}")
    if not dry_run and not skip_cleanup:
        print(f"• Bereinigte Alt-Einträge im Posteingang:    {deleted_stale_count}")
    if dry_run:
        print(f"• Simulierte Inbox-Speicherungen:            {len(matched_signals)} (Dry Run)")
    else:
        print(f"• Neu in Datenbank gespeichert:              {len(inserted_signals)}")
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
    parser.add_argument("--once", action="store_true", help="Einmaliger Ingest-Lauf (Standard)")
    args = parser.parse_args()

    sys.exit(run_ingestion(dry_run=args.dry_run, skip_cleanup=args.skip_cleanup))

if __name__ == "__main__":
    main()
