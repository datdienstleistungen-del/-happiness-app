import os

# Default User ID for Harro Goerndt
DEFAULT_USER_ID = "976e6211-8931-425a-a171-0c062290181b"

# Signal Categories & Keywords
SIGNAL_CATEGORIES = {
    "ORGANVAKANZ & LEADERSHIP": {
        "prio": "HOCH",
        "priority_db": "hoch",
        "base_confidence": 0.90,
        "keywords": [
            "amtsniederlegung",
            "vorzeitiges ausscheiden",
            "vorstandswechsel",
            "ruht das mandat",
            "mutterschutzvertretung",
            "interimslösung",
            "interimsloesung",
            "sucht nachfolge",
            "abberufung",
            "resigns",
            "resignation",
            "stepping down",
            "board resignation",
            "interim appointment",
            "parental leave cover",
            "cfo resignation",
            "ceo resignation",
            "chief executive officer resign",
            "chief financial officer resign",
            "vorstand scheidet aus",
            "geschaeftsfuehrer scheidet aus",
            "geschäftsführer scheidet aus",
            "nachfolge regeln"
        ]
    },
    "RESTRUKTURIERUNG & SONDERSITUATIONEN": {
        "prio": "HOCH",
        "priority_db": "hoch",
        "base_confidence": 0.85,
        "keywords": [
            "restrukturierungsplan",
            "starug",
            "schutzschirmverfahren",
            "gewinnwarnung",
            "kreditlinien verlängert",
            "kreditlinien verlaengert",
            "sanierungskonzept",
            "liquiditätsengpass",
            "liquiditaetsengpass",
            "profit warning",
            "restructuring plan",
            "debt refinancing",
            "administration",
            "insolvenzverfahren",
            "insolvenz",
            "eigenverwaltung",
            "liquiditätskrise",
            "liquiditaetskrise",
            "konkurs",
            "bankrott",
            "pleite",
            "sanierung",
            "restrukturierungsmassnahmen",
            "restrukturierungsmaßnahmen"
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
            "veräusserung",
            "veraeusserung",
            "abspaltung",
            "unternehmensverkauf"
        ]
    }
}

# Feed Sources Configuration
FEED_SOURCES = {
    "eqs_news_dach": {
        "name": "EQS News (DACH)",
        "region": "DACH",
        "url": "https://www.eqs-news.com/de/rss/",
        "alt_url": "https://www.eqs-news.com/de/",
        "enabled": True
    },
    "uk_rns": {
        "name": "London Stock Exchange Regulatory News Service (UK)",
        "region": "UK",
        "url": "https://www.investegate.co.uk/Rss.aspx",
        "enabled": True
    },
    "swiss_shab": {
        "name": "Schweizerische Handels- und Finanz-Feeds (SHAB)",
        "region": "CH",
        "url": "https://news.google.com/rss/search?q=%22Handelsregister%22+OR+SHAB+OR+%22Mutationen%22+OR+%22Konkurs%22&hl=de-CH&gl=CH&ceid=CH:de",
        "enabled": True
    }
}

# Status Constants
STATUS_PENDING_REVIEW = "pending"   # Stored as 'pending' in Supabase to satisfy constraint, displayed as PENDING_REVIEW
STATUS_QUALIFIED = "verified"       # Stored as 'verified' in Supabase, displayed as QUALIFIED
STATUS_DISMISSED = "rejected"       # Stored as 'rejected' in Supabase, displayed as DISMISSED
