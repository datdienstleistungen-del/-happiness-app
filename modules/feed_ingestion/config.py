import os

# Default User ID for Harro Goerndt
DEFAULT_USER_ID = "976e6211-8931-425a-a171-0c062290181b"

# Maximum age threshold in hours (hard 48h limit)
MAX_AGE_HOURS = 48

# Signal Categories & Keywords focused on C-Level & Board Vacancies
SIGNAL_CATEGORIES = {
    "ORGANVAKANZ & LEADERSHIP": {
        "prio": "HOCH",
        "priority_db": "hoch",
        "base_confidence": 0.92,
        "keywords": [
            # German (DE)
            "vorzeitiges ausscheiden",
            "amtsniederlegung",
            "scheidet per sofort aus",
            "interimslösung",
            "interimsloesung",
            "sucht nachfolge",
            "abberufung",
            "vorstandswechsel",
            "tritt zurück",
            "tritt zurueck",
            "vorstand scheidet aus",
            "geschäftsführer scheidet aus",
            "geschaeftsfuehrer scheidet aus",
            "ruht das mandat",
            "cfo-wechsel",
            "ceo-wechsel",
            "neuer vorstandsvorsitzender",
            "sucht vorstand",
            "niederlegung des mandats",
            "vorstandsmitglied scheidet aus",
            "vorzeitige beendigung",
            "führungslücke",
            "fuehrungsluecke",
            "vorstandsmandat niedergelegt",
            "vorstand tritt ab",
            "vorstandsrücktritt",
            "vorstandsruecktritt",
            "nachfolge regeln",
            # English (EN)
            "steps down with immediate effect",
            "resignation",
            "interim ceo",
            "interim cfo",
            "board changes",
            "executive departure",
            "leadership transition",
            "stepping down",
            "steps down as ceo",
            "steps down as cfo",
            "steps down as",
            "resigns as ceo",
            "resigns as cfo",
            "resigned as",
            "departure of ceo",
            "departure of cfo",
            "board resignation",
            "executive search",
            "interim leadership",
            "standing down",
            "relieved of duties",
            "board vacancy",
            "chief executive departure",
            "chief financial officer departure",
            # Spanish (ES)
            "dimisión",
            "dimision",
            "renuncia con efecto inmediato",
            "cese de funciones",
            "relevo de la dirección",
            "relevo de la direccion",
            "nombramiento interino",
            "dimite el consejero",
            "dimite el presidente",
            "dimite el consejero delegado",
            "renuncia del director",
            "cese del consejero",
            "relevo en la presidencia",
            "deja su cargo con efecto inmediato",
            "vacante en el consejo",
            # French (FR)
            "démission immédiate",
            "demission immediate",
            "départ du directeur",
            "depart du directeur",
            "nomination par intérim",
            "nomination par interim",
            "vacance de poste",
            "démissionne de ses fonctions",
            "demissionne de ses fonctions",
            "départ du pdg",
            "depart du pdg",
            "quitte ses fonctions avec effet immédiat",
            "transition de gouvernance",
            "départ de la direction",
            "nomination intérimaire",
            # Italian (IT)
            "dimissioni con effetto immediato",
            "avvicendamento",
            "nomina ad interim",
            "lascia la carica",
            "dimissioni dell'amministratore delegato",
            "cambio al vertice",
            "cessazione della carica",
            "dimissioni del cda",
            "passaggio di consegne",
            "nuovo amministratore delegato"
        ]
    },
    "RESTRUKTURIERUNG & SONDERSITUATIONEN": {
        "prio": "HOCH",
        "priority_db": "hoch",
        "base_confidence": 0.85,
        "keywords": [
            "chief restructuring officer",
            "cro interim",
            "sanierungsvorstand",
            "interim cro",
            "starug",
            "schutzschirmverfahren",
            "restrukturierungsplan",
            "sanierungskonzept",
            "liquiditätsengpass",
            "liquiditaetsengpass",
            "profit warning",
            "gewinnwarnung",
            "debt refinancing",
            "kreditlinien verlängert",
            "kreditlinien verlaengert"
        ]
    },
    "M&A & TRANSFORMATION": {
        "prio": "MITTEL",
        "priority_db": "mittel",
        "base_confidence": 0.75,
        "keywords": [
            "carve-out",
            "carve out",
            "strategische optionen",
            "verkaufsprozess",
            "strategic review",
            "divestment",
            "abspaltung",
            "unternehmensverkauf"
        ]
    }
}

