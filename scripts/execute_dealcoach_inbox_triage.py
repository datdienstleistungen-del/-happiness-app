import os
import sys
import urllib.request
import json
import re
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

def patch_opportunity(opp_id, updates):
    try:
        patch_req = urllib.request.Request(
            f"{client.base_rest}/nexus_opportunities?id=eq.{opp_id}",
            data=json.dumps(updates).encode('utf-8'),
            headers=client._headers(return_rep=False),
            method='PATCH'
        )
        with urllib.request.urlopen(patch_req, timeout=8) as resp:
            return True
    except Exception as e:
        print(f"Error patching {opp_id}: {e}")
        return False

# ── 1. FAST-PATH 0 € NOISE REGEX PATTERNS ──
noise_rules = [
    ('DIPLOMATIE_BEHÖRDE_STADT', r'(\.gov\b|\bstädtepartnerschaft\b|\bministry\b|\bbotschaft\b|\bboard of investment\b|\byears of culture\b|\brathaus\b|\bstaatskanzlei\b)', 'Behördliche / diplomatische Mitteilung ohne Unternehmensorgan'),
    ('PR_LIFESTYLE_MUSEUM', r'(\bmuseum\b|\bbeauty\b|\bwinners of the\b|\bsponsoring\b|\bjubiläum\b|\bmesseauftritt\b|\bgolfturnier\b|\bkunstausstellung\b|\bgala\b)', 'Reine PR-, Sponsoring- oder Reputationsmeldung (0 € Mandatswert)'),
    ('ROUTINE_AKTIENRÜCKKAUF', r'(\btransaction in own shares\b|\baktienrückkauf\b)', 'Börsen-Aktienrückkauf (Treasury) ohne Organvakanz'),
    ('ROUTINE_STIMMRECHTE', r'(\bstimmrechtsanteile\b|\bmajor shareholding\b|\bholding\(?s\)? in company\b|\btotal voting rights\b|\bnotification of major\b)', 'Passive Stimmrechtsmitteilung (§§ 33 ff. WpHG) ohne Personalwechsel'),
    ('ROUTINE_DIRECTOR_DEALINGS', r'(\bdirector/pdmr\b|\bpdmr shareholding\b|\bmanager transactions?\b)', 'Eigengeschäft von Führungskräften (Art. 19 MAR) ohne Vakanz'),
    ('ROUTINE_KAPITALMASSNAHME', r'(\bissue of equity\b|\bexercise of warrants\b|\bblock listing\b|\bnet asset value\b|\bnav announcement\b|\bquarterly net asset\b)', 'Technische Kapitalmarktmaßnahme ohne Organvakanz')
]

# ── 2. LOAD ALL PENDING OPPORTUNITIES FROM DB ──
print("📥 Lade unbewertete Meldungen aus dem Posteingang (Supabase)...")
req = urllib.request.Request(
    f"{client.base_rest}/nexus_opportunities?select=id,title,situation,source,priority,tags,lead_score,company_id&review_status=in.(pending,PENDING_REVIEW,unreviewed)&limit=300",
    headers=client._headers()
)
with urllib.request.urlopen(req) as resp:
    pending_items = json.loads(resp.read().decode('utf-8'))

total_count = len(pending_items)
print(f"-> {total_count} Meldungen im Posteingang gefunden.\n")

discarded_noise = []
retained_tier1 = []
retained_tier2 = []
retained_review = []

now_iso = datetime.now(timezone.utc).isoformat()

for idx, opp in enumerate(pending_items, 1):
    opp_id = opp.get('id')
    title = opp.get('title', '')
    situation = opp.get('situation', '')
    source = opp.get('source', '')
    full_text = f"{title} {situation} {source}".lower()

    # Schritt A: Schneller 0 € Schrott-Check
    matched_noise_name = None
    matched_noise_reason = None
    for name, pattern, reason in noise_rules:
        if re.search(pattern, full_text):
            matched_noise_name = name
            matched_noise_reason = reason
            break

    if matched_noise_name:
        # ❌ Sofort als 0 € Rauschen verwerfen
        discard_updates = {
            'review_status': 'rejected',
            'review_notes': f"[DealCoach 0 €-Filter]: Ausgesondert als unwirtschaftliches Rauschen ({matched_noise_reason}) - Revisions-Audit",
            'reviewed_at': now_iso,
            'tags': list(set(list(opp.get('tags') or []) + ['Noise', '0_Euro_Schrott', 'Auto_Discarded']))
        }
        patch_opportunity(opp_id, discard_updates)
        discarded_noise.append((opp, matched_noise_name, matched_noise_reason))
        print(f"[{idx:03d}/{total_count}] ❌ [0 € RAUSCHEN] {title[:65]} -> {matched_noise_name}")
        continue

    # Schritt B: Echter Unternehmens-Aspirant -> Durch DealCoach-Revision jagen
    company_name = title.split(':')[-1].strip() if ':' in title else title
    is_major_corp = bool(re.search(r'\b(ag|se|plc|sa|nv|corp|kgaa)\b', title, re.IGNORECASE))
    has_executive_keyword = bool(re.search(r'\b(vorstand|geschäftsführ|ceo|cfo|cro|coo|amtsniederlegung|rücktritt|niederlegung|restrukturierung|sanierung|aufsichtsrat|supervisory board)\b', full_text))

    if has_executive_keyword and is_major_corp:
        tier = 'TIER_1_TOP'
        retained_tier1.append(opp)
        budget = "180.000 € – 320.000 €"
        verdict = "AKUTER C-LEVEL / ORGAN-MANDATSBEDARF (SPITZEN-PROVIDER)"
    elif has_executive_keyword or is_major_corp:
        tier = 'TIER_2_MID'
        retained_tier2.append(opp)
        budget = "80.000 € – 150.000 €"
        verdict = "OPERATIVER INTERIM- & LEITUNGSBEDARF (BOUTIQUE-POOL)"
    else:
        tier = 'PRÜFUNG_EMPFOHLEN'
        retained_review.append(opp)
        budget = "Auf Anfrage / n.a."
        verdict = "VOREINSCHÄTZUNG DEALCOACH (ZUR PRÜFUNG)"

    # Im Posteingang belassen, aber mit geschärfter Priorität & Audit-Notiz
    opp_updates = {
        'priority': tier,
        'tags': list(set(list(opp.get('tags') or []) + [tier, 'DealCoach_Audited', 'Wirtschaftlichkeits_Geprüft']))
    }
    patch_opportunity(opp_id, opp_updates)
    print(f"[{idx:03d}/{total_count}] 🏢 [{tier:17s}] {title[:65]} (Budget: {budget})")

print("\n" + "=" * 80)
print("📊 ABSCHLUSS-BERICHT: DEALCOACH PROBELAUF & POSTEINGANGS-BEREINIGUNG")
print("=" * 80)
print(f"• Gesamt analysierte Meldungen:         {total_count}")
print(f"• ❌ Ausgesondertes 0 €-Rauschen:      {len(discarded_noise)}  (aus Posteingang in 'Verworfen' verschoben)")
print(f"• 🏢 Verbleibende Mandats-Kandidaten:   {len(retained_tier1) + len(retained_tier2) + len(retained_review)}  (sauber im Posteingang)")
print(f"   👑 Davon TIER 1 TOP (Spitzen-Häuser): {len(retained_tier1)}")
print(f"   🏢 Davon TIER 2 MID (Boutique-Pool):  {len(retained_tier2)}")
print(f"   ⚖️ Davon Prüfung empfohlen:           {len(retained_review)}")
print("=" * 80)
