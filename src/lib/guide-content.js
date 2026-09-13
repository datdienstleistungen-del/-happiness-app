// Multilingual Guide Content for NeXus Guide & Assistant

const GUIDE_CONTENT_I18N = {
  de: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'Das Radar durchsucht das Web nach aktuellen Signalen, die zu deinem Angebot passen. Kurz gesagt: Du suchst nicht nach Firmen – du suchst nach Ereignissen.',
      whatToDo: 'Wähle dein aktuelles Offering aus und starte die Deep Search, um das Web manuell zu durchsuchen. Oder wirf einen Blick auf die Signale der Nachtschicht (Auto-Radar).',
      whyItMatters: 'Die meisten CRM-Systeme fragen: Welche Unternehmen könnten meine Kunden sein? NeXus stellt eine andere Frage: Bei welchem Unternehmen gibt es genau jetzt einen konkreten Anlass, mein Angebot zu brauchen?'
    },
    'radar.trigger': {
      title: 'Identifizierter Trigger',
      whatIsIt: 'Ein Ereignis, das darauf hindeutet, dass ein Unternehmen genau jetzt einen konkreten Anlass für dein Angebot haben könnte. Aus einem bloßen Signal ist hier durch die KI ein konkreter Trigger geworden.',
      whatToDo: 'Prüfe, ob dieses Ereignis für dich logisch mit einem Kaufbedarf für dein Angebot verknüpft ist.',
      whyItMatters: 'Ein Trigger bedeutet nicht, dass ein Unternehmen nachweislich kaufen möchte. Er bedeutet, dass ein beobachtbares Ereignis einen plausiblen Anlass für deine Vertriebsansprache darstellt.'
    },
    'radar.relevance': {
      title: 'KI Begründung & Score',
      whatIsIt: 'NeXus bewertet hier, wie gut das erkannte Ereignis zu deinem Offering und deiner Zielgruppe passt. Der Score ist keine Kaufwahrscheinlichkeit, sondern drückt aus, wie plausibel der Vertriebsanlass ist.',
      whatToDo: 'Lies dir die Begründung durch. Wenn sie schlüssig ist, übernimm den Lead in deine Coach-Pipeline.',
      whyItMatters: 'NeXus behauptet keinen Kaufbedarf. Der Score hilft dir dabei einzuschätzen, welche beobachteten Ereignisse deine Aufmerksamkeit zuerst verdienen.'
    },
    'dashboard.auto_radar': {
      title: 'Signale der Nachtschicht',
      whatIsIt: 'Das Background Radar scannt das Web kontinuierlich und automatisch im Hintergrund. Nur die echten Trigger (hohe Relevanz) überleben den Filter und landen hier.',
      whatToDo: 'Gehe diese hochrelevanten Leads regelmäßig durch und überführe sie als Opportunity in deinen Sales Workspace.',
      whyItMatters: 'Du musst nicht mehr selbst manuell nach Leads suchen. Das System arbeitet für dich und serviert dir vorgefilterte, qualifizierte Vertriebschancen.'
    },
    'offering.definition': {
      title: 'Dein Offering',
      whatIsIt: 'Die digitale DNA dessen, was du verkaufst. NeXus nutzt diese Definition als "Filter-Brille", um die Relevanz von Marktereignissen überhaupt erst bewerten zu können. Ohne klares Offering ist NeXus blind.',
      whatToDo: 'Beschreibe dein Angebot und deinen konkreten Mehrwert (Value Proposition) so präzise wie möglich.',
      whyItMatters: 'NeXus ist produktagnostisch. Es weiß nur das, was du ihm über dein Angebot sagst. Je besser dein Offering definiert ist, desto präziser werden deine Trigger.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Dein Vertriebs-Cockpit. Eine Kanban-basierte Pipeline, in der Opportunities bis zum Abschluss gemanagt werden.',
      whatToDo: 'Verschiebe deine Opportunities durch die Phasen. Klicke auf eine Karte, um die Lead-Akte zu öffnen und mit dem Coach den nächsten Pitch vorzubereiten.',
      whyItMatters: 'Hier behältst du den Überblick über alle aktiven Vertriebschancen, damit kein relevanter Lead nach der Erstansprache abkühlt.'
    },
    'lead_akte.opportunity': {
      title: 'Opportunity / Lead-Akte',
      whatIsIt: 'Das Herzstück der Vertriebsarbeit. Hier bündelt NeXus alle Informationen zu einem Unternehmen und dem zugehörigen Trigger. Hier ist aus einem relevanten Trigger eine bearbeitbare Opportunity geworden.',
      whatToDo: 'Prüfe zunächst den Trigger und die Quelle. Wenn der Anlass für dein Angebot plausibel ist, kannst du den Coach nutzen, um eine perfekte Erstansprache (Pitch) zu entwerfen.',
      whyItMatters: 'Die Lead-Akte trennt sauber zwischen dem, was öffentlich beobachtet wurde (Fakt), und der daraus abgeleiteten vertrieblichen Interpretation (Trigger). Das gibt dir das Rüstzeug für einen strategischen Pitch.'
    },
    'video.finder': {
      title: 'Video Finder (Wettbewerbs-Analyse)',
      whatIsIt: 'Ein Recherche-Tool, um gezielt nach Videomaterial im Netz zu suchen.',
      whatToDo: 'Suche nach deinen Mitbewerbern, um zu analysieren, wie diese sich am Markt präsentieren. Oder recherchiere nach Videos des Unternehmens, für das du aktuell als Vertriebler tätig bist.',
      whyItMatters: 'Videomaterial verrät extrem viel über die Positionierung einer Firma. Diese "vertriebliche Recherche" hilft dir dabei, dein eigenes Angebot besser gegen Mitbewerber abzugrenzen.'
    }
  },
  en: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'The Radar scans the web for real-time signals that match your offering. In short: You do not search for companies – you search for events.',
      whatToDo: 'Select your current offering and start Deep Search to search the web manually, or check out signals from the background night shift (Auto-Radar).',
      whyItMatters: 'Most CRM systems ask: Which companies could be my customers? NeXus asks a different question: Which company has a concrete, immediate reason right now to need my offering?'
    },
    'radar.trigger': {
      title: 'Identified Trigger',
      whatIsIt: 'An event indicating that a company might have a concrete, timely need for your offering right now. AI has turned a raw signal into an actionable sales trigger.',
      whatToDo: 'Check whether this event logically links to a buying need for your offering.',
      whyItMatters: 'A trigger does not prove a company will definitely buy. It proves that an observable real-world event represents a highly plausible conversation opener.'
    },
    'radar.relevance': {
      title: 'AI Rationale & Score',
      whatIsIt: 'NeXus evaluates how closely the detected event matches your offering and target audience. The score is not a guarantee of purchase, but a measure of relevance.',
      whatToDo: 'Read through the rationale. If it makes sense, import the lead into your pipeline.',
      whyItMatters: 'NeXus makes no false claims. The score helps you prioritize which events deserve your immediate attention.'
    },
    'dashboard.auto_radar': {
      title: 'Night Shift Signals (Auto-Radar)',
      whatIsIt: 'The Background Radar continuously and automatically scans the web. Only high-relevance triggers pass the filter and land here.',
      whatToDo: 'Review these high-priority leads regularly and convert them into active opportunities in your Sales Workspace.',
      whyItMatters: 'You no longer need to manually prospect for leads. The system works for you and delivers pre-qualified sales opportunities.'
    },
    'offering.definition': {
      title: 'Your Offering',
      whatIsIt: 'The digital DNA of what you sell. NeXus uses this definition as a lens to evaluate market events. Without a clear offering, NeXus cannot filter effectively.',
      whatToDo: 'Describe your offering and value proposition as precisely as possible.',
      whyItMatters: 'NeXus is product-agnostic. It only knows what you tell it. The sharper your offering definition, the more accurate your triggers.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Your sales command center. A Kanban-based pipeline where opportunities are managed until closing.',
      whatToDo: 'Move opportunities through stages. Click a card to open the lead file and collaborate with the Coach on the next pitch.',
      whyItMatters: 'Keep a clear overview of all active sales opportunities so no lead turns cold after initial outreach.'
    },
    'lead_akte.opportunity': {
      title: 'Opportunity / Lead File',
      whatIsIt: 'The centerpiece of your sales workflow. NeXus bundles all company intelligence and the triggering event into an actionable opportunity.',
      whatToDo: 'Review the trigger and source. If the sales reason is sound, use the Coach to craft a personalized pitch.',
      whyItMatters: 'The lead file clearly separates observed facts from sales interpretations, giving you solid footing for your strategic pitch.'
    },
    'video.finder': {
      title: 'Video Finder (Competitor Intelligence)',
      whatIsIt: 'A research tool to search for video material across the web.',
      whatToDo: 'Search for competitors to analyze their positioning, or find videos from your target company.',
      whyItMatters: 'Video content reveals authentic messaging and positioning, helping you differentiate your offering.'
    }
  },
  es: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'El Radar busca en la web señales actuales que coincidan con tu oferta. En resumen: No buscas empresas, buscas eventos.',
      whatToDo: 'Selecciona tu oferta actual e inicia Deep Search para buscar manualmente en la web o revisa las señales del turno de noche automático (Auto-Radar).',
      whyItMatters: 'La mayoría de los CRM preguntan: ¿Qué empresas podrían ser mis clientes? NeXus hace una pregunta diferente: ¿En qué empresa hay un motivo concreto en este preciso momento para necesitar mi oferta?'
    },
    'radar.trigger': {
      title: 'Trigger Identificado',
      whatIsIt: 'Un evento que indica que una empresa podría tener una necesidad concreta en este momento para tu oferta.',
      whatToDo: 'Comprueba si este evento se vincula lógicamente con una necesidad de compra.',
      whyItMatters: 'Un trigger representa una oportunidad plausible para iniciar una conversación comercial de alto impacto.'
    },
    'radar.relevance': {
      title: 'Justificación y Puntuación IA',
      whatIsIt: 'NeXus evalúa qué tan bien se adapta el evento detectado a tu oferta y público objetivo.',
      whatToDo: 'Lee la justificación y traslada el lead a tu pipeline si es coherente.',
      whyItMatters: 'La puntuación te ayuda a priorizar qué eventos merecen tu atención inmediata.'
    },
    'dashboard.auto_radar': {
      title: 'Señales del Turno de Noche',
      whatIsIt: 'El Radar en segundo plano escanea la web continuamente de forma automática.',
      whatToDo: 'Revisa estos leads cualificados y pásalos a tu Sales Workspace.',
      whyItMatters: 'El sistema trabaja para ti y te entrega oportunidades de ventas prefiltradas.'
    },
    'offering.definition': {
      title: 'Tu Oferta',
      whatIsIt: 'El ADN digital de lo que vendes. NeXus utiliza esta definición para evaluar la relevancia de los eventos.',
      whatToDo: 'Describe tu oferta y propuesta de valor con la mayor precisión posible.',
      whyItMatters: 'Cuanto mejor definida esté tu oferta, más precisos serán tus triggers.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Tu centro de control de ventas basado en un pipeline Kanban.',
      whatToDo: 'Mueve las oportunidades por fases y utiliza el Coach para preparar tu próximo pitch.',
      whyItMatters: 'Mantén el control de todas tus oportunidades activas.'
    },
    'lead_akte.opportunity': {
      title: 'Expediente del Lead / Opportunity',
      whatIsIt: 'El núcleo del trabajo de ventas donde se reúnen toda la información y el trigger.',
      whatToDo: 'Revisa el trigger y crea un pitch personalizado con el Coach.',
      whyItMatters: 'Separa limpiamente hechos observados de la interpretación de ventas.'
    },
    'video.finder': {
      title: 'Video Finder (Análisis de Competencia)',
      whatIsIt: 'Herramienta de búsqueda para encontrar material en vídeo en la web.',
      whatToDo: 'Busca competidores para analizar su posicionamiento en el mercado.',
      whyItMatters: 'El contenido en vídeo revela cómo se comunican las empresas en el mercado.'
    }
  },
  fr: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'Le Radar parcourt le Web à la recherche de signaux récents correspondant à votre offre. En clair : vous ne cherchez pas des entreprises, vous cherchez des événements.',
      whatToDo: 'Sélectionnez votre offre actuelle et lancez la Deep Search pour explorer le Web manuellement ou consultez les signaux du veilleur de nuit (Auto-Radar).',
      whyItMatters: 'La plupart des CRM demandent : quelles entreprises pourraient être mes clientes ? NeXus pose une autre question : quelle entreprise a un besoin immédiat et concret de mon offre en ce moment ?'
    },
    'radar.trigger': {
      title: 'Déclencheur Identifié',
      whatIsIt: 'Un événement indiquant qu\'une entreprise pourrait avoir un besoin immédiat pour votre offre.',
      whatToDo: 'Vérifiez la pertinence de cet événement par rapport à votre offre.',
      whyItMatters: 'Un déclencheur fournit une raison concrète et crédible d\'entrer en contact.'
    },
    'radar.relevance': {
      title: 'Justification & Score IA',
      whatIsIt: 'NeXus évalue l\'adéquation entre l\'événement détecté et votre offre.',
      whatToDo: 'Lisez l\'analyse et importez le lead dans votre pipeline.',
      whyItMatters: 'Ce score vous aide à hiérarchiser les opportunités les plus prometteuses.'
    },
    'dashboard.auto_radar': {
      title: 'Signaux de Veille Automatique',
      whatIsIt: 'Le Radar en arrière-plan explore le Web en continu pour détecter des opportunités.',
      whatToDo: 'Consultez régulièrement ces signaux qualifiés et convertissez-les en opportunités.',
      whyItMatters: 'Vous gagnez du temps grâce à des opportunités pré-qualifiées.'
    },
    'offering.definition': {
      title: 'Votre Offre',
      whatIsIt: 'L\'ADN numérique de vos produits et services.',
      whatToDo: 'Décrivez précisément votre offre et votre proposition de valeur.',
      whyItMatters: 'Une offre bien définie garantit des déclencheurs ultra-pertinents.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Votre cockpit commercial Kanban pour gérer vos opportunités jusqu\'au closing.',
      whatToDo: 'Faites avancer vos opportunités et préparez vos messages avec le Coach.',
      whyItMatters: 'Ne laissez aucune opportunité se refroidir.'
    },
    'lead_akte.opportunity': {
      title: 'Fiche Prospect / Opportunité',
      whatIsIt: 'Le dossier complet rassemblant toutes les informations sur l\'entreprise et le déclencheur.',
      whatToDo: 'Examinez les faits et générez une approche sur mesure.',
      whyItMatters: 'Distingue clairement les faits réels de l\'interprétation commerciale.'
    },
    'video.finder': {
      title: 'Video Finder (Veille Concurrentielle)',
      whatIsIt: 'Outil de recherche vidéo sur le Web.',
      whatToDo: 'Analysez le positionnement de vos concurrents grâce aux vidéos.',
      whyItMatters: 'Comprenez comment vos pairs et cibles communiquent.'
    }
  },
  it: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'Il Radar scansiona il Web alla ricerca di segnali in tempo reale corrispondenti alla tua offerta. In breve: non cerchi aziende, cerchi eventi.',
      whatToDo: 'Seleziona la tua offerta attuale e avvia Deep Search per cercare manualmente sul Web o controlla i segnali del turno notturno automatico (Auto-Radar).',
      whyItMatters: 'La maggior parte dei CRM chiede: quali aziende potrebbero essere mie clienti? NeXus fa una domanda diversa: quale azienda ha un motivo concreto proprio adesso per avere bisogno della mia offerta?'
    },
    'radar.trigger': {
      title: 'Trigger Identificato',
      whatIsIt: 'Un evento che indica un\'esigenza concreta e immediata per la tua offerta.',
      whatToDo: 'Verifica la logica dell\'evento rispetto al tuo prodotto.',
      whyItMatters: 'Fornisce un\'occasione perfetta per iniziare una conversazione.'
    },
    'radar.relevance': {
      title: 'Motivazione e Punteggio IA',
      whatIsIt: 'Valutazione della corrispondenza tra l\'evento rilevato e la tua offerta.',
      whatToDo: 'Leggi la motivazione e trasferisci il lead nella pipeline.',
      whyItMatters: 'Ti aiuta a dare priorità ai lead più tempestivi.'
    },
    'dashboard.auto_radar': {
      title: 'Segnali Turno Notturno',
      whatIsIt: 'Il Radar in background scansiona continuamente il Web in automatico.',
      whatToDo: 'Esamina questi lead qualificati e trasformali in opportunità.',
      whyItMatters: 'Il sistema trova opportunità commerciali per te in autonomia.'
    },
    'offering.definition': {
      title: 'La Tua Offerta',
      whatIsIt: 'Il DNA digitale di ciò che vendi e proponi sul mercato.',
      whatToDo: 'Descrivi la tua offerta e la proposta di valore con precisione.',
      whyItMatters: 'Migliore è la definizione, più mirati saranno i trigger.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'La tua cabina di regia vendite con pipeline Kanban integrata.',
      whatToDo: 'Gestisci le fasi e collabora con il Coach per i pitch.',
      whyItMatters: 'Mantieni il pieno controllo su tutte le trattative attive.'
    },
    'lead_akte.opportunity': {
      title: 'Scheda Lead / Opportunità',
      whatIsIt: 'Il fascicolo completo che unisce dati aziendali e trigger d\'acquisto.',
      whatToDo: 'Analizza i fatti e genera una prima proposta commerciale su misura.',
      whyItMatters: 'Distingue i fatti osservati dalle deduzioni commerciali.'
    },
    'video.finder': {
      title: 'Video Finder (Analisi Concorrenza)',
      whatIsIt: 'Strumento di ricerca video mirato.',
      whatToDo: 'Analizza come i concorrenti si posizionano sul mercato.',
      whyItMatters: 'I video offrono informazioni preziose sulla comunicazione aziendale.'
    }
  },
  nl: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'De Radar doorzoekt het web naar actuele signalen die passen bij jouw aanbod. Kortom: je zoekt niet naar bedrijven – je zoekt naar gebeurtenissen.',
      whatToDo: 'Selecteer je huidige aanbod en start Deep Search om handmatig het web te doorzoeken, of bekijk signalen van de nachtdienst (Auto-Radar).',
      whyItMatters: 'De meeste CRM-systemen vragen: welke bedrijven kunnen mijn klanten zijn? NeXus stelt een andere vraag: bij welk bedrijf is er nu een concrete aanleiding om mijn aanbod nodig te hebben?'
    },
    'radar.trigger': {
      title: 'Geïdentificeerde Trigger',
      whatIsIt: 'Een gebeurtenis die wijst op een actuele behoefte aan jouw aanbod.',
      whatToDo: 'Controleer of deze gebeurtenis logisch aansluit op jouw aanbod.',
      whyItMatters: 'Een trigger vormt een geloofwaardige en actuele verkoopaanleiding.'
    },
    'radar.relevance': {
      title: 'AI Onderbouwing & Score',
      whatIsIt: 'NeXus beoordeelt hoe goed de gebeurtenis aansluit bij jouw doelgroep.',
      whatToDo: 'Lees de motivatie en voeg de lead toe aan je pipeline.',
      whyItMatters: 'De score helpt je om direct prioriteit te geven aan de beste kansen.'
    },
    'dashboard.auto_radar': {
      title: 'Nachtdienst Signalen',
      whatIsIt: 'De Achtergrond Radar scant continu en automatisch het web.',
      whatToDo: 'Bekijk deze gekwalificeerde leads en zet ze om in verkoopkansen.',
      whyItMatters: 'Het systeem levert automatisch voorgefilterde leads aan.'
    },
    'offering.definition': {
      title: 'Jouw Aanbod',
      whatIsIt: 'Het digitale DNA van wat je verkoopt.',
      whatToDo: 'Beschrijf je aanbod en waardepropositie zo helder mogelijk.',
      whyItMatters: 'Hoe beter je aanbod is gedefinieerd, hoe scherper de triggers.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Jouw Kanban-cockpit voor het beheren van verkoopkansen.',
      whatToDo: 'Verplaats kansen door de fasen en bereid pitches voor met de Coach.',
      whyItMatters: 'Houd het overzicht en laat geen enkele lead koud worden.'
    },
    'lead_akte.opportunity': {
      title: 'Lead Dossier / Opportuniteit',
      whatIsIt: 'Het centrale dossier met alle bedrijfsinformatie en triggers.',
      whatToDo: 'Bekijk de feiten en maak een persoonlijke openingsboodschap.',
      whyItMatters: 'Scheidt feiten helder van commerciële interpretaties.'
    },
    'video.finder': {
      title: 'Video Finder (Concurrentie-Analyse)',
      whatIsIt: 'Onderzoekstool voor videomateriaal op het web.',
      whatToDo: 'Analyseer hoe concurrenten zich profileren.',
      whyItMatters: 'Videomateriaal biedt inzicht in marktpositionering.'
    }
  },
  el: {
    'radar.title': {
      title: 'Lead Radar',
      whatIsIt: 'Το Ραντάρ σαρώνει το διαδίκτυο για πρόσφατα σήματα που ταιριάζουν με την προσφορά σας. Εν συντομία: δεν ψάχνετε για εταιρείες – ψάχνετε για γεγονότα.',
      whatToDo: 'Επιλέξτε την τρέχουσα προσφορά σας και ξεκινήστε το Deep Search για χειροκίνητη αναζήτηση ή ελέγξτε τα σήματα του αυτόματου ραντάρ.',
      whyItMatters: 'Τα περισσότερα συστήματα CRM ρωτούν: Ποιες εταιρείες θα μπορούσαν να είναι πελάτες μου; Το NeXus θέτει μια διαφορετική ερώτηση: Σε ποια εταιρεία υπάρχει αυτή τη στιγμή μια συγκεκριμένη αφορμή για να χρειαστεί την προσφορά μου;'
    },
    'radar.trigger': {
      title: 'Εντοπισμένος Trigger',
      whatIsIt: 'Ένα γεγονός που υποδεικνύει ότι μια επιχείρηση ενδέχεται να έχει άμεση ανάγκη για την προσφορά σας.',
      whatToDo: 'Ελέγξτε αν αυτό το γεγονός συνδέεται λογικά με την προσφορά σας.',
      whyItMatters: 'Ένας trigger προσφέρει μια εξαιρετική αφορμή για στοχευμένη επικοινωνία.'
    },
    'radar.relevance': {
      title: 'Αιτιολόγηση & Βαθμολογία AI',
      whatIsIt: 'Το NeXus αξιολογεί πόσο ταιριάζει το γεγονός με την προσφορά και το κοινό-στόχο σας.',
      whatToDo: 'Διαβάστε την αιτιολόγηση και προσθέστε το lead στον αγωγό πωλήσεων.',
      whyItMatters: 'Βοηθά στον άμεσο εντοπισμό και ιεράρχηση των πιο υποσχόμενων ευκαιριών.'
    },
    'dashboard.auto_radar': {
      title: 'Σήματα Αυτόματου Ραντάρ',
      whatIsIt: 'Το ραντάρ παρασκηνίου σαρώνει συνεχώς και αυτόματα το διαδίκτυο.',
      whatToDo: 'Ελέγξτε αυτά τα leads και μεταφέρετέ τα στο Sales Workspace.',
      whyItMatters: 'Το σύστημα εργάζεται για εσάς και παραδίδει προεπιλεγμένες ευκαιρίες.'
    },
    'offering.definition': {
      title: 'Η Προσφορά Σας',
      whatIsIt: 'Το ψηφιακό DNA αυτού που πουλάτε.',
      whatToDo: 'Περιγράψτε την προσφορά και την πρόταση αξίας σας με ακρίβεια.',
      whyItMatters: 'Όσο καλύτερα ορίζεται η προσφορά, τόσο πιο ακριβείς είναι οι triggers.'
    },
    'workspace.pipeline': {
      title: 'Sales Workspace',
      whatIsIt: 'Ο πίνακας ελέγχου πωλήσεων Kanban για τη διαχείριση ευκαιριών.',
      whatToDo: 'Μετακινήστε τις ευκαιρίες στα στάδια και ετοιμάστε pitch με τον Coach.',
      whyItMatters: 'Διατηρήστε πλήρη εικόνα για όλες τις ενεργές πωλήσεις.'
    },
    'lead_akte.opportunity': {
      title: 'Φάκελος Lead / Ευκαιρία',
      whatIsIt: 'Ο ολοκληρωμένος φάκελος με πληροφορίες εταιρείας και trigger.',
      whatToDo: 'Εξετάστε τα γεγονότα και δημιουργήστε εξατομικευμένη προσέγγιση.',
      whyItMatters: 'Διαχωρίζει καθαρά τα πραγματικά γεγονότα από την εμπορική ερμηνεία.'
    },
    'video.finder': {
      title: 'Video Finder (Ανάλυση Ανταγωνισμού)',
      whatIsIt: 'Εργαλείο αναζήτησης βίντεο στο διαδίκτυο.',
      whatToDo: 'Αναζητήστε ανταγωνιστές για να δείτε την τοποθέτησή τους.',
      whyItMatters: 'Τα βίντεο αποκαλύπτουν πολλά για την τοποθέτηση στην αγορά.'
    }
  }
};

export function getGuideItem(key, lang = 'de') {
  const langDict = GUIDE_CONTENT_I18N[lang] || GUIDE_CONTENT_I18N['de'];
  if (langDict && langDict[key]) return langDict[key];
  return GUIDE_CONTENT_I18N['de'][key] || null;
}

export const GUIDE_CONTENT = GUIDE_CONTENT_I18N['de'];
