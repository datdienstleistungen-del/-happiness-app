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


# Pan-European Feed Sources Configuration
FEED_SOURCES = {
    "eqs_news_dach": {
        "name": "EQS News (DACH)",
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
        "name": "Schweizerische Handels- und Finanz-Feeds (SHAB Mutationen)",
        "region": "CH",
        "url": "https://news.google.com/rss/search?q=(%22Handelsregister%22+OR+%22SHAB%22+OR+%22Mutationen%22)+AND+(%22Amtsniederlegung%22+OR+%22R%C3%BCcktritt%22+OR+%22Vorstand%22+OR+%22Gesch%C3%A4ftsf%C3%BChrer%22+OR+%22Verwaltungsrat%22+OR+%22Ausscheiden%22+OR+%22Interim%22)&hl=de-CH&gl=CH&ceid=CH:de&tbs=qdr:d",
        "enabled": True
    },
    "eu_markets_es": {
        "name": "Mercado Continuo & CNMV (Spanien)",
        "region": "ES",
        "url": "https://news.google.com/rss/search?q=(CNMV+OR+%22Mercado+Continuo%22+OR+%22Bolsas+y+Mercados%22)+AND+(dimision+OR+renuncia+OR+%22cese+de+funciones%22+OR+%22relevo+de+la+direccion%22+OR+%22nombramiento+interino%22+OR+%22consejero+delegado%22)&hl=es&gl=ES&ceid=ES:es&tbs=qdr:d",
        "enabled": True
    },
    "eu_markets_fr": {
        "name": "Euronext Paris & AMF (Frankreich)",
        "region": "FR",
        "url": "https://news.google.com/rss/search?q=(Euronext+OR+AMF+OR+%22communiqu%C3%A9%22)+AND+(%22d%C3%A9mission%22+OR+%22d%C3%A9part%22+OR+%22int%C3%A9rim%22+OR+%22directeur+g%C3%A9n%C3%A9ral%22+OR+%22vacance+de+poste%22)&hl=fr&gl=FR&ceid=FR:fr&tbs=qdr:d",
        "enabled": True
    },
    "eu_markets_pan": {
        "name": "Pan-European Regulatory Announcements (Euronext / BusinessWire)",
        "region": "EU",
        "url": "https://news.google.com/rss/search?q=(%22Business+Wire%22+OR+%22Euronext%22+OR+%22regulatory+news%22)+AND+(%22resignation%22+OR+%22steps+down%22+OR+%22interim+CEO%22+OR+%22interim+CFO%22+OR+%22board+changes%22+OR+%22leadership+transition%22)&hl=en-150&gl=DE&ceid=DE:en&tbs=qdr:d",
        "enabled": True
    }
}

# Status Constants
STATUS_PENDING_REVIEW = "pending"   # Stored as 'pending' in Supabase to satisfy constraint, displayed as PENDING_REVIEW
STATUS_QUALIFIED = "verified"       # Stored as 'verified' in Supabase, displayed as QUALIFIED
STATUS_DISMISSED = "rejected"       # Stored as 'rejected' in Supabase, displayed as DISMISSED
