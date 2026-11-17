"""
D.A.T. LeadTracker Bridge
Synchronizes vetted corporate restructuring & executive mandate signals
directly from NeXus Radar into the local D.A.T. LeadTracker (http://localhost:3457).
Zero junk: Eliminates foundations, pensions, auditor rotations, and micro-SMEs.
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

RADAR_EVENTS_FILE = os.path.join(PROJECT_ROOT, "public", "data", "continuous_radar_events.json")
LEADTRACKER_DATA_FILE = r"C:\Users\Suwan\OneDrive\Dokumente\WHM\leadtracker\data\leads.json"

KO_KEYWORDS = [
    'stiftung', 'pensionskasse', 'vorsorge', 'fondation', 'fondazione', 'verein',
    'caisse de pension', 'limmathof', 'cresta palace', '123fahrschule', 'hotel',
    'gasthof', 'bruckmühl', 'processservices', '1962a'
]

def is_junk_event(company, desc):
    comp_lower = (company or "").lower()
    desc_lower = (desc or "").lower()
    if any(k in comp_lower for k in KO_KEYWORDS):
        return True
    if any(k in desc_lower for k in [
        "directors' dealings", "directors dealings", "aktienzuteilung",
        "stimmrechtsmitteilung", "kapitalmarktforum", "webinar", "webcast",
        "revisionsstelle", "organe de révision"
    ]) and not any(k in desc_lower for k in ['vorstand', 'geschäftsführ', 'ceo', 'cfo', 'cro', 'insolvenz', 'starug', 'eigenverwaltung']):
        return True
    return False

def detect_industry(text):
    t = text.lower()
    if any(k in t for k in ['solar', 'energie', 'photovoltaik', 'windkraft', 'kraftwerk']):
        return 'Energie'
    if any(k in t for k in ['automotive', 'fahrzeug', 'zulieferer', 'auto', 'komponenten']):
        return 'Automotive / Zulieferer'
    if any(k in t for k in ['it', 'software', 'cloud', 'digital', 'saas']):
        return 'IT / Software'
    if any(k in t for k in ['immobilien', 'real estate', 'property']):
        return 'Immobilien'
    if any(k in t for k in ['medien', 'druck', 'karton', 'verpackung']):
        return 'Produktion / Fertigung'
    if any(k in t for k in ['maschinenbau', 'anlagenbau', 'technik']):
        return 'Maschinenbau'
    return 'Industrie / Produktion'

def generate_perplexity_prompt(company, title, source_url):
    return (
        f"Bitte überprüfe folgenden Unternehmensfall für ein Executive-Interim-Mandat (CRO / Sanierungs-GF / Interim-CFO):\n\n"
        f"Firma: {company}\n"
        f"Signal: {title}\n"
        f"Quelle: {source_url}\n\n"
        f"Bewerte anhand der 4 NeXus-Kernfragen:\n"
        f"1. Liegt eine Sanierung, Restrukturierung (StaRUG, Schutzschirm, Eigenverwaltung) oder akute Organvakanz vor?\n"
        f"2. Wurde bereits ein CRO / Sanierungs-GF bestellt oder ist die Position noch vakant?\n"
        f"3. Wer sind die entscheidenden Ansprechpartner (Geschäftsführung, Aufsichtsrat, Gläubigerbeirat, Sanierungskanzlei)?\n"
        f"4. Ist das Unternehmen operativ tätig (> 10 Mio. € Umsatz) und plausibel für ein Executive-Mandat (keine Pensionskasse, keine Stiftung, kein Kleinstbetrieb)?"
    )

def sync_to_leadtracker():
    if not os.path.exists(LEADTRACKER_DATA_FILE):
        print(f"[LeadTracker Bridge] Fehler: {LEADTRACKER_DATA_FILE} existiert nicht.")
        return 0

    if not os.path.exists(RADAR_EVENTS_FILE):
        print(f"[LeadTracker Bridge] Fehler: {RADAR_EVENTS_FILE} nicht gefunden.")
        return 0

    with open(RADAR_EVENTS_FILE, 'r', encoding='utf-8') as f:
        radar_data = json.load(f)

    with open(LEADTRACKER_DATA_FILE, 'r', encoding='utf-8') as f:
        lt_data = json.load(f)

    existing_companies = { (l.get('company') or '').strip().lower() for l in lt_data.get('leads', []) }
    added_count = 0

    events = radar_data.get('events', [])
    for ev in events:
        rc = ev.get('reality_check', {}) or {}
        rc_status = rc.get('status')
        if rc_status != 'MANDAT_PLAUSIBEL':
            continue

        comp_name = (ev.get('company_name') or '').strip()
        if not comp_name or len(comp_name) < 3:
            continue

        evidence = ev.get('evidence_text') or ev.get('description') or ''
        if is_junk_event(comp_name, evidence):
            continue

        if comp_name.lower() in existing_companies:
            continue

        lead_id = str(uuid.uuid4())
        source_url = ev.get('source_url') or ''
        rationale = rc.get('rationale') or ev.get('mandate_rationale') or 'Akuter Restrukturierungsdruck'
        facts = rc.get('facts_proven') or evidence
        event_date = ev.get('event_date') or ev.get('published_at') or datetime.now(timezone.utc).strftime('%Y-%m-%d')
        if len(event_date) > 10:
            event_date = event_date[:10]

        role = rc.get('mandate_role') or 'CRO / Restrukturierungs-Management'
        industry = detect_industry(comp_name + ' ' + evidence)
        pplx_prompt = generate_perplexity_prompt(comp_name, facts, source_url)

        dossier = (
            f"=== WER ===\n"
            f"Gesellschaft: {comp_name}\n"
            f"Branche: {industry}\n"
            f"Mandatsfokus: {role}\n\n"
            f"=== WAS ===\n"
            f"Primär-Ereignis: {facts}\n"
            f"Datum: {event_date}\n"
            f"Quelle: {source_url}\n\n"
            f"=== WARUM ===\n"
            f"{rationale}\n\n"
            f"=== PERPLEXITY-AUDIT-PROMPT (1-KLICK KOPIEREN) ===\n"
            f"{pplx_prompt}"
        )

        new_lead = {
            'id': lead_id,
            'company': comp_name,
            'industry': industry,
            'location': ev.get('region') or 'DACH',
            'revenue': '> 10 Mio. € (Mid-Market)',
            'employees': '-',
            'status': 'signal',
            'provider': 'taskforce',
            'partner': 'Jens Christophers',
            'partners': ['Jens Christophers', 'Andreas Henkel'],
            'source': source_url,
            'hypothesis': f"Bedarf an {role}. {rationale}",
            'notes': dossier,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }

        # Primärabschnitt für den Lead erstellen
        section_id = str(uuid.uuid4())
        new_section = {
            'id': section_id,
            'leadId': lead_id,
            'provider': 'taskforce',
            'partner': 'Jens Christophers',
            'title': f"taskforce / Jens Christophers",
            'createdAt': datetime.now(timezone.utc).isoformat()
        }

        lt_data.setdefault('leads', []).append(new_lead)
        lt_data.setdefault('sections', []).append(new_section)
        existing_companies.add(comp_name.lower())
        added_count += 1
        print(f"[LeadTracker Bridge] + Importiert: {comp_name} ({role})")

    if added_count > 0:
        with open(LEADTRACKER_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(lt_data, f, indent=2, ensure_ascii=False)
        print(f"[LeadTracker Bridge] Fertig: {added_count} verifizierte Mandatsfälle in {LEADTRACKER_DATA_FILE} übertragen.")
    else:
        print("[LeadTracker Bridge] Keine neuen Mandatsfälle zu importieren.")

    return added_count

if __name__ == '__main__':
    sync_to_leadtracker()
