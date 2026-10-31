import sys
import os
import json
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.db_client import SupabaseClient

def main():
    cli = SupabaseClient()
    headers = cli._headers()
    
    # Opportunities
    url_opps = f"{cli.base_rest}/nexus_opportunities?select=id,title,review_status,pipeline_stage,priority,created_at,source,situation&order=created_at.desc&limit=200"
    req_opps = urllib.request.Request(url_opps, headers=headers)
    try:
        with urllib.request.urlopen(req_opps) as resp:
            opps = json.loads(resp.read().decode('utf-8'))
            print(f"=== GESAMT OPPORTUNITIES IN DB: {len(opps)} ===")
            
            pending = [o for o in opps if o.get('review_status') in ('pending', 'unreviewed', 'PENDING_REVIEW')]
            verified = [o for o in opps if o.get('review_status') == 'verified']
            rejected = [o for o in opps if o.get('review_status') == 'rejected']
            
            print(f"Status-Verteilung: {len(pending)} PENDING | {len(verified)} VERIFIED | {len(rejected)} REJECTED\n")
            
            print("--- PENDING / UNREVIEWED OPPORTUNITIES (POSTEINGANG) ---")
            for o in pending:
                print(f"[{o.get('id')[:8]}] [{o.get('review_status')}] [{o.get('priority')}] {o.get('title')}")
                
            print("\n--- VERIFIED OPPORTUNITIES ---")
            for o in verified:
                print(f"[{o.get('id')[:8]}] [{o.get('review_status')}] [{o.get('priority')}] {o.get('title')}")
                
            print("\n--- SUCHE NACH SPEZIFISCHEN FÄLLEN (CATNOIR, SOLARWORLD, KRANBAU, HANSEATIC, QUANTEN) ---")
            for o in opps:
                t = (o.get('title') or '') + ' ' + (o.get('situation') or '')
                for target in ['CATNOIR', 'SolarWorld', 'Kranbau', 'Hanseatic', 'Quanten-Technologie', 'cosquare']:
                    if target.lower() in t.lower():
                        print(f"-> GEFUNDEN in nexus_opportunities: {target} | ID: {o.get('id')} | Status: {o.get('review_status')} | Title: {o.get('title')}")

    except Exception as e:
        print("Fehler beim Abrufen von nexus_opportunities:", e)

    # Suche in Trigger Events
    url_trig = f"{cli.base_rest}/nexus_trigger_events?select=id,title,signal_type,company_name,source,created_at&order=created_at.desc&limit=200"
    req_trig = urllib.request.Request(url_trig, headers=headers)
    try:
        with urllib.request.urlopen(req_trig) as resp:
            trigs = json.loads(resp.read().decode('utf-8'))
            print(f"\n=== GESAMT TRIGGER EVENTS IN DB: {len(trigs)} ===")
            for t in trigs:
                cname = t.get('company_name') or ''
                title = t.get('title') or ''
                for target in ['CATNOIR', 'SolarWorld', 'Kranbau', 'Hanseatic', 'Quanten-Technologie', 'cosquare']:
                    if target.lower() in (cname + ' ' + title).lower():
                        print(f"-> GEFUNDEN in nexus_trigger_events: {target} | ID: {t.get('id')} | Company: {cname} | Signal: {t.get('signal_type')} | Title: {title}")
    except Exception as e:
        print("Fehler beim Abrufen von nexus_trigger_events:", e)

if __name__ == '__main__':
    main()
