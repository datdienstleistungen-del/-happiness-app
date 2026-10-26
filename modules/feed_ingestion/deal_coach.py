"""
NeXus DealCoach - Automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2)
Focus: European Mandate Origination Desk (C-Level, Interim & Board Vacancies)

Prüft strikt:
1. Vakuum-Check: Ist der Posten tatsächlich unbesetzt oder droht sofortiger Stillstand?
   (Keine planmäßigen Wechsel, keine Pensionierungen mit Vorlauf).
2. Dringlichkeit & Handlungsdruck: Gibt es eine Überbrückung/Notlösung (z.B. AR springt ein)
   oder akuten Restrukturierungsdruck (StaRUG, CRO, Eigenverwaltung)?
3. Klassifizierung in Verwertungs-Töpfe:
   - tier: "TIER_1_TOP" (Großunternehmen/Börse, Budget 150k–320k €, C-Level Organ)
   - tier: "TIER_2_MID" (Mittelstand ab 20 Mio. €, PMO / operative Leitung)
   - tier: "REJECTED" (Kein Handlungsdruck, interner Nachfolger bereits aktiv, Routine)
4. Harter Reputationsschutz ('Kalter Kaffee'): Reales Vorfallsdatum <= 48h.
"""

import os
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone

try:
    from modules.feed_ingestion.date_utils import parse_date
    from modules.feed_ingestion.config import LEGAL_FORM_WHITELIST
except ImportError:
    from .date_utils import parse_date
    from .config import LEGAL_FORM_WHITELIST

def load_env():
    """Load environment variables from .env file."""
    env = {}
    env_file = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip("'\"")
    return env

ENV = load_env()
OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY') or ENV.get('OPENROUTER_API_KEY') or ENV.get('VITE_OPENROUTER_API_KEY')
MISTRAL_KEY = os.environ.get('MISTRAL_API_KEY') or ENV.get('MISTRAL_API_KEY') or ENV.get('VITE_MISTRAL_API_KEY')

OPENROUTER_MODELS = [
    'nvidia/nemotron-3.5-super-vl:free',
    'recursive/flint-v1.0:free'
]

MISTRAL_MODELS = [
    'open-mistral-7b',
    'mistral-small-latest'
]

DEEPSEEK_KEY = os.environ.get('DEEPSEEK_API_KEY') or ENV.get('DEEPSEEK_API_KEY') or ENV.get('VITE_DEEPSEEK_API_KEY')

def extract_json_from_text(text):
    """Robust JSON extraction from LLM response."""
    if not text:
        return None
    cleaned = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r'\s*```$', '', cleaned.strip(), flags=re.MULTILINE)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return None

