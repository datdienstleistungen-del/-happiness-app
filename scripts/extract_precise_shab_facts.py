import os
import sys
import json
import ssl
import io
import urllib.request
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

print(f"Starte präzise Fakten-Analyse für {len(pending_items)} Meldungen...")

now_iso = datetime.now(timezone.utc).isoformat()
purged = 0
updated = 0

for it in pending_items:
    opp_id = it.get('id')
    title = it.get('title', '')
    source = it.get('source', '')
    
    m = re.search(r'publications/([a-f0-9\-]+)', source)
    if not m:
        continue
    pub_id = m.group(1)
    pdf_url = f"https://amtsblattportal.ch/api/v1/publications/{pub_id}/pdf"
    
    try:
        pdf_bytes = urllib.request.urlopen(urllib.request.Request(pdf_url, headers=headers), context=ctx, timeout=6).read()
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        raw_text = ' '.join(' '.join(page.extract_text().split()) for page in reader.pages)
        
        # Check Ausgeschieden
        exit_match = re.search(r'Ausgeschiedene Personen und erloschene Unterschriften:\s*([^.]+?\.)', raw_text)
        new_match = re.search(r'Eingetragene Personen neu oder mutierend:\s*([^.]+?\.)', raw_text)
        
        exit_person = exit_match.group(1).strip() if exit_match else ''
        new_person = new_match.group(1).strip() if new_match else ''
        
        comp_name = title.split(':')[0].replace('[CH]', '').strip()
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        if exit_person and new_person:
            # 1:1 Stabwechsel
            tier = 'TIER_2_MID'
            verdict = 'ORGANWECHSEL (1:1 STABWECHSEL)'
            vac_text = f"GESCHLOSSEN: {exit_person} scheidet aus – Nachfolger {new_person} sofort eingetragen."
            urg_text = "MODERAT / ROUTINE: Geordneter Stabwechsel im Verwaltungsrat ohne unbesetzte Vakanz."
            rat_text = f"Stabwechsel im Verwaltungsrat: {exit_person} abgelöst durch {new_person}. Einzelunterschrift übertragen."
            budget = "80.000 € – 150.000 €"
        elif exit_person and not new_person:
            # Echtes Vakuum!
            tier = 'TIER_1_TOP'
            verdict = 'AKUTES ORGAN-VAKUUM (POSTEN UNBESETZT)'
            vac_text = f"AKUT BESTANDEN: {exit_person} scheidet aus – KEIN Nachfolger eingetragen!"
            urg_text = "HOCH: Organposition unbesetzt, Zeichnungsberechtigung erloschen."
            rat_text = f"Akute Organvakanz: {exit_person} scheidet aus, kein Nachfolger im Handelsregister gemeldet."
            budget = "150.000 € – 320.000 €"
        else:
            # Keine personelle Veränderung im Organ
            patch_opp(opp_id, {
                'review_status': 'rejected',
                'review_notes': '[DealCoach Filter]: Reine Adress-/Statutenänderung ohne Organwechsel (0 € Mandatswert).',
                'reviewed_at': now_iso,
                'tags': ['Gate0_Filtered', 'Statuten_Oder_Adresse', 'Zero_Mandate_Value']
            })
            purged += 1
            print(f"❌ AUSGESONDERT (Kein Organwechsel): {title[:60]}")
            continue

        what_happened = f"Ausgeschieden: {exit_person}" + (f" | Neuer Nachfolger: {new_person}" if new_person else " | Bisher KEIN Nachfolger eingetragen (Offene Vakanz!)")
        
        new_situation = (
            f"[DEALCOACH AUDIT]: {tier}\n"
            f"[VAKUUM-CHECK]: {vac_text}\n"
            f"[DRINGLICHKEIT]: {urg_text}\n"
            f"[MANDATS-BEGRÜNDUNG]: {rat_text}\n"
            f"[BUDGET-SCHÄTZUNG]: {budget}\n"
            f"[COMPANY]: {comp_name}\n"
            f"[KAUFSIGNAL]: {verdict}\n"
            f"[EREIGNISDATUM]: {today_date}\n\n"
            f"WAS IST PASSIERT:\n{what_happened}\n\n"
            f"ORIGINAL-REGISTERTEXT:\n{raw_text[120:700]}"
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

        patch_opp(opp_id, {
            'priority': tier,
            'situation': new_situation,
            'review_notes': review_notes_data,
            'tags': [tier, 'DealCoach_Audited', 'Vetted_Facts_PDF']
        })
        updated += 1
        print(f"✅ PRIMÄRFAKTEN PRÄZISIERT [{tier}]: {title[:50]}")
        print(f"   -> Ausgeschieden: {exit_person[:70]}")
        print(f"   -> Nachfolger:    {new_person[:70] if new_person else 'KEINER (AKUTES VAKUUM)'}")

    except Exception as e:
        print(f"Fehler bei {opp_id}: {e}")

print("\n" + "=" * 60)
print(f"BEREINIGUNG & FAKTEN-AUDIT BEENDET:")
print(f"• Ausgesondert: {purged}")
print(f"• Präzisiert mit Primärdaten: {updated}")
print("=" * 60)
