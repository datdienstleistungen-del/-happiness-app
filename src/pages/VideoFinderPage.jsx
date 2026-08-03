import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Download, Sparkles, Check, Copy, ArrowRight, Play, Pause } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStudio } from '../context/StudioContext'
import { useLanguage } from '../i18n/translations'
import './VideoFinderPage.css'

const PRESET_CATEGORIES = [
  { id: 'satisfying', label: '🌊 Satisfying (ASMR)', query: 'satisfying' },
  { id: 'gaming', label: '🎮 Gaming / Loops', query: 'gaming' },
  { id: 'prank', label: '🎭 Pranks & Fails', query: 'prank' },
  { id: 'soccer', label: '⚽ Fußball-Clips', query: 'football' },
  { id: 'timelapse', label: '⏱️ Zeitraffer (Timelapse)', query: 'timelapse' },
  { id: 'sports', label: '🏂 Extremsport', query: 'extreme sports' },
  { id: 'comedy', label: '😂 Comedy & Funny', query: 'comedy' },
  { id: 'kurios', label: '🤯 Kuriositäten', query: 'unusual strange' }
]

async function extractFramesFromVideo(videoSrc, maxFrames = 5) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      const duration = video.duration
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const effectiveDuration = Math.min(duration, 60)
      const interval = effectiveDuration / maxFrames
      const scale = Math.min(1, 256 / (video.videoWidth || 640))
      canvas.width = Math.round((video.videoWidth || 640) * scale)
      canvas.height = Math.round((video.videoHeight || 360) * scale)
      const frames = []
      for (let i = 0; i < maxFrames; i++) {
        const time = i * interval
        try {
          video.currentTime = time
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error('seek timeout')), 3000)
            video.onseeked = () => { clearTimeout(timeout); res() }
          })
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.4)
          frames.push(dataUrl)
        } catch (e) { console.warn('Frame fail:', e) }
      }
      video.src = ''
      resolve(frames)
    }
    video.onerror = () => reject(new Error('Video CORS error'))
    video.src = videoSrc
  })
}

