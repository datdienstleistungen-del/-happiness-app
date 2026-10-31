import os
import sys
import json
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.config import DEFAULT_USER_ID
from modules.feed_ingestion.db_client import SupabaseClient

def main():
    db = SupabaseClient()
    url = f"{db.base_rest}/nexus_opportunities?user_id=eq.{DEFAULT_USER_ID}&select=id,title,review_status,lead_score,priority,created_at,source,nexus_companies(name)&order=created_at.desc"
    req = urllib.request.Request(url, headers=db._headers())
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    print(f"===========================================================================")
    print(f"📊 LIVE SUPABASE STATUS: nexus_opportunities für Harro ({DEFAULT_USER_ID})")
    print(f"Gesamtanzahl Datensätze: {len(data)}")
    print(f"===========================================================================")
    
    pending = [d for d in data if d.get('review_status') in ('pending', 'PENDING_REVIEW', 'unreviewed')]
    verified = [d for d in data if d.get('review_status') in ('verified', 'reviewed', 'QUALIFIED')]
    rejected = [d for d in data if d.get('review_status') in ('rejected', 'DISMISSED')]

    print(f"📥 Posteingang (pending): {len(pending)}")
    print(f"🎯 Pipeline (verified):   {len(verified)}")
    print(f"❌ Verworfen (rejected):  {len(rejected)}")
    print(f"---------------------------------------------------------------------------")

    for idx, d in enumerate(pending, 1):
        comp = d.get('nexus_companies', {}).get('name') if d.get('nexus_companies') else 'N/A'
        title = d.get('title', '')
        score = d.get('lead_score', 0)
        prio = d.get('priority', '')
        print(f"{idx:02d}. [{prio} | Score {score:2d}] {comp}: {title[:65]}")

if __name__ == '__main__':
    main()