# Negative Filter: Small businesses, retail noise, and advice articles (Score 0 / Drop)
NEGATIVE_KEYWORDS = [
    # Small businesses / micro-retail
    "pizzeria", "bäckerei", "baeckerei", "friseur", "friseursalon", "coiffeur",
    "barbershop", "nagelstudio", "imbiss", "döner", "doener", "kiosk", "gasthaus",
    "restaurant", "café", "cafe", "kneipe", "zirkus", "circus", "kita", "kindertagesstätte",
    "kindergarten", "tierheim", "campingplatz", "metzgerei", "fleischerei", "fahrschule",
    "blumenladen", "kosmetikstudio", "hofladen", "hallensportzentrum", "krawatten",
    "hosenlupf", "country festival", "marriott hotel", "sportzentrum", "fitnessstudio",
    "pension", "ferienwohnung", "wäscherei", "autowäsche",
    # Generic advice / how-to / media chatter
    "tipps", "ratgeber", "was tun bei", "leitfaden", "checkliste", "so schützen sie",
    "wie sie am besten", "wie man", "5 tipps", "10 tipps", "ratgeberartikel", "kolumne",
    "kommentar:", "gastbeitrag", "buchtipp", "horoskop", "filmtipp",
    # Politics / Parties / Elections
    "spd", "cdu", "csu", "fdp", "afd", "grüne", "gruene", "linke", "partei", "landtag",
    "bundestag", "gemeinderat", "stadtrat", "bürgermeister", "buergermeister", "minister",
    "kanzler", "alcalde", "maire", "député", "depute", "senat", "senado", "election",
    "macron", "le pen", "parlamento", "wahlen",
    # Sports / Clubs / Coaching
    "trainer", "fussball", "fußball", "bundesliga", "sport", "head coach", "coach",
    "all whites", "fc bayern", "premier league", "champions league", "grand prix",
    "formula 1", "formel 1", "tour de france", "athlet", "olympia", "tennis", "ski",
    "sölden", "soelden", "entrenador", "selección", "ringer", "msv", "tsv", "sportverein",
    "fussballverein", "fußballverein",

    # Religion / Education
    "pfarramt", "kirche", "pfarrer", "bistum", "schule", "schüler",
    # Denial of vacancy
    "exclut toute", "schliesst aus", "schließt aus", "kein rücktritt", "dementiert"
]

# Strikte Blacklist für Rollen unterhalb der Organ- und C-Level-Ebene (SOFORTIGER DROP)
ROLE_BLACKLIST = [
    "vertriebsleiter", "sales manager", "teamleiter", "junior", "praktikant",
    "sachbearbeiter", "key account manager", "entwickler", "techniker",
    "account executive", "vertriebsmitarbeiter", "sales rep", "head of sales",
    "regionalleiter", "filialleiter", "filialleiterin", "stellenanzeige", "job posting"
]

# Whitelist: Nur echte Organ- und C-Level-Positionen passieren den Ingestion-Filter
ROLE_WHITELIST = [
    "vorstand", "aufsichtsrat", "beirat", "ceo", "cfo", "cro", "coo",
    "managing director", "geschäftsführer", "geschaeftsfuehrer", "general counsel",
    "partner", "verwaltungsrat", "vorstandsvorsitzender", "vorstandssprecher",
    "vorstandsmitglied", "directeur général", "directeur general", "consejero delegado",
    "amministratore delegato", "chief executive", "chief financial", "chief restructuring",
    "chief operating", "directeur financier", "président du directoire", "president du directoire"
]