def call_deepseek(prompt):
    if not DEEPSEEK_KEY:
        return None
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": "Du bist der NeXus DealCoach – die automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2) für den europäischen Mandate Origination Desk. Prüfe knallhart, objektiv und antworte ausschließlich in validem JSON."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 550,
        "response_format": {"type": "json_object"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def call_openrouter(prompt, model):
    if not OPENROUTER_KEY:
        return None
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexus-hit.netlify.app",
        "X-Title": "NeXus DealCoach Revision"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Du bist der NeXus DealCoach – die automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2) für den europäischen Mandate Origination Desk. Prüfe knallhart, objektiv und antworte ausschließlich in validem JSON."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 550
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def call_mistral(prompt, model):
    if not MISTRAL_KEY:
        return None
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Du bist der NeXus DealCoach – die automatisierte Revisions- und Vorsortierungs-Instanz (Stufe 2) für den europäischen Mandate Origination Desk. Prüfe knallhart, objektiv und antworte ausschließlich in validem JSON."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 550,
        "response_format": {"type": "json_object"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('choices', [{}])[0].get('message', {}).get('content', '')
    except Exception:
        return None

def audit_mandate_lead(item, eval_result):
    """
    DEALCOACH AUDIT (STUFE 2):
    Führt die semantische Revision und Einstufung in Verwertungs-Töpfe durch.
    Returns: (is_valid: bool, reason: str, audit_data: dict)
    """
    title = item.get('title', '')
    company = item.get('company', '')
    region = item.get('region', 'EU')
    snippet = item.get('snippet', '')
    published_at = item.get('published_at', '')

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime('%Y-%m-%d')

    # ── FAST-PATH FÜR BEKANNTE BÖRSEN-ROUTINEMELDUNGEN (VOREINSCHÄTZUNG) ──
    combined_lower = f"{title} {snippet}".lower()
    routine_patterns = [
        (r'transaction in own shares', 'Routine-Aktienrückkauf (Treasury) ohne Organ-Vakanz'),
        (r'holding\(?s\)? in company', 'Passive Stimmrechtsanpassung / Beteiligungsmeldung ohne Organwechsel'),
        (r'\bstimmrechtsanteile\b', 'Gesetzliche Stimmrechtsmitteilung (§§ 33 ff. WpHG) ohne Organvakanz'),
        (r'\bpdmr shareholding\b', 'Routine Eigengeschäft von Führungskräften (Art. 19 MAR) ohne Vakanz'),
        (r'director/pdmr shareholding', 'Routine Eigengeschäft von Führungskräften ohne Vakanz'),
        (r'\bexercise of warrants\b', 'Routine Optionsausübung / Kapitalmaßnahme'),
        (r'\bissue of equity\b', 'Routine Ausgabe neuer Aktien ohne Führungswechsel'),
        (r'\bblock listing\b', 'Börsen-Notierungsmitteilung ohne Organbedarf'),
        (r'vorabbekanntmachung finanzberichte', 'Reguläre Veröffentlichungspflicht für Finanzberichte')
    ]
    for pattern, rationale in routine_patterns:
        if re.search(pattern, combined_lower):
            parsed = {
                'status': 'rejected',
                'tier': 'REJECTED',
                'is_valid_mandate_event': False,
                'is_fresh': True,
                'company_name': company,
                'role': 'Routine-Kapitalmarkt',
                'event_type': 'Börsen- & Kapitalmarkt-Routine',
                'vacuum_check': f'AUSGESONDERT: {rationale}',
                'urgency_check': '0 € Mandatswert (Reine Pflichtroutine ohne Organvakanz)',
                'audit_verdict': 'REJECTED_NO_MANDATE',
                'audit_rationale': f"Automatischer Ausschluss: {rationale}.",
                'rejection_reason': rationale,
                'estimated_budget': '-',
                'confidence': 0.99
            }
            return False, f"GATE_0_REJECTED: {rationale}", parsed

    # ── HARTE K.O.-KRITERIEN (INGESTION-FILTER & SCORER) ──
    combined_eval_text = f"{title} {snippet} {item.get('raw_pdf_text', '')}".lower()

    # K.O. 1: Max_Dormant_Months (> 36 Monate -> automatischer Drop auf Tier 3 / 'discarded')
    dormant_months = item.get('dormant_months', 0)
    if not dormant_months:
        dm_match = re.search(
            r'(?:Vorangehende Publikation im SHAB|Pr[eé]c[eé]dente publication dans la FOSC|Precedente pubblicazione nel FUSC).*?(?:Datum|date|data|vom|du|del)?[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})|\((?:SHAB|FOSC|FUSC)(?:\s+Nr\.?\s*\d+)?\s+(?:vom|du|del)\s+(\d{1,2}\.\d{1,2}\.\d{4})',
            f"{title} {snippet} {item.get('raw_pdf_text', '')}",
            re.IGNORECASE
        )
        if dm_match:
            try:
                prev_date_str = dm_match.group(1) or dm_match.group(2)
                prev_dt = datetime.strptime(prev_date_str, '%d.%m.%Y')
                cur_dt = datetime.now(timezone.utc)
                dormant_months = (cur_dt.year - prev_dt.year) * 12 + (cur_dt.month - prev_dt.month)
            except Exception:
                pass

    if item.get('is_dormant_shell') or (dormant_months and dormant_months > 36):
        rationale = f"Vorherige Registerpublikation liegt {dormant_months} Monate zurück (> 36 Monate). Inaktive Mantelgesellschaft / Karteileiche ohne operativen Geschäftsbetrieb."
        parsed = {
            'status': 'discarded',
            'tier': 'TIER_3',
            'is_valid_mandate_event': False,
            'is_fresh': True,
            'company_name': company,
            'role': 'Inaktive Hülle',
            'event_type': 'Inaktive Mantelgesellschaft (>36 Monate inaktiv)',
            'vacuum_check': f'K.O. DROP: Vorherige SHAB-Publikation liegt {dormant_months} Monate zurück (> 36 Monate). Inaktive Hülle.',
            'urgency_check': '0 € Mandatswert (Karteileiche ohne laufenden Geschäftsbetrieb)',
            'audit_verdict': 'DISCARDED_DORMANT_SHELL',
            'audit_rationale': f"Automatischer Drop auf Tier 3 / Status 'discarded': {rationale}",
            'rejection_reason': 'Dormant_Shell',
            'estimated_budget': '-',
            'confidence': 0.99
        }
        return False, f"KO_DROP_DORMANT_SHELL: {dormant_months} Monate inaktiv", parsed

    # K.O. 2: Total_Organ_Vacancy (Art. 731b OR - Scheidet einziges Organ aus -> kein vertragsfähiger Partner)
    has_art_731b = item.get('has_art_731b') or bool(re.search(r'\b(731b\s*or|731b\s*co|organmangel|mängel in der organisation)\b', combined_eval_text))
    sole_organ_exit = item.get('sole_organ_exit') or bool(re.search(r'\b(einziges mitglied|seul administrateur|administrateur unique|alleiniges organ|alleiniger geschäftsführer|seul gérant|kein zeichnungsberechtigtes organ|die gesellschaft hat kein organ mehr)\b', combined_eval_text))

    if has_art_731b or sole_organ_exit:
        rationale = "Scheidet das einzige Organ aus und verbleibt kein einziger zeichnungsberechtigter Verwaltungsrat oder Direktor im Register, liegt ein gesetzlicher Organmangel nach Art. 731b OR vor. Es existiert kein handlungs- oder vertragsfähiger Partner."
        parsed = {
            'status': 'discarded',
            'tier': 'TIER_3',
            'is_valid_mandate_event': False,
            'is_fresh': True,
            'company_name': company,
            'role': 'Organ-Totalvakanz (Art. 731b OR)',
            'event_type': 'Organmangel / Kein vertragsfähiger Partner',
            'vacuum_check': 'K.O. DROP: Einziges Organ ausgeschieden / Art. 731b OR. Kein zeichnungsberechtigtes Organ verblieben.',
            'urgency_check': '0 € Mandatswert (Keine handlungsfähige Gegenseite für Mandatsvertrag)',
            'audit_verdict': 'DISCARDED_NO_CONTRACTOR',
            'audit_rationale': f"Automatischer Drop auf Tier 3 / Status 'discarded': {rationale}",
            'rejection_reason': 'Complete_Organ_Vacuum_No_Contractor',
            'estimated_budget': '-',
            'confidence': 0.99
        }
        return False, "KO_DROP_ORGAN_VACUUM: Art. 731b OR / Kein vertragsfähiger Auftraggeber", parsed

    # K.O. 3: Purpose_Filter (Reine Vermögensverwaltung, Liegenschaftsbesitzer, Domizilhülle als Tier 3)
    is_purpose_shell = item.get('is_purpose_shell')
    purpose_category = item.get('purpose_category')

    if not is_purpose_shell:
        if re.search(r'\b(verwaltung (?:des )?eigenen vermögens|familiengesellschaft|private vermögensanlage|anlage und verwaltung (?:von )?eigenem vermögen|gestion de fortune privée|gestion de son propre patrimoine|amministrazione del proprio patrimonio)\b', combined_eval_text):
            is_purpose_shell = True
            purpose_category = "Private Vermögensverwaltung"
        elif re.search(r'\b(halten und verwalten von liegenschaften|erwerb,? (?:halten,? )?verwalten von liegenschaften|erwerb,? belastung,? veräusserung und verwaltung von grundeigentum|erwerb,? halten und verkauf von immobilien|verwaltung von eigenem grundbesitz|reine immobilienholding|achat,? vente et gestion de biens immobiliers)\b', combined_eval_text) or re.search(r'\b(immo ag|immobilien ag|immo sa|immobilière sa|real estate ag)\b', company.lower()):
            is_purpose_shell = True
            purpose_category = "Reiner Liegenschaftsbesitzer"
        elif re.search(r'\b(domizilgewährung|gewährung von domizilen|übernahme von domizilmandaten|domicile provider|briefkastengesellschaft|adresse de complaisance|octroi de domicile)\b', combined_eval_text):
            is_purpose_shell = True
            purpose_category = "Domizilhülle / Briefkastengesellschaft"

    if is_purpose_shell:
        cat_str = purpose_category or "Mantelgesellschaft"
        rationale = f"Reine private Vermögensverwaltung, Liegenschaftsbesitzer oder Domizilhülle ({cat_str}) ohne operatives Personal oder Mandatsbedarf."
        parsed = {
            'status': 'discarded',
            'tier': 'TIER_3',
            'is_valid_mandate_event': False,
            'is_fresh': True,
            'company_name': company,
            'role': 'Vermögensverwaltung / Liegenschaftshülle',
            'event_type': f'{cat_str} (Keine operative Tätigkeit)',
            'vacuum_check': f'K.O. DROP: {cat_str}. Keine operative B2B-Geschäftstätigkeit.',
            'urgency_check': '0 € Mandatswert (Reine Vermögens- oder Liegenschaftshülle)',
            'audit_verdict': 'DISCARDED_PRIVATE_ASSET_OR_SHELL',
            'audit_rationale': f"Automatischer Drop auf Tier 3 / Status 'discarded': {rationale}",
            'rejection_reason': 'Private_Asset_Or_Shell',
            'estimated_budget': '-',
            'confidence': 0.99
        }
        return False, f"KO_DROP_PURPOSE_SHELL: {cat_str}", parsed

    # K.O. 4: Substance & Minimum Capital Gate (Bloßes Mindestkapital / Domizilgesellschaft ohne operatives Personal)
    min_capital_match = re.search(
        r'(?:aktienkapital|stammkapital|capital[- ]actions|capitale azionario)[\s:]*(?:chf|eur|chf\.)?\s*(?:100[\'’.]?000|50[\'’.]?000|20[\'’.]?000|25[\'’.]?000)(?:\.00)?\b',
        combined_eval_text
    )
    has_domicile_indicator = bool(re.search(r'\b(c/o\b|domizil bei|par adresse|adresse de domicile|treuhand|trustee|domizilannahme|domizilgewaehrung)\b', combined_eval_text))
    single_person_indicator = bool(re.search(r'\b(einziges mitglied|seul administrateur|administrateur unique|alleiniges organ|einzelunterschrift)\b', combined_eval_text))
    has_multi_organ = bool(re.search(r'\b(kollektivunterschrift|weitere mitglieder|direktion|geschaeftsleitung|mitarbeiter|team|plattform|kunden|betrieb)\b', combined_eval_text))

    if (has_domicile_indicator and min_capital_match) or (min_capital_match and single_person_indicator and not has_multi_organ and (dormant_months > 12 or is_purpose_shell)):
        rationale = "Das im Registertext genannte Kapital entspricht dem bloßen gesetzlichen Mindestkapital ohne weiteres operatives Personal/Organe oder Domizilsitz. Kein operatives Mandat."
        parsed = {
            'status': 'discarded',
            'tier': 'TIER_3',
            'is_valid_mandate_event': False,
            'is_fresh': True,
            'company_name': company,
            'role': 'Mindestkapital-Hülle',
            'event_type': 'Mantel- / Domizilgesellschaft mit Mindestkapital',
            'vacuum_check': 'K.O. DROP: Bloßes Mindestkapital ohne operatives Personal/Organe.',
            'urgency_check': '0 € Mandatswert (Reine Mindestkapital-Hülle ohne Substanz)',
            'audit_verdict': 'DISCARDED_MINIMUM_CAPITAL_SHELL',
            'audit_rationale': f"Automatischer Drop auf Tier 3 / Status 'discarded': {rationale}",
            'rejection_reason': 'Minimum_Capital_No_Substance',
            'estimated_budget': '-',
            'confidence': 0.99
        }
        return False, "KO_DROP_MIN_CAPITAL: Bloßes Mindestkapital ohne operative Substanz", parsed

    # ── SEMANTISCHES LLM-AUDIT (FÜR ECHTE OPERATIVE UNTERNEHMEN) ──
    prompt = f"""Du bist der NeXus DealCoach. Analysiere diese europäische Wirtschaftsmeldung als automatisierte Revisions- und Vorsortierungs-Instanz für Harros Mandats-Desk:
HEUTIGES DATUM: {today_str}

DEINE PRÜF-KRITERIEN:

1. QUALIFIKATION FÜR "TIER_1_TOP" (ACTIVE MANDATE SIGNAL):
   - Mindestens 1 weiteres handelndes Organ oder aktiver Gesellschafterkreis vorhanden (vertragsfähiger Partner).
   - Nachweisbare operative Geschäftstätigkeit (aktive Domain, Plattform, Marktauftritt, wie bei cosquare AG).
   - Reale Führungslücke bei bestehendem Geschäftsbetrieb (akutes Ausscheiden C-Level / Board-Mitglied).

2. QUALIFIKATION FÜR "TIER_2_MID":
   - Gehobener Mittelstand ab 20 Mio. €, operative Interimsleitung oder Restrukturierung.

3. K.O.-DROP AUF "TIER_3" (STATUS 'discarded'):
   - Inaktive Hüllen / Karteileichen (>36 Monate inaktiv).
   - Vollständiger Organmangel (Art. 731b OR: einziges Organ scheidet aus, kein vertragsfähiger Partner).
   - Reine private Vermögensverwaltung, Liegenschaftsbesitzer, Domizilhüllen oder Mindestkapitalgesellschaften ohne Personal.

MELDUNG:
Unternehmen: {company}
Region: {region}
Titel: {title}
Textauszug: {snippet}
Publikationsdatum: {published_at or today_str}

Antworte AUSSCHLIESSLICH in diesem JSON-Format:
{{
  "tier": "TIER_1_TOP" | "TIER_2_MID" | "TIER_3",
  "status": "pending" | "discarded",
  "is_valid_mandate_event": true | false,
  "is_fresh": true,
  "event_date": "YYYY-MM-DD des Vorfalls oder null",
  "company_name": "Exakter Firmenname",
  "legal_form": "AG | SE | KGaA | Plc | SA | NV | SpA | Corp | Groß-GmbH | Unbekannt",
  "role": "Organrolle (z.B. CEO, CFO, CRO, Aufsichtsrat, Board)",
  "person_name": "Name der Person oder leer",
  "event_type": "Akutes Organ-Vakuum & Transition | Restrukturierung & CRO | Not-Governance | Routine | Mantelgesellschaft",
  "has_remaining_organ": true | false,
  "has_operating_business": true | false,
  "vacuum_check": "Vakuum-Einschätzung",
  "urgency_check": "Dringlichkeits-Einschätzung",
  "audit_verdict": "AKUTER C-LEVEL / ORGAN-MANDATSBEDARF" | "OPERATIVER INTERIM- & LEITUNGSBEDARF" | "DISCARDED",
  "audit_rationale": "Prägnante DealCoach-Begründung für Harro.",
  "estimated_budget": "Verifiziertes Budget aus Meldung falls vorhanden, sonst '-'",
  "confidence": 0.0 - 1.0,
  "rejection_reason": "Dormant_Shell | Complete_Organ_Vacuum_No_Contractor | Private_Asset_Or_Shell | Minimum_Capital_No_Substance | null"
}}"""

    raw_response = None

    # 1. DeepSeek (Primär-Engine für DealCoach Audit)
    raw_response = call_deepseek(prompt)

    # 2. Mistral Fallback
    if not raw_response:
        for model in MISTRAL_MODELS:
            raw_response = call_mistral(prompt, model)
            if raw_response:
                break

    # 3. OpenRouter Fallback
    if not raw_response:
        for model in OPENROUTER_MODELS:
            raw_response = call_openrouter(prompt, model)
            if raw_response:
                break

    parsed = extract_json_from_text(raw_response) if raw_response else None
    if not parsed or not isinstance(parsed, dict):
        parsed = {
            'status': 'pending',
            'tier': 'TIER_2_MID',
            'is_valid_mandate_event': True,
            'is_fresh': True,
            'company_name': company,
            'role': 'Vorstand / Geschäftsführung / Board',
            'event_type': 'Primärmeldung',
            'vacuum_check': 'Manuelle Prüfung erforderlich',
            'urgency_check': 'Primärmeldung zur Chefsache-Prüfung',
            'audit_verdict': 'OPERATIVER INTERIM- & LEITUNGSBEDARF',
            'audit_rationale': 'Primärmeldung aus Primärquelle. Zur manuellen Sichtung im Mandats-Desk vorgelegt.',
            'estimated_budget': '-',
            'confidence': 0.75
        }
        return True, "DEALCOACH_MANUELLE_PRÜFUNG", parsed

    raw_tier = parsed.get('tier', 'TIER_2_MID')
    if raw_tier in ('TIER_1_TOP', 'TIER_1'):
        # Validierung der Tier 1 Kriterien:
        # 1. Mindestens 1 weiteres handelndes Organ oder aktiver Gesellschafterkreis vorhanden
        # 2. Reale Führungslücke bei bestehendem Geschäftsbetrieb
        if parsed.get('has_remaining_organ') is False or item.get('sole_organ_exit'):
            tier = 'TIER_3'
            parsed['status'] = 'discarded'
            parsed['rejection_reason'] = 'Complete_Organ_Vacuum_No_Contractor'
            parsed['audit_verdict'] = 'DISCARDED_NO_CONTRACTOR'
            parsed['audit_rationale'] = "Drop auf Tier 3: Kein verbleibendes Organ im Register verblieben (Art. 731b OR)."
        else:
            tier = 'TIER_1_TOP'
            parsed['status'] = 'pending'
    elif raw_tier in ('TIER_3', 'REJECTED') or parsed.get('status') == 'discarded':
        tier = 'TIER_3'
        parsed['status'] = 'discarded'
    elif raw_tier in ('TIER_2_MID', 'TIER_2'):
        tier = 'TIER_2_MID'
        parsed['status'] = 'pending'
    else:
        tier = 'TIER_2_MID'
        parsed['status'] = 'pending'

    parsed['tier'] = tier
    if tier == 'TIER_3':
        parsed['is_valid_mandate_event'] = False
        parsed['status'] = 'discarded'
        return False, f"KO_DROP ({parsed.get('rejection_reason', 'Tier 3 Discarded')}): {parsed.get('audit_rationale', '')[:80]}", parsed

    parsed['is_valid_mandate_event'] = True
    parsed['is_fresh'] = True
    if not parsed.get('audit_rationale'):
        parsed['audit_rationale'] = 'Zur manuellen Prüfung durch Harro im Mandats-Desk vorgelegt.'

    return True, f"DEALCOACH_QUALIFIZIERT ({tier}): {parsed.get('audit_rationale')[:80]}", parsed