export default function VideoFinderPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const [chatInput, setChatInput] = useState('')
  const [analyzingFrames, setAnalyzingFrames] = useState(false)

  const getTxt = (key) => {
    const dict = {
      de: {
        viralTitle: 'Finde virale Clips direkt an der Quelle',
        viralSub: 'Such auf YouTube oder TikTok nach hochaktiven Inhalten, kopiere den Link und füge ihn unten ein.',
        searchPlaceholder: 'Suchbegriff...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Video-Link importieren',
        labelUrl: '1. Video-URL',
        labelTopic: '2. Worum geht es? (Thema)',
        placeholderUrl: 'z. B. https://www.youtube.com/shorts/...',
        placeholderTopic: 'z. B. Hund rutscht auf Banane aus...',
        btnImport: 'Video verknüpfen & Skript schreiben',
        archiveTitle: '🏛️ Internet Archive — Public Domain Videos',
        archiveSub: 'Kostenlose, rechtlich sichere Videos. Alle Inhalte sind Public Domain oder Creative Commons.',
        archiveTip: 'Tipp: Die meisten Archiv-Videos sind Querformat (16:9). In CapCut auf 9:16 stellen und heranzoomen.',
        archiveLoading: 'Internet Archive wird durchsucht...',
        archiveEmpty: 'Keine freien Public Domain Videos zu diesem Suchbegriff gefunden. Bitte versuche es mit englischen Schlagwörtern.',
        archiveInfo: 'Suche nach Public Domain Videos.',
        mixkitTitle: '📱 Mixkit — Kostenlose Stock-Videos',
        mixkitSub: 'Hochwertige, kostenlose Videos. Viele bereits im vertikalen 9:16-Format.',
        mixkitLoading: 'Mixkit wird durchsucht...',
        mixkitEmpty: 'Keine Mixkit-Videos zu diesem Suchbegriff gefunden. Bitte versuche es mit englischen Schlagwörtern.',
        mixkitInfo: 'Suche nach kostenlosen Stock-Videos.',
        otherSources: '🔗 Weitere rechtlich sichere Quellen',
        detailsTitle: 'Videodetails & Skript',
        openArchive: '🏛️ Im Internet Archive ansehen',
        openOriginal: '🌐 Original-Video öffnen',
        downloadVideo: 'Video herunterladen',
        downloadTip: '* Tipp: Falls das Video im neuen Tab abspielt, klicke im Player auf die drei Punkte (...) und wähle "Herunterladen" oder nutze Rechtsklick &rarr; "Video speichern unter".',
        downloadManual: 'Automatischer Download nicht möglich (hier manuell wählen)',
        labelTone: 'Tonalität des Skripts',
        labelInstructions: 'Spezielle Anweisungen (optional)',
        placeholderInstructions: 'z. B. "Fokus auf Gesichtsausdruck" oder "Keine Emojis"...',
        btnGenScript: 'KI-Skript erstellen',
        genScriptLoading: 'KI formuliert das Skript...',
        exportCapcut: 'An CapCut Studio senden',
        errorArchive: 'Fehler bei der Internet Archive Suche. Bitte versuche es noch einmal.',
        errorMixkit: 'Fehler bei der Mixkit Suche. Bitte versuche es noch einmal.',
        btnBack: 'Zurück'
      },
      en: {
        viralTitle: 'Find viral clips directly at the source',
        viralSub: 'Search on YouTube or TikTok for highly active content, copy the link and paste it below.',
        searchPlaceholder: 'Search term...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Import video link',
        labelUrl: '1. Video URL',
        labelTopic: '2. What is it about? (Topic)',
        placeholderUrl: 'e.g. https://www.youtube.com/shorts/...',
        placeholderTopic: 'e.g. Dog slipping on banana peel...',
        btnImport: 'Link video & write script',
        archiveTitle: '🏛️ Internet Archive — Public Domain Videos',
        archiveSub: 'Free, legally safe videos. All content is Public Domain or Creative Commons.',
        archiveTip: 'Tip: Most archive videos are landscape (16:9). Set to 9:16 in CapCut and zoom in.',
        archiveLoading: 'Searching Internet Archive...',
        archiveEmpty: 'No free Public Domain videos found for this search term. Please try with English keywords.',
        archiveInfo: 'Search for Public Domain videos.',
        mixkitTitle: '📱 Mixkit — Free Stock Videos',
        mixkitSub: 'High quality, free videos. Many already in vertical 9:16 format.',
        mixkitLoading: 'Searching Mixkit...',
        mixkitEmpty: 'No Mixkit videos found for this search term. Please try with English keywords.',
        mixkitInfo: 'Search for free stock videos.',
        otherSources: '🔗 Other legally safe sources',
        detailsTitle: 'Video details & script',
        openArchive: '🏛️ View in Internet Archive',
        openOriginal: '🌐 Open original video',
        downloadVideo: 'Download video',
        downloadTip: '* Tip: If the video plays in a new tab, click the three dots (...) in the player and select "Download" or right-click & choose "Save video as".',
        downloadManual: 'Automatic download not possible (select manually here)',
        labelTone: 'Script tone',
        labelInstructions: 'Special instructions (optional)',
        placeholderInstructions: 'e.g. "Focus on facial expression" or "No emojis"...',
        btnGenScript: 'Create AI script',
        genScriptLoading: 'AI is formulating the script...',
        exportCapcut: 'Send to CapCut Studio',
        errorArchive: 'Error searching Internet Archive. Please try again.',
        errorMixkit: 'Error searching Mixkit. Please try again.',
        btnBack: 'Back'
      },
      nl: {
        viralTitle: 'Vind virale clips direct bij de bron',
        viralSub: 'Zoek op YouTube of TikTok naar zeer actieve inhoud, kopieer de link en plak deze hieronder.',
        searchPlaceholder: 'Zoekterm...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Video-link importeren',
        labelUrl: '1. Video-URL',
        labelTopic: '2. Waar gaat het over? (Onderwerp)',
        placeholderUrl: 'bijv. https://www.youtube.com/shorts/...',
        placeholderTopic: 'bijv. Hond glijdt uit over bananenschil...',
        btnImport: 'Video koppelen & script schrijven',
        archiveTitle: '🏛️ Internet Archive — Public Domain Video\'s',
        archiveSub: 'Gratis, juridisch veilige video\'s. Alle inhoud is openbaar domein of Creative Commons.',
        archiveTip: 'Tip: De meeste archiefvideo\'s zijn in liggend formaat (16:9). Stel in CapCut in op 9:16 en zoom in.',
        archiveLoading: 'Zoeken in Internet Archive...',
        archiveEmpty: 'Geen gratis Public Domain video\'s gevonden voor deze zoekterm. Probeer het met Engelse trefwoorden.',
        archiveInfo: 'Zoek naar Public Domain video\'s.',
        mixkitTitle: '📱 Mixkit — Gratis Stock Video\'s',
        mixkitSub: 'Hoogwaardige, gratis video\'s. Vele al in verticaal 9:16-formaat.',
        mixkitLoading: 'Zoeken in Mixkit...',
        mixkitEmpty: 'Geen Mixkit video\'s gevonden voor deze zoekterm. Probeer het met Engelse trefwoorden.',
        mixkitInfo: 'Zoek naar gratis stockvideo\'s.',
        otherSources: '🔗 Andere juridisch veilige bronnen',
        detailsTitle: 'Videodetails & script',
        openArchive: '🏛️ Bekijken in Internet Archive',
        openOriginal: '🌐 Originele video openen',
        downloadVideo: 'Video downloaden',
        downloadTip: '* Tip: Als de video in een nieuw tabblad wordt afgespeeld, klik dan op de drie stipjes (...) in de speler en selecteer "Downloaden" of klik met de rechtermuisknop en kies "Video opslaan als".',
        downloadManual: 'Automatische download niet mogelijk (hier handmatig selecteren)',
        labelTone: 'Tonaliteit van het script',
        labelInstructions: 'Speciale instructies (optioneel)',
        placeholderInstructions: 'bijv. "Focus op gezichtsuitdrukking" of "Geen emoji\'s"...',
        btnGenScript: 'KI-script maken',
        genScriptLoading: 'KI is het script aan het formuleren...',
        exportCapcut: 'Naar CapCut Studio sturen',
        errorArchive: 'Fout bij het zoeken in Internet Archive. Probeer het opnieuw.',
        errorMixkit: 'Fout bij het zoeken in Mixkit. Probeer het opnieuw.',
        btnBack: 'Terug'
      },
      es: {
        viralTitle: 'Encuentra clips virales directamente en la fuente',
        viralSub: 'Busca contenido altamente activo en YouTube o TikTok, copia el enlace y pégalo abajo.',
        searchPlaceholder: 'Término de búsqueda...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Importar enlace de video',
        labelUrl: '1. URL del video',
        labelTopic: '2. ¿De qué se trata? (Tema)',
        placeholderUrl: 'ej. https://www.youtube.com/shorts/...',
        placeholderTopic: 'ej. Perro resbalando con cáscara de plátano...',
        btnImport: 'Vincular video y escribir guion',
        archiveTitle: '🏛️ Internet Archive — Videos de Dominio Público',
        archiveSub: 'Videos gratuitos y legalmente seguros. Todo el contenido es Dominio Público o Creative Commons.',
        archiveTip: 'Consejo: La mayoría de los videos de archivo son horizontales (16:9). Configura a 9:16 en CapCut y haz zoom.',
        archiveLoading: 'Buscando en Internet Archive...',
        archiveEmpty: 'No se encontraron videos gratuitos de Dominio Público para este término de búsqueda. Intente con palabras clave en inglés.',
        archiveInfo: 'Buscar videos de Dominio Público.',
        mixkitTitle: '📱 Mixkit — Videos de Stock Gratuitos',
        mixkitSub: 'Videos gratuitos de alta calidad. Muchos ya en formato vertical 9:16.',
        mixkitLoading: 'Buscando en Mixkit...',
        mixkitEmpty: 'No se encontraron videos de Mixkit para este término de búsqueda. Intente con palabras clave en inglés.',
        mixkitInfo: 'Buscar videos de stock gratuitos.',
        otherSources: '🔗 Otras fuentes legalmente seguras',
        detailsTitle: 'Detalles del video y guion',
        openArchive: '🏛️ Ver en Internet Archive',
        openOriginal: '🌐 Abrir video original',
        downloadVideo: 'Descargar video',
        downloadTip: '* Consejo: Si el video se reproduce en una nueva pestaña, haz clic en los tres puntos (...) en el reproductor y selecciona "Descargar" o haz clic derecho y elige "Guardar video como".',
        downloadManual: 'Descarga automática no disponible (seleccionar manualmente aquí)',
        labelTone: 'Tono del guion',
        labelInstructions: 'Instrucciones especiales (opcional)',
        placeholderInstructions: 'ej. "Enfoque en la expresión facial" o "Sin emojis"...',
        btnGenScript: 'Crear guion con IA',
        genScriptLoading: 'La IA está formulando el guion...',
        exportCapcut: 'Enviar a CapCut Studio',
        errorArchive: 'Error al buscar en Internet Archive. Intente de nuevo.',
        errorMixkit: 'Error al buscar en Mixkit. Intente de nuevo.',
        btnBack: 'Volver'
      },
      fr: {
        viralTitle: 'Trouvez des clips viraux directement à la source',
        viralSub: 'Recherchez du contenu très actif sur YouTube ou TikTok, copiez le lien et collez-le ci-dessous.',
        searchPlaceholder: 'Terme de recherche...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Importer le lien vidéo',
        labelUrl: '1. URL de la vidéo',
        labelTopic: '2. De quoi s\'agit-il ? (Sujet)',
        placeholderUrl: 'ex. https://www.youtube.com/shorts/...',
        placeholderTopic: 'ex. Chien glissant sur une peau de banane...',
        btnImport: 'Lier la vidéo & écrire le script',
        archiveTitle: '🏛️ Internet Archive — Vidéos du Domaine Public',
        archiveSub: 'Vidéos gratuites et légalement sûres. Tout le contenu est dans le Domaine Public ou Creative Commons.',
        archiveTip: 'Conseil : La plupart des vidéos d\'archives sont au format paysage (16:9). Réglez sur 9:16 dans CapCut et zoomez.',
        archiveLoading: 'Recherche dans Internet Archive...',
        archiveEmpty: 'Aucune vidéo gratuite du Domaine Public trouvée pour ce terme de recherche. Veuillez essayer avec des mots-clés en anglais.',
        archiveInfo: 'Rechercher des vidéos du Domaine Public.',
        mixkitTitle: '📱 Mixkit — Vidéos Stock Gratuites',
        mixkitSub: 'Vidéos gratuites de haute qualité. Beaucoup déjà au format vertical 9:16.',
        mixkitLoading: 'Recherche dans Mixkit...',
        mixkitEmpty: 'Aucune vidéo Mixkit trouvée pour ce terme de recherche. Veuillez essayer avec des mots-clés en anglais.',
        mixkitInfo: 'Rechercher des vidéos stock gratuites.',
        otherSources: '🔗 Autres sources légalement sûres',
        detailsTitle: 'Détails de la vidéo & script',
        openArchive: '🏛️ Voir sur Internet Archive',
        openOriginal: '🌐 Ouvrir la vidéo d\'origine',
        downloadVideo: 'Télécharger la vidéo',
        downloadTip: '* Conseil : Si la vidéo se lance dans un nouvel onglet, cliquez sur les trois points (...) du lecteur et sélectionnez "Télécharger" ou faites un clic droit et choisissez "Enregistrer la vidéo sous".',
        downloadManual: 'Téléchargement automatique impossible (sélectionner manuellement ici)',
        labelTone: 'Tonalité du script',
        labelInstructions: 'Instructions spéciales (optionnel)',
        placeholderInstructions: 'ex. "Mettre l\'accent sur l\'expression du visage" ou "Pas d\'émojis"...',
        btnGenScript: 'Créer le script avec l\'IA',
        genScriptLoading: 'L\'A.I. formule le script...',
        exportCapcut: 'Envoyer à CapCut Studio',
        errorArchive: 'Erreur lors de la recherche dans Internet Archive. Veuillez réessayer.',
        errorMixkit: 'Erreur lors de la recherche dans Mixkit. Veuillez réessayer.',
        btnBack: 'Retour'
      },
      it: {
        viralTitle: 'Trova clip virali direttamente alla fonte',
        viralSub: 'Cerca contenuti altamente attivi su YouTube o TikTok, copia il link e incollalo di seguito.',
        searchPlaceholder: 'Termine di ricerca...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Importa link video',
        labelUrl: '1. URL del video',
        labelTopic: '2. Di cosa si tratta? (Argomento)',
        placeholderUrl: 'es. https://www.youtube.com/shorts/...',
        placeholderTopic: 'es. Cane che scivola su una buccia di banana...',
        btnImport: 'Collega video e scrivi copione',
        archiveTitle: '🏛️ Internet Archive — Video di Pubblico Dominio',
        archiveSub: 'Video gratuiti e legalmente sicuri. Tutti i contenuti sono di Pubblico Dominio o Creative Commons.',
        archiveTip: 'Consiglio: La maggior parte dei video d\'archivio è in formato orizzontale (16:9). Imposta su 9:16 in CapCut e ingrandisci.',
        archiveLoading: 'Ricerca in Internet Archive...',
        archiveEmpty: 'Nessun video gratuito di Pubblico Dominio trovato per questo termine di ricerca. Prova con parole chiave in inglese.',
        archiveInfo: 'Cerca video di Pubblico Dominio.',
        mixkitTitle: '📱 Mixkit — Video Stock Gratuiti',
        mixkitSub: 'Video gratuiti di alta qualità. Molti già in formato verticale 9:16.',
        mixkitLoading: 'Ricerca in Mixkit...',
        mixkitEmpty: 'Nessun video Mixkit trovato per questo termine di ricerca. Prova con parole chiave in inglese.',
        mixkitInfo: 'Cerca video stock gratuiti.',
        otherSources: '🔗 Altre fonti legalmente sicure',
        detailsTitle: 'Dettagli del video e copione',
        openArchive: '🏛️ Visualizza su Internet Archive',
        openOriginal: '🌐 Apri video originale',
        downloadVideo: 'Scarica video',
        downloadTip: '* Consiglio: Se il video viene riprodotto in una nuova scheda, fai clic sui tre punti (...) nel lettore e seleziona "Scarica" o fai clic con il pulsante destro del mouse e scegli "Salva video come".',
        downloadManual: 'Download automatico non disponibile (seleziona manualmente qui)',
        labelTone: 'Tonalità del copione',
        labelInstructions: 'Istruzioni speciali (opzionale)',
        placeholderInstructions: 'es. "Focus sull\'espressione facciale" o "Senza emoji"...',
        btnGenScript: 'Crea copione con l\'AI',
        genScriptLoading: 'L\'AI sta formulando il copione...',
        exportCapcut: 'Invia a CapCut Studio',
        errorArchive: 'Errore durante la ricerca in Internet Archive. Riprova.',
        errorMixkit: 'Errore durante la ricerca in Mixkit. Riprova.',
        btnBack: 'Indietro'
      },
      el: {
        viralTitle: 'Βρείτε viral κλιπ απευθείας στην πηγή',
        viralSub: 'Αναζητήστε εξαιρετικά ενεργό περιεχόμενο στο YouTube ή στο TikTok, αντιγράψτε το σύνδεσμο και επικολλήστε τον παρακάτω.',
        searchPlaceholder: 'Όρος αναζήτησης...',
        ytShorts: '🌐 YouTube Shorts',
        tiktok: '📱 TikTok',
        importTitle: '🔗 Εισαγωγή συνδέσμου βίντεο',
        labelUrl: '1. URL βίντεο',
        labelTopic: '2. Περί τίνος πρόκειται; (Θέμα)',
        placeholderUrl: 'π.χ. https://www.youtube.com/shorts/...',
        placeholderTopic: 'π.χ. Σκύλος γλιστράει σε φλούδα μπανάνας...',
        btnImport: 'Σύνδεση βίντεο & συγγραφή σεναρίου',
        archiveTitle: '🏛️ Internet Archive — Βίντεο Κοινού Κτήματος',
        archiveSub: 'Δωρεάν, νομικά ασφαλή βίντεο. Όλο το περιεχόμενο είναι Κοινού Κτήματος (Public Domain) ή Creative Commons.',
        archiveTip: 'Συμβουλή: Τα περισσότερα βίντεο αρχείου είναι οριζόντια (16:9). Ορίστε σε 9:16 στο CapCut και κάντε ζουμ.',
        archiveLoading: 'Αναζήτηση στο Internet Archive...',
        archiveEmpty: 'Δεν βρέθηκαν δωρεάν βίντεο Κοινού Κτήματος για αυτόν τον όρο αναζήτησης. Δοκιμάστε με αγγλικές λέξεις-κλειδιά.',
        archiveInfo: 'Αναζήτηση για βίντεο Κοινού Κτήματος.',
        mixkitTitle: '📱 Mixkit — Δωρεάν Stock Βίντεο',
        mixkitSub: 'Υψηλής ποιότητας, δωρεάν βίντεο. Πολλά ήδη σε κατακόρυφη μορφή 9:16.',
        mixkitLoading: 'Αναζήτηση στο Mixkit...',
        mixkitEmpty: 'Δεν βρέθηκαν βίντεο Mixkit για αυτόν τον όρο αναζήτησης. Δοκιμάστε με αγγλικές λέξεις-κλειδιά.',
        mixkitInfo: 'Αναζήτηση για δωρεάν stock βίντεο.',
        otherSources: '🔗 Άλλες νομικά ασφαλή πηγές',
        detailsTitle: 'Λεπτομέρειες βίντεο & σενάριο',
        openArchive: '🏛️ Προβολή στο Internet Archive',
        openOriginal: '🌐 Άνοιγμα αρχικού βίντεο',
        downloadVideo: 'Λήψη βίντεο',
        downloadTip: '* Συμβουλή: Εάν το βίντεο αναπαράγεται σε νέα καρτέλα, κάντε κλικ στις τρεις τελείες (...) στο πρόγραμμα αναπαραγωγής και επιλέξτε "Λήψη" ή κάντε δεξί κλικ και επιλέξτε "Αποθήκευση βίντεο ως".',
        downloadManual: 'Η αυτόματη λήψη δεν είναι δυνατή (επιλέξτε μη αυτόματα εδώ)',
        labelTone: 'Τόνος σεναρίου',
        labelInstructions: 'Ειδικές οδηγίες (προαιρετικά)',
        placeholderInstructions: 'π.χ. "Εστίαση στην έκφραση του προσώπου" ή "Χωρίς emoji"...',
        btnGenScript: 'Δημιουργία σεναρίου με AI',
        genScriptLoading: 'Το AI διαμορφώνει το σενάριο...',
        exportCapcut: 'Αποστολή στο CapCut Studio',
        errorArchive: 'Σφάλμα κατά την αναζήτηση στο Internet Archive. Δοκιμάστε ξανά.',
        errorMixkit: 'Σφάλμα κατά την αναζήτηση στο Mixkit. Δοκιμάστε ξανά.',
        btnBack: 'Επιστροφή'
      }
    }
    return dict[lang]?.[key] || dict['en']?.[key] || key
  }


  const {
    query, setQuery,
    videos, setVideos,
    loading, setLoading,
    pexelsSearched, setPexelsSearched,
    selectedVideo, setSelectedVideo,
    selectedTone, setSelectedTone,
    customInstructions, setCustomInstructions,
    generatingScript, setGeneratingScript,
    generatedScript, setGeneratedScript,
    copied, setCopied,
    error, setError,
    activeSource, setActiveSource,
    importedUrl, setImportedUrl,
    topic, setTopic,
    archiveVideos, setArchiveVideos,
    archiveLoading, setArchiveLoading,
    archiveQuery, setArchiveQuery,
    archiveSearched, setArchiveSearched,
    mixkitVideos, setMixkitVideos,
    mixkitLoading, setMixkitLoading,
    mixkitQuery, setMixkitQuery,
    mixkitSearched, setMixkitSearched
  } = useStudio()

  async function handleSearch(searchQuery) {
    const term = searchQuery || query
    if (!term.trim()) return

    setLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/pexels-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const data = await res.json()
      setVideos(data.videos || [])
      setPexelsSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Video Search Error]', e)
      setError(t('videoFinder.errorSearch'))
    } finally {
      setLoading(false)
    }
  }

  const searchExternal = (platform) => {
    const term = query.trim() || 'viral clip'
    let url = ''
    if (platform === 'youtube') {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}+shorts`
    } else {
      url = `https://www.tiktok.com/search?q=${encodeURIComponent(term)}`
    }
    window.open(url, '_blank')
  }

  const handleImportVideo = () => {
    if (!importedUrl.trim()) {
      setError(t('videoScript.errorUrlOrFile'))
      return
    }
    if (!topic.trim()) {
      setError(t('videoScript.needsDescription'))
      return
    }
    setError('')

    const mockVideo = {
      id: 'viral-import',
      url: importedUrl,
      title: topic,
      duration: 15,
      width: 1080,
      height: 1920
    }

    setSelectedVideo(mockVideo)
  }

  async function generateScriptForVideo() {
    if (!selectedVideo || generatingScript) return

    setGeneratingScript(true)
    setError('')
    setGeneratedScript(null)
    setAnalyzingFrames(false)

    // Versuche, Frames für GPT-4o Vision zu extrahieren (falls CORS es erlaubt)
    let frames = []
    if (selectedVideo.hasVideo !== false && selectedVideo.id !== 'viral-import') {
      setAnalyzingFrames(true)
      try {
        frames = await extractFramesFromVideo(selectedVideo.url, 4)
      } catch (err) {
        console.warn('Daumenkino gescheitert (CORS). Sende nur Text-Metadaten.', err)
      }
      setAnalyzingFrames(false)
    }

    const scriptTopic = activeSource === 'viral' ? topic : (query || 'Unterhaltung')
    const userPrompt = chatInput ? chatInput.trim() : 'Ich brauche ein witziges, virales TikTok-Video daraus.'

    const languageNames = {
      de: 'deutscher', en: 'englischer', es: 'spanischer', fr: 'französischer', it: 'italienischer', nl: 'niederländischer', el: 'griechischer'
    }
    const currentLanguageName = languageNames[lang] || 'deutscher'

    const systemPrompt = `Du bist die "Video-Ideenschmiede" (H.I.T. Regisseur).
Deine Aufgabe: Der User gibt dir (falls möglich) Bilder aus einem gefundenen Video.
Hier sind die Metadaten des ausgewählten Videos:
- Video-Titel: "${selectedVideo?.title || 'Unbekannt'}"
- Suchbegriff / Kategorie: "${scriptTopic}"

Der User hat folgende spezifische Idee / Anforderung formuliert: "${userPrompt}"

WICHTIG: Erstelle das Skript passend zum ECHTEN Video-Titel oben. Kopiere NICHT das Pudding-Beispiel!
Erstelle aus diesem Video einen exakten SCHRITT-FÜR-SCHRITT BAUPLAN (Schnittanweisung & Voiceover), damit der User das Video manuell in CapCut schneiden kann.
Schreibe in ${currentLanguageName} Sprache.

### 🚀 TIKTOK / GEN-Z STYLE REGELN:
1. Sei NICHT langweilig. Das muss Gen-Z von den Socken hauen!
2. Nutze schnelle Schnitte, absurde Soundeffekte, unvorhersehbare Hooks und modernen Internet-Slang (authentisch, ohne cringe zu wirken).
3. Integriere aktuelle Trend-Musik (Phonk, Sped-up, Trap-Remixe, etc.) in die "music_suggestion".
4. Der Hook muss absolut wahnsinnig sein und sofort die Aufmerksamkeit catchen (Brainrot-Elemente erlaubt, wenn es zum Vibe passt).

5. Sei extrem KONKRET! Schreibe NIEMALS generische Platzhalter wie "Schneide auf eine ungewöhnliche Szene" oder "Zoom auf ein Detail". 
6. ERFINDE (halluziniere) stattdessen konkrete, absurde und spezifische Bild-Szenen, die exakt zum Titel passen könnten (z.B. "Zoom extrem nah auf das wütende Auge von Popeye" statt "Zeige eine Emotion"). Erschaffe eine richtige Story!

Strukturiere deine Antwort ZWINGEND als JSON:
{
  "video_title": "Titel der Video-Idee",
  "voiceover_script": "Zusammenfassung",
  "music_suggestion": "Empfehlung für einen TikTok-Sound/Musik (z.B. 'Phonk drift', 'Sped up R&B', 'SpongeBob trap remix')",
  "publishing_payload": {
    "tiktok_instagram": {
      "hook": "Der Hook-Satz (die ersten 3 Sekunden)",
      "description": "Die Video-Beschreibung inkl. Hashtags"
    }
  },
  "blueprint": [
    {
      "step": 1,
      "timestamp": "0-3s",
      "instruction": "Schneide hier hart auf die Szene mit der Schüssel. Füge dicken Text 'WTF 1950s' in die Mitte ein.",
      "voiceover": "Wusstet ihr, dass Pudding früher SO aussah?"
    },
    {
      "step": 2,
      "timestamp": "3-8s",
      "instruction": "Zoom auf das Gesicht. Erhöhe die Geschwindigkeit auf 1.5x.",
      "voiceover": "Das Zeug bestand gefühlt nur aus Beton und Zucker..."
    }
  ]
}

Antworte AUSSCHLIESSLICH mit dem validen JSON-Objekt. Schreibe keinen anderen Text davor oder danach.`

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const userRes = await supabase.auth.getUser()
      const userId = userRes.data.user?.id

      const reqConfig = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userPrompt,
          systemPrompt,
          userId,
          history: [],
          videoEditor: 'capcut'
        })
      }

      if (frames.length > 0) {
        const bodyObj = JSON.parse(reqConfig.body)
        bodyObj.imagesBase64 = frames
        reqConfig.body = JSON.stringify(bodyObj)
      }

      const res = await fetch('/api/chat', reqConfig)

      if (!res.ok) {
        let backendErr = `HTTP-Fehler ${res.status}`
        try {
          const errData = await res.json()
          if (errData.error) backendErr = errData.error
        } catch(e) {}
        throw new Error(backendErr)
      }

      const resData = await res.json()
      let cleaned = resData.response || ''
      const firstBrace = cleaned.indexOf('{')
      const lastBrace = cleaned.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1)
      }

      const parsedRecipe = JSON.parse(cleaned)
      setGeneratedScript(parsedRecipe)

      // Silent usage logging
      if (userId) {
        supabase.from('usage_events').insert({
          user_id: userId,
          event_type: 'script_generated'
        }).then()
      }
    } catch (e) {
      console.error('[Script Generation Error]', e)
      setError(e.message || t('videoScript.errorGeneration'))
    } finally {
      setGeneratingScript(false)
    }
  }

  const handleCopyScript = () => {
    if (!generatedScript) return
    const textToCopy = `${generatedScript.video_title}\n\n${generatedScript.voiceover_script}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToCapCut = () => {
    if (!generatedScript || !selectedVideo) return

    const scriptTopic = activeSource === 'viral' ? topic : (query || 'Action')

    const recipeToImport = {
      video_title: generatedScript.video_title,
      voiceover_script: generatedScript.voiceover_script,
      scenes: generatedScript.scenes.map((s, i) => ({
        timestamp: s.timestamp,
        spoken_text: s.spoken_text,
        visual_prompt: `cinematic shot, stock video of ${scriptTopic}, photorealistic, 4k, --ar 9:16`
      })),
      publishing_payload: generatedScript.publishing_payload
    }

    navigate('/capcut-studio', {
      state: {
        postText: generatedScript.video_title,
        pipelineResult: {
          recipe: recipeToImport
        }
      }
    })
  }

  async function handleArchiveSearch(searchQuery) {
    const term = searchQuery || archiveQuery
    if (!term.trim()) return

    setArchiveLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)

    try {
      const res = await fetch('/api/archive-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const data = await res.json()
      setArchiveVideos(data.videos || [])
      setArchiveSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Archive Search Error]', e)
      setError(getTxt('errorArchive'))
    } finally {
      setArchiveLoading(false)
    }
  }

  async function handleMixkitSearch(searchQuery) {
    const term = searchQuery || mixkitQuery
    if (!term.trim()) return

    setMixkitLoading(true)
    setError('')
    setSelectedVideo(null)
    setGeneratedScript(null)

    try {
      const res = await fetch('/api/mixkit-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, count: 12 })
      })

      if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`)

      const data = await res.json()
      setMixkitVideos(data.videos || [])
      setMixkitSearched(true)

      // Silent usage logging
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase.from('usage_events').insert({
            user_id: user.id,
            event_type: 'video_finder_used'
          }).then()
        }
      }).catch(() => {})
    } catch (e) {
      console.error('[Mixkit Search Error]', e)
      setError(getTxt('errorMixkit'))
    } finally {
      setMixkitLoading(false)
    }
  }

  return (
    <div className="vf-container">
      <div className="vf-main-content">
        <div className="vf-header">
          <h2>🔍 {getTxt('viralTitle')}</h2>
          <p>{getTxt('viralSub')}</p>
        </div>

        <div className="vf-tabs">
          <button
            className={`vf-tab-btn-source ${activeSource === 'pexels' ? 'active' : ''}`}
            onClick={() => { setActiveSource('pexels'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            📸 Pexels
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'viral' ? 'active' : ''}`}
            onClick={() => { setActiveSource('viral'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            🚀 Viral Links
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'archive' ? 'active' : ''}`}
            onClick={() => { setActiveSource('archive'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            🏛️ Internet Archive
          </button>
          <button
            className={`vf-tab-btn-source ${activeSource === 'mixkit' ? 'active' : ''}`}
            onClick={() => { setActiveSource('mixkit'); setSelectedVideo(null); setGeneratedScript(null); setError('') }}
          >
            📱 Mixkit
          </button>
        </div>

        {activeSource === 'pexels' && (
          <>
            <div className="vf-search-panel">
              <div className="vf-search-bar">
                <Search size={18} className="vf-search-icon" />
                <input
                  type="text"
                  placeholder={getTxt('searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="vf-search-btn" onClick={() => handleSearch()}>
                  Suchen
                </button>
              </div>

              <div className="vf-quick-tags">
                {PRESET_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className="vf-tag-btn"
                    onClick={() => { setQuery(cat.query); handleSearch(cat.query) }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="vf-error-banner">{error}</div>}

            {loading ? (
              <div className="vf-loading-state">
                <div className="vf-spinner"></div>
                <p>Laden...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="vf-empty-state">
                  <p className={error ? 'vf-error-msg' : 'vf-info-msg'}>
                    {error
                    ? 'Fehler bei der Suche.'
                    : 'Suche nach Videos...'}
                  </p>
              </div>
            ) : (
              <div className="vf-grid">
                {videos.map(video => (
                  <VideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
          </>
        )}

        {activeSource === 'viral' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>{getTxt('viralTitle')}</h3>
              <p>{getTxt('viralSub')}</p>
              <div className="vf-external-search-wrap">
                <div className="vf-external-search-input-group">
                  <input type="text" placeholder={getTxt('searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
                  <button className="vf-ext-btn yt" onClick={() => searchExternal('youtube')}>🌐 YouTube Shorts</button>
                  <button className="vf-ext-btn tt" onClick={() => searchExternal('tiktok')}>📱 TikTok</button>
                </div>
              </div>
            </div>
            <div className="vf-importer-box">
              <h4>{getTxt('importTitle')}</h4>
              {error && <div className="vf-error-banner">{error}</div>}
              <div className="vf-importer-fields">
                <div className="vf-importer-field">
                  <label>{getTxt('labelUrl')}</label>
                  <input type="text" placeholder={getTxt('placeholderUrl')} value={importedUrl} onChange={(e) => setImportedUrl(e.target.value)} />
                </div>
                <div className="vf-importer-field">
                  <label>{getTxt('labelTopic')}</label>
                  <input type="text" placeholder={getTxt('placeholderTopic')} value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
              </div>
              <button className="vf-import-btn" onClick={handleImportVideo}>{getTxt('btnImport')}</button>
            </div>
          </div>
        )}

        {activeSource === 'archive' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>{getTxt('archiveTitle')}</h3>
              <p>{getTxt('archiveSub')}</p>
              <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', marginTop: '0.75rem', color: '#065f46' }}>
                {getTxt('archiveTip')}
              </div>
              <div className="vf-search-bar" style={{ marginTop: '1rem' }}>
                <Search size={18} className="vf-search-icon" />
                <input type="text" placeholder="z. B. nature, space, vintage, cooking..." value={archiveQuery} onChange={(e) => setArchiveQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleArchiveSearch()} />
                <button className="vf-search-btn" onClick={() => handleArchiveSearch()}>Suchen</button>
              </div>
              <div className="vf-quick-tags" style={{ marginTop: '0.75rem' }}>
                {[{ label: '🌍 Nature', query: 'nature' }, { label: '🚀 Space', query: 'space' }, { label: '🎬 Vintage', query: 'vintage' }, { label: '🍳 Cooking', query: 'cooking' }, { label: '🐾 Animals', query: 'animals' }, { label: '🏙️ City', query: 'city' }].map(cat => (
                  <button key={cat.query} className="vf-tag-btn" onClick={() => { setArchiveQuery(cat.query); handleArchiveSearch(cat.query) }}>{cat.label}</button>
                ))}
              </div>
            </div>
            {error && <div className="vf-error-banner">{error}</div>}
            {archiveLoading ? (
              <div className="vf-loading-state"><div className="vf-spinner"></div><p>{getTxt('archiveLoading')}</p></div>
            ) : archiveVideos.length === 0 ? (
              <div className="vf-empty-state">
                <Film size={48} />
                <p>
                  {archiveSearched
                    ? getTxt('archiveEmpty')
                    : getTxt('archiveInfo')}
                </p>
              </div>
            ) : (
              <div className="vf-grid">
                {archiveVideos.map(video => (
                  <ArchiveVideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSource === 'mixkit' && (
          <div className="vf-viral-container">
            <div className="vf-viral-intro">
              <h3>{getTxt('mixkitTitle')}</h3>
              <p>{getTxt('mixkitSub')}</p>
              <div className="vf-search-bar" style={{ marginTop: '1rem' }}>
                <Search size={18} className="vf-search-icon" />
                <input type="text" placeholder="z. B. laptop, coffee, fitness, city..." value={mixkitQuery} onChange={(e) => setMixkitQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleMixkitSearch()} />
                <button className="vf-search-btn" onClick={() => handleMixkitSearch()}>Suchen</button>
              </div>
              <div className="vf-quick-tags" style={{ marginTop: '0.75rem' }}>
                {[{ label: '💻 Tech', query: 'laptop' }, { label: '☕ Lifestyle', query: 'coffee' }, { label: '💪 Fitness', query: 'fitness' }, { label: '🏙️ City', query: 'city' }, { label: '🌿 Nature', query: 'nature' }, { label: '🎨 Creative', query: 'creative' }].map(cat => (
                  <button key={cat.query} className="vf-tag-btn" onClick={() => { setMixkitQuery(cat.query); handleMixkitSearch(cat.query) }}>{cat.label}</button>
                ))}
              </div>
            </div>
            {error && <div className="vf-error-banner">{error}</div>}
            {mixkitLoading ? (
              <div className="vf-loading-state"><div className="vf-spinner"></div><p>{getTxt('mixkitLoading')}</p></div>
            ) : mixkitVideos.length === 0 ? (
              <div className="vf-empty-state">
                <Film size={48} />
                <p>
                  {mixkitSearched
                    ? getTxt('mixkitEmpty')
                    : getTxt('mixkitInfo')}
                </p>
              </div>
            ) : (
              <div className="vf-grid">
                {mixkitVideos.map(video => (
                  <MixkitVideoCard key={video.id} video={video} isSelected={selectedVideo?.id === video.id} onSelect={setSelectedVideo} />
                ))}
              </div>
            )}
            <div style={{ marginTop: '2rem', padding: '1.25rem', background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{getTxt('otherSources')}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <a href="https://coverr.co" target="_blank" rel="noreferrer" className="vf-tag-btn" style={{ textDecoration: 'none' }}>Coverr</a>
                <a href="https://www.dareful.com" target="_blank" rel="noreferrer" className="vf-tag-btn" style={{ textDecoration: 'none' }}>Dareful (4K CC)</a>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedVideo && (
        <div className="vf-sidebar-panel">
          <div className="vf-sidebar-header">
            <h3>{getTxt('detailsTitle')}</h3>
            <button className="vf-close-sidebar" onClick={() => setSelectedVideo(null)}>×</button>
          </div>
          <div className="vf-sidebar-body">
            <div className="vf-player-wrapper">
              {selectedVideo.source === 'archive' ? (
                <div className="vf-import-placeholder">
                  <Film size={40} className="vf-placeholder-icon" />
                  <p className="vf-placeholder-title" style={{ marginBottom: '12px' }}>{selectedVideo.title}</p>
                  <iframe src={`https://archive.org/embed/${selectedVideo.id}`} width="100%" height="240" frameBorder="0" webkitallowfullscreen="true" mozallowfullscreen="true" allowFullScreen style={{ borderRadius: '8px', background: '#000' }}></iframe>
                  <a href={selectedVideo.detailsUrl} target="_blank" rel="noreferrer" className="vf-open-link-btn" style={{ marginTop: '12px' }}>{getTxt('openArchive')}</a>
                </div>
              ) : selectedVideo.source === 'mixkit' ? (
                <video key={selectedVideo.url} src={selectedVideo.url} controls playsInline className="vf-large-player" />
              ) : selectedVideo.id === 'viral-import' ? (
                <div className="vf-import-placeholder">
                  <Film size={40} className="vf-placeholder-icon" />
                  <p className="vf-placeholder-title">{selectedVideo.title}</p>
                  <a href={selectedVideo.url} target="_blank" rel="noreferrer" className="vf-open-link-btn">{getTxt('openOriginal')}</a>
                </div>
              ) : (
                <video key={selectedVideo.url} src={selectedVideo.url} controls playsInline className="vf-large-player" />
              )}
            </div>

            <div className="vf-action-section">
              {selectedVideo.source === 'archive' ? (
                selectedVideo.hasVideo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                    <a href={selectedVideo.url} download={`archive_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> {getTxt('downloadVideo')}</a>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', lineHeight: '1.2' }}>
                      {getTxt('downloadTip')}
                    </span>
                  </div>
                ) : (
                  <a href={selectedVideo.downloadUrl} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> {getTxt('downloadManual')}</a>
                )
              ) : selectedVideo.source === 'mixkit' ? (
                <a href={selectedVideo.url} download={`mixkit_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> {getTxt('downloadVideo')}</a>
              ) : selectedVideo.id !== 'viral-import' ? (
                <a href={selectedVideo.url} download={`clip_${selectedVideo.id}.mp4`} target="_blank" rel="noreferrer" className="vf-download-action-btn"><Download size={16} /> {getTxt('downloadVideo')}</a>
              ) : null}
            </div>

            <div className="vf-generator-setup" style={{ background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)', padding: '24px', borderRadius: '16px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <label style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: '#7c3aed' }} /> 
                Ideenschmiede
              </label>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                Beschreibe deine Vision für dieses Video. H.I.T. erstellt dir daraus einen exakten Regie-Bauplan für CapCut.
              </p>
              
              <textarea 
                placeholder='z. B. "Ich brauche das für ein witziges TikTok mit Retro-Vibe..." oder "Mache daraus eine Schulpräsentation" (Optional)' 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                style={{ 
                  width: '100%', 
                  minHeight: '120px', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: '2px solid #cbd5e1', 
                  fontSize: '1rem', 
                  resize: 'vertical',
                  background: '#ffffff',
                  color: '#1e293b',
                  transition: 'border-color 0.2s',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
              
              <button 
                className="vf-generate-script-btn" 
                onClick={generateScriptForVideo} 
                disabled={generatingScript || analyzingFrames}
                style={{ 
                  alignSelf: 'flex-end', 
                  marginTop: '12px', 
                  background: '#7c3aed', 
                  color: 'white', 
                  border: 'none', 
                  padding: '12px 24px', 
                  borderRadius: '10px', 
                  cursor: (generatingScript || analyzingFrames) ? 'not-allowed' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
                  transition: 'all 0.2s',
                  opacity: (generatingScript || analyzingFrames) ? 0.7 : 1
                }}
              >
                <Sparkles size={18} />
                {analyzingFrames ? 'Video wird analysiert...' : generatingScript ? 'Bauplan wird erstellt...' : 'Idee umsetzen'}
              </button>
            </div>

            {generatingScript && !analyzingFrames && (
              <div className="vf-script-loading"><div className="vf-script-shimmer"></div><p>KI schreibt den Regie-Bauplan...</p></div>
            )}

            {generatedScript && (
              <div className="vf-script-output-card">
                <div className="vf-script-output-header">
                  <h4>✨ {generatedScript.video_title}</h4>
                  <button className="vf-copy-script-icon" onClick={handleCopyScript} title="Kopieren">
                    {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                  </button>
                </div>
                <div className="vf-script-output-body">
                  <div className="vf-meta-badge" style={{ marginBottom: '0.75rem', fontSize: '1rem', background: '#fef3c7', color: '#b45309', padding: '10px 14px', borderRadius: '8px' }}>
                    <strong>🔥 Hook (0-3s):</strong> {generatedScript.publishing_payload?.tiktok_instagram?.hook}
                  </div>
                  {generatedScript.music_suggestion && (
                    <div className="vf-meta-badge" style={{ marginBottom: '1.25rem', fontSize: '0.9rem', background: '#ede9fe', color: '#6d28d9', padding: '8px 12px', borderRadius: '6px' }}>
                      <strong>🎵 Sound-Idee:</strong> {generatedScript.music_suggestion}
                    </div>
                  )}
                  
                  {generatedScript.blueprint ? (
                    <div className="vf-blueprint-steps" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>🎬 Schnitt & Voiceover Anweisung:</h5>
                      {generatedScript.blueprint.map((step, idx) => (
                        <div key={idx} style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--brand-purple)' }}>
                          <strong style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>Schritt {step.step} ({step.timestamp})</strong>
                          <div style={{ fontSize: '0.9rem', color: '#111827', marginBottom: '6px' }}><strong>✂️ Schnitt:</strong> {step.instruction}</div>
                          <div style={{ fontSize: '0.9rem', color: '#111827' }}><strong>🎤 Audio:</strong> "{step.voiceover}"</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="vf-script-text">{generatedScript.voiceover_script}</p>
                  )}
                </div>
                <button className="vf-export-capcut-btn" onClick={handleSendToCapCut}>
                  {getTxt('exportCapcut')} <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VideoCard({ video, onSelect, isSelected }) {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const { lang } = useLanguage()

  const handleMouseEnter = () => {
    if (videoRef.current) videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
  }
  const handleMouseLeave = () => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setIsPlaying(false) }
  }

  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="vf-video-wrapper">
        <video ref={videoRef} src={video.url} poster={video.thumbnail} muted loop playsInline />
        <div className={`vf-play-overlay ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </div>
        <span className="vf-duration-tag">{video.duration}s</span>
      </div>
      <div className="vf-card-footer">
        <span className="vf-resolution-tag">{video.width}x{video.height}</span>
        <a href={video.url} download={`clip_${video.id}.mp4`} target="_blank" rel="noreferrer" className="vf-card-download" onClick={(e) => e.stopPropagation()} title="Herunterladen">
          <Download size={14} />
        </a>
      </div>
    </div>
  )
}

function ArchiveVideoCard({ video, onSelect, isSelected }) {
  const { lang } = useLanguage()
  const hasVidTxt = lang === 'nl' ? '▶️ Video beschikbaar' : lang === 'de' ? '▶️ Video verfügbar' : '▶️ Video available'
  const pubDomainTxt = lang === 'nl' ? '🏛️ Publiek domein' : lang === 'el' ? '🏛️ Κοινό κτήμα' : lang === 'de' ? '🏛️ Public Domain' : '🏛️ Public Domain'

  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} style={{ cursor: 'pointer' }}>
      <div className="vf-video-wrapper" style={{ background: '#1a1a2e', position: 'relative' }}>
        <img src={`https://archive.org/services/img/${video.id}`} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: '8px', left: '0', right: '0', textAlign: 'center' }}>
          <span style={{ background: 'rgba(0,0,0,0.7)', color: '#10b981', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px' }}>
            {video.hasVideo ? hasVidTxt : pubDomainTxt}
          </span>
        </div>
      </div>
      <div className="vf-card-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{video.title.substring(0, 50)}{video.title.length > 50 ? '...' : ''}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {video.date && <span className="vf-resolution-tag">{video.date.substring(0, 4)}</span>}
          {video.rating > 0 && <span className="vf-resolution-tag">⭐ {video.rating.toFixed(1)}</span>}
        </div>
      </div>
    </div>
  )
}

function MixkitVideoCard({ video, onSelect, isSelected }) {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleMouseEnter = () => { if (videoRef.current) videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {}) }
  const handleMouseLeave = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setIsPlaying(false) } }

  return (
    <div className={`vf-video-card ${isSelected ? 'selected' : ''}`} onClick={() => onSelect(video)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ cursor: 'pointer' }}>
      <div className="vf-video-wrapper">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1a1a2e' }}>
            <Film size={32} style={{ color: '#10b981' }} />
          </div>
        )}
        <div className={`vf-play-overlay ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </div>
        {video.isVertical && (
          <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#10b981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>9:16</span>
        )}
        {video.duration > 0 && <span className="vf-duration-tag">{video.duration}s</span>}
      </div>
      <div className="vf-card-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{video.title.substring(0, 45)}{video.title.length > 45 ? '...' : ''}</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span className="vf-resolution-tag">{video.width}x{video.height}</span>
          {video.tags?.slice(0, 2).map(tag => (<span key={tag} className="vf-resolution-tag">{tag}</span>))}
        </div>
      </div>
    </div>
  )
}
