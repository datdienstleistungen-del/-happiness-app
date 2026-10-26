import os
import sys
import json
import re
import ssl
import io
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
import PyPDF2

client = SupabaseClient()
ctx = ssl._create_unverified_context()
headers = {'User-Agent': 'Mozilla/5.0'}

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

req = urllib.request.Request(
    f"{client.base_rest}/nexus_opportunities?select=id,title,situation,source&review_status=in.(pending,PENDING_REVIEW,unreviewed)&limit=100",
    headers=client._headers()
)
with urllib.request.urlopen(req) as resp:
    pending_items = json.loads(resp.read().decode('utf-8'))

print(f"Prüfe und schärfe {len(pending_items)} verbleibende Meldungen mit echten Primärfakten aus PDFs...")

now_iso = datetime.now(timezone.utc).isoformat()
purged_noise = 0
updated_facts = 0

for opp in pending_items:
    opp_id = opp.get('id')
    title = opp.get('title', '')
    source = opp.get('source', '')
    
    m = re.search(r'publications/([a-f0-9\-]+)', source)
    if not m:
        continue
    pub_id = m.group(1)
    pdf_url = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/pdf"
    
    try:
        pdf_bytes = urllib.request.urlopen(urllib.request.Request(pdf_url, headers=headers), context=ctx, timeout=6).read()
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        raw_text = ' '.join(' '.join(page.extract_text().split()) for page in reader.pages)
        lower_text = raw_text.lower()
        
        has_exit = 'ausgeschiedene personen' in lower_text or 'erloschene unterschriften' in lower_text
        has_new = 'eingetragene personen neu' in lower_text or 'neu oder mutierend' in lower_text
        has_organ = bool(re.search(r'\b(verwaltungsrat|geschäftsführ|direktion|vorstand)\b', lower_text))
        is_liquidation = 'in liquidation' in lower_text or 'konkurs' in lower_text
        
        # 1. Reine Adress- / Statutenänderung ohne Organwechsel -> SOFORT VERWERFEN!
        if not has_exit and not is_liquidation:
            patch_data = {
                'review_status': 'rejected',
                'review_notes': '[DealCoach Primär-Filter]: Reine Adress- oder Statutenmutation ohne Organwechsel (0 € Mandatswert)',
                'reviewed_at': now_iso,
                'tags': ['Gate0_Filtered', 'Statuten_Oder_Adresse', 'Zero_Mandate_Value']
            }
            patch_opp(opp_id, patch_data)
            purged_noise += 1
            print(f"❌ AUSGESONDERT (Kein Organwechsel): {title[:65]}")
            continue

        # 2. Organwechsel vorhanden: Extrahiere Fakten
        exit_snippet = ""
        new_snippet = ""
        if 'Ausgeschiedene Personen' in raw_text:
            idx = raw_text.find('Ausgeschiedene Personen')
            sub = raw_text[idx:]
            end_idx = sub.find('Eingetragene Personen') if 'Eingetragene Personen' in sub else sub.find('Tagesregister')
            exit_snippet = sub[:end_idx].strip() if end_idx != -1 else sub[:300].strip()
            
        if 'Eingetragene Personen neu' in raw_text:
            idx2 = raw_text.find('Eingetragene Personen neu')
            sub2 = raw_text[idx2:]
            end_idx2 = sub2.find('Tagesregister')
            new_snippet = sub2[:end_idx2].strip() if end_idx2 != -1 else sub2[:300].strip()

        # Unterscheide: ECHTES VAKUUM (Kein Nachfolger) vs. 1:1 NACHBESETZUNG
        is_pure_vacuum = has_exit and not has_new and has_organ
        
        if is_pure_vacuum:
            tier = 'TIER_1_TOP'
            verdict = 'AKUTES ORGAN-VAKUUM (POSTEN UNBESETZT)'
            vac_text = f"AKUT BESTANDEN: {exit_snippet[:180]} – KEIN Nachfolger im selben Beschluss eingetragen!"
            urg_text = "HOCH: Einzelunterschrift / Organposition vakant. Handlungsbedarf per sofort."
            rat_text = f"Akuter Organ-Vakanzfall: Organmitglied ausgeschieden ohne unmittelbare Nachfolge ({title}). Unmittelbarer Besetzungs- & Beratungshebel."
            budget = "150.000 € – 320.000 €"
        elif has_exit and has_new and has_organ:
            tier = 'TIER_2_MID'
            verdict = 'ORGANWECHSEL MIT DIREKTER NACHBESETZUNG'
            vac_text = f"GESCHLOSSEN: {exit_snippet[:120]} -> Nachfolger: {new_snippet[:120]}"
            urg_text = "MODERAT: Geordneter Stabwechsel im Verwaltungsrat / Geschäftsführung."
            rat_text = f"Stabwechsel im Führungsorgan: {exit_snippet[:150]} abgelöst durch {new_snippet[:150]}. Potenzial für Onboarding-Begleitung oder Neuausrichtung."
            budget = "80.000 € – 150.000 €"
        elif is_liquidation:
            tier = 'TIER_2_MID'
            verdict = 'LIQUIDATION & ABWICKLUNG'
            vac_text = "BESTANDEN: Gesellschaft befindet sich in Liquidation / Auflösung"
            urg_text = "AKUT: Abwicklungs- / Liquidator-Mandat"
            rat_text = f"Gesellschaft in Liquidation: Bedarf für professionelle Abwicklung oder Sanierungsprüfung."
            budget = "80.000 € – 150.000 €"
        else:
            tier = 'TIER_2_MID'
            verdict = 'ORGAN-MUTATION'
            vac_text = f"Eintrag: {raw_text[120:250]}"
            urg_text = "Prüfung empfohlen"
            rat_text = "Handelsregister-Mutation mit personeller Veränderung."
            budget = "80.000 € – 150.000 €"

        new_situation = (
            f"[DEALCOACH AUDIT]: {tier}\n"
            f"[VAKUUM-CHECK]: {vac_text}\n"
            f"[DRINGLICHKEIT]: {urg_text}\n"
            f"[MANDATS-BEGRÜNDUNG]: {rat_text}\n"
            f"[BUDGET-SCHÄTZUNG]: {budget}\n"
            f"[COMPANY]: {title.split(':')[0].replace('[CH]', '').strip()}\n"
            f"[KAUFSIGNAL]: {verdict}\n"
            f"[EREIGNISDATUM]: {now_iso[:10]}\n\n"
            f"ORIGINAL-HANDELSREGISTERTEXT:\n{raw_text[100:650]}"
        )

        review_notes_data = json.dumps({
            'deal_coach': {
                'tier': tier,
                'verdict': verdict,
                'vacuum_check': vac_text,
                'urgency_check': urg_text,
                'rationale': rat_text,
                'estimated_budget': budget,
                'audited_at': now_iso
            }
        }, ensure_ascii=False)

        patch_data = {
            'priority': tier,
            'situation': new_situation,
            'review_notes': review_notes_data,
            'tags': [tier, 'DealCoach_Audited', 'Vetted_Facts_PDF']
        }
        patch_opp(opp_id, patch_data)
        updated_facts += 1
        print(f"✅ GESCHÄRFT MIT PRIMÄRFAKTEN [{tier}]: {title[:60]}")
        print(f"   -> Vakuum: {vac_text[:100]}")
        print(f"   -> Begründung: {rat_text[:100]}")
        
    except Exception as e:
        print(f"Fehler bei {opp_id}: {e}")

print("\n" + "=" * 60)
print(f"ABSCHLUSS-AUDIT MIT ECHTEN FAKTEN:")
print(f"• Ausgesondertes Adress-/Statuten-Rauschen: {purged_noise}")
print(f"• Mit echten Personal-Fakten geschärft:     {updated_facts}")
print("=" * 60)