# Pflichtfeld Event: Zwingend erforderliche Anlass-Schlüsselwörter (Zero-Tolerance Gatekeeper)
MANDATORY_EVENT_KEYWORDS = [
    "rücktritt", "ruecktritt", "amtsniederlegung", "ausscheiden", "abberufung",
    "vorstandswechsel", "nachfolge", "sanierung", "starug", "schutzschirm",
    "insolvenz", "restrukturierung", "carve-out", "carve out", "m&a", "übernahme",
    "uebernahme", "abspaltung", "steps down", "resignation", "resigns",
    "leadership transition", "board changes", "dimisión", "dimision", "renuncia",
    "cese", "démission", "demission", "avvicendamento", "cessazione",
    "verlässt das unternehmen", "verlaesst das unternehmen", "niederlegung des mandats"
]

# Rechtsformen Whitelist (Strikt Enterprise / Kapitalgesellschaften)
# Erlaubt nur: AG, SE, KGaA, Plc, SA, NV, SpA, Corp, Groß-GmbH
LEGAL_FORM_WHITELIST = [
    "AG", "SE", "KGAA", "PLC", "SA", "NV", "SPA", "CORP", "GMBH"
]

# Rechtsformen Blacklist (Kleinstunternehmen, GbR, Einzelunternehmen, UG -> SOFORTIGER DROP)
LEGAL_FORM_BLACKLIST = [
    "e.k.", "e. k.", "eingetragener kaufmann", "eingetragene kauffrau",
    "einzelunternehmen", "gbr", "gesellschaft bürgerlichen rechts", "gesbr",
    "ug (haftungsbeschränkt)", "ug haftungsbeschraenkt", "unternehmergesellschaft",
    "verein", "e.v.", "eingetragener verein", "ggmbh", "stiftung", "partg", "partgmbb",
    "genossenschaft", "eg"
]


# Pan-European Official Primary Feed Sources Configuration (Keine Aggregatoren/Google News)
FEED_SOURCES = {
    "eqs_news_dach": {
        "name": "EQS News & Ad-hoc (DACH)",
        "region": "DACH",
        "url": "https://www.eqs-news.com/de/rss/",
        "enabled": True
    },
    "uk_rns": {
        "name": "London Stock Exchange Regulatory News Service (UK)",
        "region": "UK",
        "url": "https://www.investegate.co.uk/Rss.aspx",
        "enabled": True
    },
    "swiss_shab": {
        "name": "Schweizerisches Handelsamtsblatt (SHAB Mutationen REST API)",
        "region": "CH",
        "url": "https://amtsblattportal.ch/api/v1/publications?publicationStates=PUBLISHED&subRubrics=HR02&page=0&size=50",
        "enabled": True
    },
    "eu_markets_es": {
        "name": "CNMV Información Privilegiada & OIR (Spanien)",
        "region": "ES",
        "url": "https://www.cnmv.es/portal/informacion-privilegiada/RSS.asmx/GetNoticiasCNMV",
        "enabled": True
    },
    "eu_markets_fr": {
        "name": "AMF France Regulatory RSS (Frankreich)",
        "region": "FR",
        "url": "https://www.amf-france.org/fr/rss",
        "enabled": True
    },
    "eu_markets_euronext": {
        "name": "Euronext Pan-European Regulatory Press Releases",
        "region": "EU",
        "url": "https://live.euronext.com/en/pd/press-releases/rss",
        "enabled": True
    }
}

# Status Constants
STATUS_PENDING_REVIEW = "pending"   # Stored as 'pending' in Supabase to satisfy constraint, displayed as PENDING_REVIEW
STATUS_QUALIFIED = "verified"       # Stored as 'verified' in Supabase, displayed as QUALIFIED
STATUS_DISMISSED = "rejected"       # Stored as 'rejected' in Supabase, displayed as DISMISSED
