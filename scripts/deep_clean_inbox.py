import os
import sys
import json
import re
import urllib.request
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from modules.feed_ingestion.db_client import SupabaseClient

client = SupabaseClient()

def patch_opp(opp_id, updates):
    try:
        req = urllib.request.Request(
            f"{client.base_rest}/nexus_opportunities?id=eq.{opp_id}",
            data=json.dumps(updates).encode('utf-8'),
            headers=client._headers(return_rep=False),
            method='PATCH'
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            return True
    except Exception as e:
        print(f"Error patching {opp_id}: {e}")
        return False

# Load all pending opportunities
req = urllib.request.Request(
    f"{client.base_rest}/nexus_opportunities?select=id,title,situation,source,priority,tags&review_status=in.(pending,PENDING_REVIEW,unreviewed)&limit=300",
    headers=client._headers()
)
with urllib.request.urlopen(req) as resp:
    pending_items = json.loads(resp.read().decode('utf-8'))

print(f"Lade {len(pending_items)} verbleibende Einträge im Posteingang...")

# Strict Corporate Whitelist / Micro-Business & Junk Blacklist:
# Rejects:
# - Micro-entities: Sagl, Sàrl, Einzelfirmen, Ateliers, Kioske, Hotels, Reinigungsdienste, Vereine, Stiftungen
# - Academic/Research papers without corporate management
# - Pure shell/crypto/dummy names
# - Routine investor announcements without corporate leadership vacancies

micro_junk_patterns = [
    (r'\b(sagl|sàrl|sarl|e\.k\.|gbr|ug \(haftungsbeschränkt\)|atelier|nettoyages?|hotel|restaurant|pneus|vending|cleaning)\b', 'Kleinstgewerbe / lokaler Handwerksbetrieb / Sàrl / Sagl ohne Mandatsrelevanz'),
    (r'\b(forschungsergebnisse|education center|tibetan medicine|forschungszentrum|stiftung|association|verein)\b', 'Forschungs-, Bildungs- oder Vereinsmeldung ohne privatwirtschaftliches Organmandat'),
    (r'\b(voxnexus ai|widgets & web)\b', 'Test- / Dummy-Eintrag'),
]

corporate_whitelist_regex = r'\b(ag|se|plc|sa|nv|corp|kgaa|inc|spa)\b'

now_iso = datetime.now(timezone.utc).isoformat()
discarded = []
kept_tier1 = []
kept_tier2 = []

for opp in pending_items:
    opp_id = opp.get('id')
    title = opp.get('title', '')
    situation = opp.get('situation', '')
    full_text = f"{title} {situation}".lower()

    # 1. Micro-junk check
    matched_junk = None
    for pattern, reason in micro_junk_patterns:
        if re.search(pattern, full_text):
            matched_junk = reason
            break

    if matched_junk:
        updates = {
            'review_status': 'rejected',
            'review_notes': f"[DealCoach Gate 0]: Automatisch ausgesondert - {matched_junk}",
            'reviewed_at': now_iso,
            'tags': list(set(list(opp.get('tags') or []) + ['Gate0_Filtered', 'Non_Corporate', 'Auto_Discarded']))
        }
        patch_opp(opp_id, updates)
        discarded.append((title, matched_junk))
        print(f"❌ AUSGESONDERT: {title[:70]} -> {matched_junk}")
        continue

    # 2. Check if Corporate Form or Executive Role exists
    is_corp = bool(re.search(corporate_whitelist_regex, full_text))
    has_exec = bool(re.search(r'\b(vorstand|geschäftsführ|ceo|cfo|cro|coo|amtsniederlegung|rücktritt|niederlegung|restrukturierung|sanierung|insolvenz|aufsichtsrat|supervisory board|board of directors)\b', full_text))

    if is_corp and has_exec:
        tier = 'TIER_1_TOP'
        kept_tier1.append(title)
        updates = {
            'priority': tier,
            'tags': list(set(list(opp.get('tags') or []) + ['TIER_1_TOP', 'Vetted_Corporate']))
        }
        patch_opp(opp_id, updates)
        print(f"👑 TIER 1 TOP: {title[:70]}")
    elif is_corp or has_exec:
        tier = 'TIER_2_MID'
        kept_tier2.append(title)
        updates = {
            'priority': tier,
            'tags': list(set(list(opp.get('tags') or []) + ['TIER_2_MID', 'Vetted_Corporate']))
        }
        patch_opp(opp_id, updates)
        print(f"🏢 TIER 2 MID: {title[:70]}")
    else:
        # If neither corporate form nor executive keyword exists, it is noise! Discard it!
        updates = {
            'review_status': 'rejected',
            'review_notes': "[DealCoach Gate 0]: Automatisch ausgesondert - Keine Kapitalgesellschaft und kein C-Level Mandatsanlass nachweisbar",
            'reviewed_at': now_iso,
            'tags': list(set(list(opp.get('tags') or []) + ['Gate0_Filtered', 'No_Mandate_Potential']))
        }
        patch_opp(opp_id, updates)
        discarded.append((title, 'Keine Kapitalgesellschaft / kein Organanlass'))
        print(f"❌ AUSGESONDERT: {title[:70]} -> Kein Organanlass")

print("\n" + "=" * 60)
print(f"BEREINIGUNG ABGESCHLOSSEN:")
print(f"• Ausgesondert (Gate 0 Müllschlucker): {len(discarded)}")
print(f"• Echte Mandats-Kandidaten im Posteingang: {len(kept_tier1) + len(kept_tier2)}")
print(f"  - 👑 Tier 1 Top (Großunternehmen / Organvakanzen): {len(kept_tier1)}")
print(f"  - 🏢 Tier 2 Mid (Gehobener Mittelstand / Boutiquen): {len(kept_tier2)}")
print("=" * 60)
