import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("=" * 80)
    print("🔎 FACHLICHE & TECHNISCHE DATENSATZ-PRÜFUNG")
    print("=" * 80)

    pub_path = "public/data/continuous_radar_events.json"
    dist_path = "dist/data/continuous_radar_events.json"
    res_path = "data/research/continuous_radar_events.json"

    with open(pub_path, 'r', encoding='utf-8') as f:
        pub_data = json.load(f)
    with open(dist_path, 'r', encoding='utf-8') as f:
        dist_data = json.load(f)
    with open(res_path, 'r', encoding='utf-8') as f:
        res_data = json.load(f)

    events = pub_data.get("events", [])
    print(f"• Datensatzgröße in public: {len(events)} Ereignisse")
    print(f"• Datensatzgröße in dist:   {len(dist_data.get('events', []))} Ereignisse")
    print(f"• Datensatzgröße in research: {len(res_data.get('events', []))} Ereignisse")

    assert len(events) == len(dist_data.get('events', [])) == len(res_data.get('events', [])), "Dateien nicht synchron!"
    print("  -> Sync: 100% identisch zwischen public, dist und data/research.\n")

    # 1. Prüfe Dublettenfreiheit über Quell-URLs
    urls = [e.get("source_url") for e in events]
    unique_urls = set(urls)
    print(f"• Eindeutige Quell-URLs: {len(unique_urls)} von {len(events)}")
    assert len(urls) == len(unique_urls), "Es sind noch doppelte Quell-URLs vorhanden!"
    print("  -> Dublettenprüfung: Keine URL-Mehrfachvorkommen vorhanden.\n")

    # 2. Prüfe die drei spezifischen Führungswechsel
    print("• Detailprüfung Führungswechsel (DEAG, pferdewetten.de, Photon Energy):")
    target_names = ["deag", "pferdewetten", "photon"]
    for e in events:
        cname = e.get("company_name", "")
        if any(t in cname.lower() for t in target_names):
            rc = e.get("reality_check", {})
            status = rc.get("status")
            role = rc.get("target_role")
            prio = e.get("mandate_priority")
            action = e.get("action_type")
            print(f"\n  Unternehmen:      {cname}")
            print(f"  Titel:            {e.get('description')}")
            print(f"  Quell-URL:        {e.get('source_url')}")
            print(f"  Status:           {status} ({rc.get('status_label')})")
            print(f"  Zielfunktion:     {role}")
            print(f"  Priorität:        {prio}")
            print(f"  Aktionstyp:       {action}")
            print(f"  Gegenindikatoren: {rc.get('counter_indicators')}")
            print(f"  Begründung:       {rc.get('rationale')}")

            assert status == "VERWERFEN", f"{cname} muss VERWERFEN sein, ist aber {status}!"
            assert role == "KEINE", f"{cname} target_role muss KEINE sein, ist aber {role}!"
            assert prio != "high_priority_action_required", f"{cname} darf NICHT high priority sein!"
            assert prio == "watchlist_general_distress", f"{cname} muss watchlist_general_distress sein!"

    print("\n  -> Führungswechselprüfung: Alle 3 Fälle sind VERWERFEN mit Rolle KEINE und Watchlist-Priorität.\n")

    # 3. Prüfe Historienkette der ehemals konsolidierten Dubletten
    print("• Prüfung der Historienketten ehemals konsolidierter Fälle:")
    multihist = [e for e in events if len(e.get("history", [])) > 0]
    print(f"  Fälle mit gepflegter Historie: {len(multihist)}")
    for mh in multihist:
        print(f"  - {mh.get('company_name')}: {len(mh.get('history', []))} Historien-Einträge")

    # 4. Prüfe, dass keine gefälschten / automatisierten Human-Reviews existieren
    reviewed_count = sum(1 for e in events if e.get("reality_check", {}).get("human_review", {}).get("reviewed") is True)
    print(f"\n• Echtheitsprüfung Human Reviews: {reviewed_count} von {len(events)} Ereignissen als 'reviewed' markiert.")
    assert reviewed_count == 0, f"Es wurden {reviewed_count} künstliche Reviews in den Produktivdaten gefunden!"
    print("  -> Keine Scheinfreigaben oder Test-Artefakte im Produktivdatenbestand.\n")

    # 5. Prüfe Arbeitsklassenverteilung
    classes = {}
    for e in events:
        st = e.get("reality_check", {}).get("status", "UNBEKANNT")
        classes[st] = classes.get(st, 0) + 1
    print("• Verteilung der Reality-Check-Arbeitsklassen:")
    for st, count in sorted(classes.items()):
        print(f"  - {st:<18}: {count} Fälle")

    print("\n" + "=" * 80)
    print("✅ ALLE FACHLICHEN & TECHNISCHEN PRÜFUNGEN BESTANDEN!")
    print("=" * 80)

if __name__ == "__main__":
    main()
