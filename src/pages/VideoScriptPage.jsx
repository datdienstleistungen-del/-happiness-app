import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Film, Copy, Check, ArrowRight, Loader, AlertCircle, FileVideo, Link as LinkIcon, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStudio } from '../context/StudioContext'
import AuthModal from '../components/AuthModal'
import { useLanguage } from '../i18n/translations'
import './VideoScriptPage.css'

function getOrCreateVisitorId() {
  let vid = localStorage.getItem('hit_visitor_id')
  if (!vid) {
    vid = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem('hit_visitor_id', vid)
  }
  return vid
}

const GENRES = [
  { id: 'comedy_prank', emoji: '🎭', label: 'Comedy / Prank', desc: 'Unterhaltung, Pointen, Reaktionen' },
  { id: 'werbevideo_marketing', emoji: '📢', label: 'Werbevideo', desc: 'Marketing, Produkt, Call-to-Action' },
  { id: 'lernvideo_kinder', emoji: '🧒', label: 'Lernvideo (Kinder)', desc: 'Einfach, spielerisch, freundlich' },
  { id: 'lernvideo_erwachsene', emoji: '🎓', label: 'Lernvideo (Erwachsene)', desc: 'Informativ, strukturiert, sachlich' }
]

async function extractFramesFromVideo(videoSrc, maxFrames = 6) {
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

      const maxW = 256
      const scale = Math.min(1, maxW / (video.videoWidth || 640))
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
        } catch (e) {
          console.warn('[extractFrames] Frame', i, 'failed:', e.message)
        }
      }

      video.src = ''
      resolve(frames)
    }

    video.onerror = () => reject(new Error('Video konnte nicht geladen werden. CORS-Beschränkungen möglich.'))

    if (videoSrc instanceof File) {
      video.src = URL.createObjectURL(videoSrc)
    } else {
      video.src = videoSrc
    }
  })
}

export default function VideoScriptPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)

  const getTxt = (key) => {
    const dict = {
      de: {
        uploadHint: 'Klicke hier, um ein Video auszuwählen',
        uploadFormats: 'MP4, WebM, MOV — max. 60 Sek.',
        removeFile: 'Entfernen',
        analyzing: 'Video wird analysiert...',
        extracting: 'Frames werden extrahiert...',
        generating: 'Hooks werden generiert...',
        writing: 'Drehbuch wird geschrieben...',
        noHooks: 'Keine Hooks geladen. Versuche es erneut.',
        back: '← Zurück',
        genreLabel: 'Genre auswählen',
        premiseLabel: 'Hast du eine bestimmte Idee / Prämisse? (optional)',
        premisePlaceholder: 'z.B. "Es geht um einen Trick, den viele nicht kennen" oder "Reaktion auf etwas Überraschendes"',
        adLabel: 'Werbung / Call-to-Action (optional)',
        adPlaceholder: 'z.B. "Besuche uns unter www.beispiel.de — 20% Rabatt mit Code HAPPY20" oder "Lade jetzt die App herunter"',
        adHint: 'Dieser Text wird 1:1 im Drehbuch verwendet (als TTS-Stimme oder Text-Overlay)',
        btnHooks: 'Hooks generieren',
        chooseHook: 'Wähle deinen Hook (Sekunde 0:00-0:01)',
        hooksHint: 'Wähle oder kopiere den stärksten Hook für dein Video.',
        quickActionTitle: '💡 Einfache Schnell-Aktionen pro Hook-Idee:',
        quickAction1: 'Klicke auf "📋 Hook kopieren", um die Idee sofort in die Zwischenablage zu kopieren.',
        quickAction2: 'Klicke auf "✨ Drehbuch generieren", um sofort das vollständige Skript schreiben zu lassen.',
        selected: 'Ausgewählt',
        select: 'Auswählen',
        copyHook: 'Hook kopieren',
        continueWithHook: 'Mit diesem Hook weiter → Drehbuch generieren',
        sendToCapCut: '🎬 An CapCut Studio senden',
        authTitle: 'Melde dich an, um fortzufahren',
        visual: 'Szenen-Bild',
        text: 'Text',
        audio: 'Audio',
        analyzeBtn: 'Video analysieren',
        comedyLabel: 'Comedy / Prank',
        comedyDesc: 'Unterhaltung, Pointen, Reaktionen',
        adGenreLabel: 'Werbevideo',
        adGenreDesc: 'Marketing, Produkt, Call-to-Action',
        kidsLabel: 'Lernvideo (Kinder)',
        kidsDesc: 'Einfach, spielerisch, freundlich',
        adultsLabel: 'Lernvideo (Erwachsene)',
        adultsDesc: 'Informativ, strukturiert, sachlich'
      },
      en: {
        uploadHint: 'Click here to select a video',
        uploadFormats: 'MP4, WebM, MOV — max. 60 sec.',
        removeFile: 'Remove',
        analyzing: 'Analyzing video...',
        extracting: 'Extracting frames...',
        generating: 'Generating hooks...',
        writing: 'Writing script...',
        noHooks: 'No hooks loaded. Try again.',
        back: '← Back',
        genreLabel: 'Select Genre',
        premiseLabel: 'Do you have a specific idea / premise? (optional)',
        premisePlaceholder: 'e.g. "It\'s about a trick that many don\'t know" or "Reaction to something surprising"',
        adLabel: 'Advertisement / Call-to-Action (optional)',
        adPlaceholder: 'e.g. "Visit us at www.example.com — 20% discount with code HAPPY20" or "Download the app now"',
        adHint: 'This text is used 1:1 in the script (as TTS voice or text overlay)',
        btnHooks: 'Generate Hooks',
        chooseHook: 'Choose your Hook (second 0:00-0:01)',
        hooksHint: 'Select or copy the strongest hook for your video.',
        quickActionTitle: '💡 Quick actions per hook idea:',
        quickAction1: 'Click "📋 Copy Hook" to copy the idea to your clipboard immediately.',
        quickAction2: 'Click "✨ Write Script" to write the full script immediately.',
        selected: 'Selected',
        select: 'Select',
        copyHook: 'Copy Hook',
        continueWithHook: 'Continue with this hook → Write Script',
        sendToCapCut: '🎬 Send to CapCut Studio',
        authTitle: 'Log in to continue',
        visual: 'Visual',
        text: 'Text',
        audio: 'Audio',
        analyzeBtn: 'Analyze video',
        comedyLabel: 'Comedy / Prank',
        comedyDesc: 'Entertainment, punchlines, reactions',
        adGenreLabel: 'Promotional Video',
        adGenreDesc: 'Marketing, product, call-to-action',
        kidsLabel: 'Educational Video (Kids)',
        kidsDesc: 'Simple, playful, friendly',
        adultsLabel: 'Educational Video (Adults)',
        adultsDesc: 'Informative, structured, factual'
      },
      nl: {
        uploadHint: 'Klik hier om een video te selecteren',
        uploadFormats: 'MP4, WebM, MOV — max. 60 sec.',
        removeFile: 'Verwijderen',
        analyzing: 'Video analyseren...',
        extracting: 'Frames extraheren...',
        generating: 'Hooks genereren...',
        writing: 'Script schrijven...',
        noHooks: 'Geen hooks geladen. Probeer het opnieuw.',
        back: '← Terug',
        genreLabel: 'Genre selecteren',
        premiseLabel: 'Heb je een specifiek idee / uitgangspunt? (optioneel)',
        premisePlaceholder: 'bijv. "Het gaat over een truc die velen niet kennen" of "Reactie op iets verrassends"',
        adLabel: 'Advertentie / Call-to-Action (optioneel)',
        adPlaceholder: 'bijv. "Bezoek ons op www.voorbeeld.nl — 20% korting met code HAPPY20" of "Download nu de app"',
        adHint: 'Deze tekst wordt 1:1 in het script gebruikt (als TTS-stem of tekst-overlay)',
        btnHooks: 'Hooks genereren',
        chooseHook: 'Kies je Hook (seconde 0:00-0:01)',
        hooksHint: 'Selecteer of kopieer de sterkste hook voor je video.',
        quickActionTitle: '💡 Snelle acties per hook-idee:',
        quickAction1: 'Klik op "📋 Hook kopiëren" om het idee direct naar je klembord te kopiëren.',
        quickAction2: 'Klik op "✨ Script schrijven" om direct het volledige script te laten schrijven.',
        selected: 'Geselecteerd',
        select: 'Selecteren',
        copyHook: 'Hook kopiëren',
        continueWithHook: 'Doorgaan met deze hook → Script schrijven',
        sendToCapCut: '🎬 Naar CapCut Studio sturen',
        authTitle: 'Meld je aan om door te gaan',
        visual: 'Visueel',
        text: 'Tekst',
        audio: 'Audio',
        analyzeBtn: 'Video analyseren',
        comedyLabel: 'Comedy / Prank',
        comedyDesc: 'Entertainment, punchlines, reacties',
        adGenreLabel: 'Promotievideo',
        adGenreDesc: 'Marketing, product, call-to-action',
        kidsLabel: 'Educatieve video (kinderen)',
        kidsDesc: 'Eenvoudig, speels, vriendelijk',
        adultsLabel: 'Educatieve video (volwassenen)',
        adultsDesc: 'Informatief, gestructureerd, feitelijk'
      },
      es: {
        uploadHint: 'Haz clic aquí para seleccionar un video',
        uploadFormats: 'MP4, WebM, MOV — máx. 60 seg.',
        removeFile: 'Eliminar',
        analyzing: 'Analizando video...',
        extracting: 'Extrayendo fotogramas...',
        generating: 'Generando ganchos...',
        writing: 'Escribiendo guion...',
        noHooks: 'No se cargaron ganchos. Intente de nuevo.',
        back: '← Volver',
        genreLabel: 'Seleccionar género',
        premiseLabel: '¿Tienes alguna idea / premisa específica? (opcional)',
        premisePlaceholder: 'ej. "Se trata de un truco que muchos no conocen" o "Reacción a algo sorprendente"',
        adLabel: 'Anuncio / Llamada a la acción (opcional)',
        adPlaceholder: 'ej. "Visítenos en www.ejemplo.com — 20% de descuento con el código HAPPY20" o "Descarga la aplicación ahora"',
        adHint: 'Este texto se utilizará 1:1 en el guion (como voz TTS o superposición de texto)',
        btnHooks: 'Generar Ganchos',
        chooseHook: 'Elige tu gancho (segundo 0:00-0:01)',
        hooksHint: 'Selecciona o copia el gancho más fuerte para tu video.',
        quickActionTitle: '💡 Acciones rápidas por idea de gancho:',
        quickAction1: 'Haz clic en "📋 Copiar gancho" para copiar la idea al portapapeles de inmediato.',
        quickAction2: 'Haz clic en "✨ Crear guion" para escribir el guion completo de inmediato.',
        selected: 'Seleccionado',
        select: 'Seleccionar',
        copyHook: 'Copiar gancho',
        continueWithHook: 'Continuar con este gancho → Generar guion',
        sendToCapCut: '🎬 Enviar a CapCut Studio',
        authTitle: 'Inicia sesión para continuar',
        visual: 'Visual',
        text: 'Texto',
        audio: 'Audio',
        analyzeBtn: 'Analizar video',
        comedyLabel: 'Comedia / Broma',
        comedyDesc: 'Entretenimiento, chistes, reacciones',
        adGenreLabel: 'Video Promocional',
        adGenreDesc: 'Marketing, producto, llamada a la acción',
        kidsLabel: 'Video Educativo (Niños)',
        kidsDesc: 'Simple, lúdico, amigable',
        adultsLabel: 'Video Educativo (Adultos)',
        adultsDesc: 'Informativo, estructurado, objetivo'
      },
      fr: {
        uploadHint: 'Cliquez ici pour sélectionner une vidéo',
        uploadFormats: 'MP4, WebM, MOV — max. 60 s.',
        removeFile: 'Supprimer',
        analyzing: 'Analyse de la vidéo...',
        extracting: 'Extraction des images...',
        generating: 'Génération des accroches...',
        writing: 'Rédaction du script...',
        noHooks: 'Aucune accroche chargée. Réessayez.',
        back: '← Retour',
        genreLabel: 'Sélectionner le genre',
        premiseLabel: 'Avez-vous une idée / prémisse spécifique ? (optionnel)',
        premisePlaceholder: 'ex. "Il s\'agit d\'une astuce que beaucoup ignorent" ou "Réaction à quelque chose de surprenant"',
        adLabel: 'Publicité / Appel à l\'action (optionnel)',
        adPlaceholder: 'ex. "Visitez-nous sur www.exemple.com — 20% de réduction avec le code HAPPY20" ou "Téléchargez l\'application maintenant"',
        adHint: 'Ce texte sera utilisé 1:1 dans le script (comme voix TTS ou incrustation de texte)',
        btnHooks: 'Générer des accroches',
        chooseHook: 'Choisissez votre accroche (seconde 0:00-0:01)',
        hooksHint: 'Sélectionnez ou copiez l\'accroche la plus forte pour votre vidéo.',
        quickActionTitle: '💡 Actions rapides par idée d\'accroche :',
        quickAction1: 'Cliquez sur "📋 Copier l\'accroche" pour copier l\'idée dans le presse-papiers immédiatement.',
        quickAction2: 'Cliquez sur "✨ Créer le script" pour rédiger le script complet immédiatement.',
        selected: 'Sélectionné',
        select: 'Sélectionner',
        copyHook: 'Copier l\'accroche',
        continueWithHook: 'Continuer avec cette accroche → Créer le script',
        sendToCapCut: '🎬 Envoyer à CapCut Studio',
        authTitle: 'Connectez-vous pour continuer',
        visual: 'Visuel',
        text: 'Texte',
        audio: 'Audio',
        analyzeBtn: 'Analyser la vidéo',
        comedyLabel: 'Comédie / Blague',
        comedyDesc: 'Divertissement, chutes, réactions',
        adGenreLabel: 'Vidéo Promotionnelle',
        adGenreDesc: 'Marketing, produit, appel à l\'action',
        kidsLabel: 'Vidéo Éducative (Enfants)',
        kidsDesc: 'Simple, ludique, amical',
        adultsLabel: 'Vidéo Éducative (Adultes)',
        adultsDesc: 'Informatif, structuré, factuel'
      },
      it: {
        uploadHint: 'Clicca qui per selezionare un video',
        uploadFormats: 'MP4, WebM, MOV — max. 60 sec.',
        removeFile: 'Rimuovi',
        analyzing: 'Analisi del video...',
        extracting: 'Estrazione dei fotogrammi...',
        generating: 'Generazione dei ganci...',
        writing: 'Scrittura del copione...',
        noHooks: 'Nessun gancio caricato. Riprova.',
        back: '← Indietro',
        genreLabel: 'Seleziona genere',
        premiseLabel: 'Hai un\'idea / premessa specifica? (opzionale)',
        premisePlaceholder: 'es. "Si tratta di un trucco che molti non conoscono" o "Reazione a qualcosa di sorprendente"',
        adLabel: 'Annuncio / Call-to-Action (opzionale)',
        adPlaceholder: 'es. "Visitaci su www.esempio.com — 20% di sconto con il codice HAPPY20" o "Scarica l\'app ora"',
        adHint: 'Questo testo verrà utilizzato 1:1 nel copione (come voce TTS o sovrapposizione di testo)',
        btnHooks: 'Genera Ganci',
        chooseHook: 'Scegli il tuo Gancio (secondo 0:00-0:01)',
        hooksHint: 'Seleziona o copia il gancio più forte per il tuo video.',
        quickActionTitle: '💡 Azioni rapide per idea di gancio:',
        quickAction1: 'Clicca su "📋 Copia gancio" per copiare l\'idea negli appunti immediatamente.',
        quickAction2: 'Clicca su "✨ Crea copione" per scrivere il copione completo immediatamente.',
        selected: 'Selezionato',
        select: 'Seleziona',
        copyHook: 'Copia gancio',
        continueWithHook: 'Continua con questo gancio → Genera copione',
        sendToCapCut: '🎬 Invia a CapCut Studio',
        authTitle: 'Accedi per continuare',
        visual: 'Visuale',
        text: 'Testo',
        audio: 'Audio',
        analyzeBtn: 'Analizza video',
        comedyLabel: 'Commedia / Scherzo',
        comedyDesc: 'Intrattenimento, battute, reazioni',
        adGenreLabel: 'Video Promozionale',
        adGenreDesc: 'Marketing, prodotto, call-to-action',
        kidsLabel: 'Video Educativo (Bambini)',
        kidsDesc: 'Semplice, giocoso, amichevole',
        adultsLabel: 'Video Educativo (Adulti)',
        adultsDesc: 'Informativo, strutturato, oggettivo'
      },
      el: {
        uploadHint: 'Κάντε κλικ εδώ για να επιλέξετε βίντεο',
        uploadFormats: 'MP4, WebM, MOV — έως 60 δευτ.',
        removeFile: 'Κατάργηση',
        analyzing: 'Ανάλυση βίντεο...',
        extracting: 'Εξαγωγή καρέ...',
        generating: 'Δημιουργία hooks...',
        writing: 'Συγγραφή σεναρίου...',
        noHooks: 'Δεν φορτώθηκαν hooks. Δοκιμάστε ξανά.',
        back: '← Επιστροφή',
        genreLabel: 'Επιλέξτε είδος',
        premiseLabel: 'Έχετε κάποια συγκεκριμένη ιδέα / υπόθεση; (προαιρετικά)',
        premisePlaceholder: 'π.χ. "Πρόκειται για ένα κόλπο που πολλοί δεν γνωρίζουν" ή "Αντίδραση σε κάτι αναπάντεχο"',
        adLabel: 'Διαφήμιση / Call-to-Action (προαιρετικά)',
        adPlaceholder: 'π.χ. "Επισκεφθείτε μας στο www.example.com — έκπτωση 20% με τον κωδικό HAPPY20" ή "Κατεβάστε την εφαρμογή τώρα"',
        adHint: 'Αυτό το κείμενο θα χρησιμοποιηθεί 1:1 στο σενάριο (ως φωνή TTS ή επικάλυψη κειμένου)',
        btnHooks: 'Δημιουργία Hooks',
        chooseHook: 'Επιλέξτε το Hook σας (δευτερόλεπτο 0:00-0:01)',
        hooksHint: 'Επιλέξτε ή αντιγράψτε το πιο δυνατό hook για το βίντεό σας.',
        quickActionTitle: '💡 Γρήγορες ενέργειες ανά ιδέα hook:',
        quickAction1: 'Κάντε κλικ στο "📋 Αντιγραφή hook" για να αντιγράψετε την ιδέα στο πρόχειρο αμέσως.',
        quickAction2: 'Κάντε κλικ στο "✨ Δημιουργία σεναρίου" για να γραφτεί το πλήρες σενάριο αμέσως.',
        selected: 'Επιλέχθηκε',
        select: 'Επιλογή',
        copyHook: 'Αντιγραφή hook',
        continueWithHook: 'Συνέχεια με αυτό το hook → Δημιουργία σεναρίου',
        sendToCapCut: '🎬 Αποστολή στο CapCut Studio',
        authTitle: 'Συνδεθείτε για να συνεχίσετε',
        visual: 'Οπτικό',
        text: 'Κείμενο',
        audio: 'Ήχος',
        analyzeBtn: 'Ανάλυση βίντεο',
        comedyLabel: 'Κωμωδία / Φάρσα',
        comedyDesc: 'Ψυχαγωγία, ατάκες, αντιδράσεις',
        adGenreLabel: 'Προωθητικό Βίντεο',
        adGenreDesc: 'Μάρκετινγκ, προϊόν, call-to-action',
        kidsLabel: 'Εκπαιδευτικό Βίντεο (Παιδιά)',
        kidsDesc: 'Απλό, παιχνιδιάρικο, φιλικό',
        adultsLabel: 'Εκπαιδευτικό Βίντεο (Ενήλικες)',
        adultsDesc: 'Ενημερωτικό, δομημένο, αντικειμενικό'
      }
    }
    return dict[lang]?.[key] || dict['en']?.[key] || key
  }

  const {
    scriptStep: step, setScriptStep: setStep,
    scriptVideoUrl: videoUrl, setScriptVideoUrl: setVideoUrl,
    scriptVideoFile: videoFile, setScriptVideoFile: setVideoFile,
    scriptVideoPreview: videoPreview, setScriptVideoPreview: setVideoPreview,
    scriptInputMode: inputMode, setScriptInputMode: setInputMode,
    scriptSelectedGenre: selectedGenre, setScriptSelectedGenre: setSelectedGenre,
    scriptUserPremise: userPremise, setScriptUserPremise: setUserPremise,
    scriptAdText: adText, setScriptAdText: setAdText,
    scriptSceneAnalysis: sceneAnalysis, setScriptSceneAnalysis: setSceneAnalysis,
    scriptGeneratedScript: generatedScript, setScriptGeneratedScript: setGeneratedScript,
    scriptId, setScriptId,
    scriptHooks: hooks, setScriptHooks: setHooks,
    scriptSelectedHook: selectedHook, setScriptSelectedHook: setSelectedHook
  } = useStudio()

  const [copied, setCopied] = useState(false)
  const [copiedHookIndex, setCopiedHookIndex] = useState(null)
  const [error, setError] = useState('')
  const [statusText, setStatusText] = useState('')
  const [hooksLoading, setHooksLoading] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
    setVideoUrl('')
    setError('')
  }

  const handleUrlChange = (val) => {
    setVideoUrl(val)
    setVideoFile(null)
    setVideoPreview(null)
    setError('')
  }

  const handleStartAnalysis = async () => {
    if (!videoUrl && !videoFile) {
      setError(t('videoScript.errorUrlOrFile'))
      return
    }
    setStep(3)
    setStatusText('Frames werden extrahiert...')

    try {
      // Step 1: Extract frames in browser
      const source = videoUrl || videoFile
      const frames = await extractFramesFromVideo(source, 3)

      if (frames.length === 0) {
        throw new Error('Keine Frames aus dem Video extrahiert werden.')
      }

      const totalSize = frames.reduce((sum, f) => sum + f.length, 0)
      console.log(`[VideoScript] ${frames.length} frames, total: ${(totalSize / 1024 / 1024).toFixed(1)}MB, each: ${(totalSize / frames.length / 1024).toFixed(0)}KB`)
      console.log('[VideoScript] Frame 0 preview:', frames[0]?.substring(0, 80))

      if (totalSize > 4 * 1024 * 1024) {
        throw new Error('Video ist zu groß für die automatische Analyse. Bitte versuche ein kürzeres Video (< 30 Sek.).')
      }

      setStatusText(`Video wird analysiert (${frames.length} Frames)...`)

      // Step 2: Send frames to analyze function
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      console.log('[VideoScript] Auth token present:', !!token)

      const res = await fetch('/api/analyze-video-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          frames,
          video_filename: videoFile?.name || videoUrl || 'video',
          visitor_id: getOrCreateVisitorId()
        })
      })

      const data = await res.json()

      console.log('[VideoScript] API response:', res.status, JSON.stringify(data).substring(0, 500))

      if (!res.ok) {
        const detail = data.details ? `\n${data.details}` : ''
        throw new Error((data.error || 'Analyse fehlgeschlagen') + detail)
      }
      setSceneAnalysis(data.scene_analysis)
      setStep(2)
    } catch (e) {
      console.error('[VideoScript] Analysis error:', e.message)
      setError(t('videoScript.errorAnalysis'))
      setStep(1)
    }
  }

  const handleGenerateHooks = async () => {
    if (!selectedGenre) return

    setStep(3)
    setStatusText('Hooks werden generiert...')
    setError('')
    setHooks([])
    setSelectedHook(null)
    setHooksLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/generate-hooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          genre: selectedGenre,
          premise: userPremise || undefined,
          scene_description: sceneAnalysis?.beats?.map(b => b.description).join(' | ') || undefined,
          visitor_id: getOrCreateVisitorId()
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Hook-Generierung fehlgeschlagen')

      if (data.hooks && data.hooks.length > 0) {
        setHooks(data.hooks)
      } else {
        throw new Error(data.error || 'Keine Hooks generiert')
      }
    } catch (e) {
      console.error('[VideoScript] Hook generation error:', e.message)
      setError(t('videoScript.errorGeneric'))
      setStep(2)
    } finally {
      setHooksLoading(false)
    }
  }

  const handleCopyHookText = async (hook, index) => {
    const textToCopy = `Hook #${index + 1} (${hook.trigger || ''})
👁️ Szenen-Bild: ${hook.visual || ''}
📝 Text: ${hook.text || ''}
🔊 Audio: ${hook.audio || ''}`

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedHookIndex(index)
      setTimeout(() => setCopiedHookIndex(null), 2500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = textToCopy
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedHookIndex(index)
      setTimeout(() => setCopiedHookIndex(null), 2500)
    }
  }

  const handleSelectHookAndContinue = () => {
    if (selectedHook === null) return
    handleGenerateScript(selectedHook)
  }

  const handleGenerateScript = async (hookIdx = selectedHook) => {
    if (!selectedGenre || !sceneAnalysis) return

    setStep(5)
    setStatusText('Drehbuch wird geschrieben...')
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/generate-video-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          scene_analysis: sceneAnalysis,
          content_goal: selectedGenre,
          user_premise: userPremise || undefined,
          ad_text: adText || undefined,
          video_filename: videoFile?.name || 'video',
          selected_hook: hookIdx !== null && hooks[hookIdx] ? hooks[hookIdx] : undefined,
          visitor_id: getOrCreateVisitorId()
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Generierung fehlgeschlagen')

      setGeneratedScript(data.script)
      setScriptId(data.script_id)
      setStep(6)
    } catch (e) {
      console.error('[VideoScript] Generation error:', e.message)
      setError(t('videoScript.errorGeneration'))
      setStep(2)
    }
  }

  const handleSaveScriptToDb = async (userId) => {
    if (!generatedScript || !sceneAnalysis) return null

    try {
      const { data, error } = await supabase
        .from('video_scripts')
        .insert({
          user_id: userId,
          video_filename: videoFile?.name || 'video',
          content_goal: selectedGenre,
          scene_analysis: sceneAnalysis,
          generated_script: generatedScript
        })
        .select()

      if (error) throw error
      if (data && data[0]) {
        setScriptId(data[0].id)
        console.log('[VideoScript] Script saved to DB successfully under ID:', data[0].id)
        return data[0].id
      }
    } catch (e) {
      console.error('[VideoScript] Error saving script to DB:', e.message)
    }
    return null
  }

  const handleSendToCapCut = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
      setAuthModalOpen(true)
    } else {
      await handleSaveScriptToDb(user.id)
      navigate('/capcut-studio')
    }
  }

  const handleAuthSuccess = async (authUser) => {
    await handleSaveScriptToDb(authUser.id)
    navigate('/capcut-studio')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedScript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = generatedScript
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleReset = () => {
    setStep(1)
    setVideoUrl('')
    setVideoFile(null)
    setVideoPreview(null)
    setSelectedGenre(null)
    setUserPremise('')
    setAdText('')
    setSceneAnalysis(null)
    setGeneratedScript('')
    setScriptId(null)
    setError('')
    setHooks([])
    setSelectedHook(null)
    setHooksLoading(false)
  }

  return (
    <div className="vsp-page">
      <div className="vsp-header">
        <h1>{t('videoScript.title')}</h1>
        <p>{t('videoScript.subtitle')}</p>
      </div>

      {/* Step indicator */}
      <div className="vsp-steps">
        <div className={`vsp-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
          <span>1</span> {t('videoScript.stepVideo')}
        </div>
        <div className={`vsp-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
          <span>2</span> {t('videoScript.stepGenre')}
        </div>
        <div className={`vsp-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'done' : ''}`}>
          <span>3</span> Hook
        </div>
        <div className={`vsp-step ${step >= 5 ? 'active' : ''} ${step > 5 ? 'done' : ''}`}>
          <span>4</span> {t('videoScript.stepScript')}
        </div>
      </div>

      {error && (
        <div className="vsp-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* STEP 1: Video Input */}
      {step === 1 && (
        <div className="vsp-input-section">
          <div className="vsp-mode-toggle">
            <button
              className={`vsp-mode-btn ${inputMode === 'url' ? 'active' : ''}`}
              onClick={() => setInputMode('url')}
            >
              <LinkIcon size={16} /> {t('videoScript.urlMode')}
            </button>
            <button
              className={`vsp-mode-btn ${inputMode === 'upload' ? 'active' : ''}`}
              onClick={() => setInputMode('upload')}
            >
              <Upload size={16} /> {t('videoScript.uploadMode')}
            </button>
          </div>

          {inputMode === 'url' ? (
            <div className="vsp-field">
              <label>Video-URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={t('videoScript.urlPlaceholder')}
              />
              <span className="vsp-hint">{t('videoScript.urlHint')}</span>
            </div>
          ) : (
            <div
              className="vsp-upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {videoPreview ? (
                <div className="vsp-upload-preview">
                  <FileVideo size={32} />
                  <span>{videoFile?.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); setVideoPreview(null); }}>
                    {getTxt('removeFile')}
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={40} className="vsp-upload-icon" />
                  <p>{getTxt('uploadHint')}</p>
                  <span>{getTxt('uploadFormats')}</span>
                </>
              )}
            </div>
          )}

          {(videoUrl || videoFile) && (
            <button className="vsp-btn vsp-btn-primary" onClick={handleStartAnalysis}>
              <ArrowRight size={16} /> {getTxt('analyzeBtn')}
            </button>
          )}
        </div>
      )}

      {/* STEP 2: Genre Selection */}
      {step === 2 && sceneAnalysis && (
        <div className="vsp-genre-section">
          <p className="vsp-analysis-ok">
            <Check size={16} /> {lang === 'nl' ? `Video geanalyseerd — ${sceneAnalysis.beats?.length || 0} scènes gedetecteerd` : lang === 'de' ? `Video analysiert — ${sceneAnalysis.beats?.length || 0} Szenen erkannt` : `Video analyzed — ${sceneAnalysis.beats?.length || 0} scenes detected`}
          </p>

          <div className="vsp-genre-grid">
            {GENRES.map(g => (
              <button
                key={g.id}
                className={`vsp-genre-card ${selectedGenre === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGenre(g.id)}
              >
                <span className="vsp-genre-emoji">{g.emoji}</span>
                <strong>{
                  g.id === 'comedy_prank' ? getTxt('comedyLabel') :
                  g.id === 'werbevideo_marketing' ? getTxt('adGenreLabel') :
                  g.id === 'lernvideo_kinder' ? getTxt('kidsLabel') :
                  getTxt('adultsLabel')
                }</strong>
                <span className="vsp-genre-desc">{
                  g.id === 'comedy_prank' ? getTxt('comedyDesc') :
                  g.id === 'werbevideo_marketing' ? getTxt('adGenreDesc') :
                  g.id === 'lernvideo_kinder' ? getTxt('kidsDesc') :
                  getTxt('adultsDesc')
                }</span>
              </button>
            ))}
          </div>

          <div className="vsp-field">
            <label>{getTxt('premiseLabel')}</label>
            <textarea
              value={userPremise}
              onChange={(e) => setUserPremise(e.target.value)}
              placeholder={getTxt('premisePlaceholder')}
              rows={3}
            />
          </div>

          <div className="vsp-field">
            <label>{getTxt('adLabel')}</label>
            <textarea
              value={adText}
              onChange={(e) => setAdText(e.target.value)}
              placeholder={getTxt('adPlaceholder')}
              rows={3}
            />
            <span className="vsp-hint">{getTxt('adHint')}</span>
          </div>

          {selectedGenre && (
            <button className="vsp-btn vsp-btn-primary" onClick={handleGenerateHooks}>
              <Film size={16} /> {getTxt('btnHooks')}
            </button>
          )}
        </div>
      )}

      {/* STEP 3: Hook Selection */}
      {step === 3 && (
        <div className="vsp-hooks-section">
          {hooksLoading ? (
            <div className="vsp-loading">
              <Loader size={32} className="vsp-spinner" />
              <p>{statusText === 'Frames werden extrahiert...' ? getTxt('extracting') : statusText === 'Hooks werden generiert...' ? getTxt('generating') : statusText}</p>
            </div>
          ) : hooks.length > 0 ? (
            <>
              <h3>{getTxt('chooseHook')}</h3>
              <p className="vsp-hooks-hint">{getTxt('hooksHint')}</p>

              <div className="vsp-desc-intro" style={{ marginBottom: '1.5rem', background: '#e8f4f4', borderColor: '#085041', color: '#085041', fontSize: '13.5px' }}>
                💡 <strong>{getTxt('quickActionTitle')}</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  <li>{getTxt('quickAction1')}</li>
                  <li>{getTxt('quickAction2')}</li>
                </ul>
              </div>

              <div className="vsp-hooks-grid">
                {hooks.map((hook, i) => (
                  <div
                    key={i}
                    className={`vsp-hook-card ${selectedHook === i ? 'active' : ''}`}
                    onClick={() => setSelectedHook(i)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="vsp-hook-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="vsp-hook-number" style={{ margin: 0, fontWeight: '800' }}>Hook #{i + 1}</div>
                      <div className="vsp-hook-select-indicator" style={{ fontSize: '12px', fontWeight: '600' }}>
                        {selectedHook === i ? (
                          <span className="vsp-indicator-selected" style={{ background: '#e8f4f4', color: '#085041', border: '1px solid #085041', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> {getTxt('selected')}
                          </span>
                        ) : (
                          <span className="vsp-indicator-unselected" style={{ background: '#f3f4f6', color: '#666', border: '1px solid #d1d5db', padding: '3px 8px', borderRadius: '12px' }}>
                            {getTxt('select')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="vsp-hook-trigger">{hook.trigger}</div>
                    <div className="vsp-hook-visual">
                      <strong>👁️ {getTxt('visual')}:</strong> {hook.visual}
                    </div>
                    <div className="vsp-hook-text">
                      <strong>📝 {getTxt('text')}:</strong> {hook.text}
                    </div>
                    <div className="vsp-hook-audio">
                      <strong>🔊 {getTxt('audio')}:</strong> {hook.audio}
                    </div>

                    <div className="vsp-hook-card-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="vsp-btn vsp-btn-secondary" 
                        onClick={(e) => { e.stopPropagation(); handleCopyHookText(hook, i); }}
                        style={{ padding: '8px 12px', fontSize: '12px', flex: 1, justifyContent: 'center' }}
                      >
                        {copiedHookIndex === i ? (
                          <><Check size={14} /> {t('videoScript.copiedBtn')}</>
                        ) : (
                          <><Copy size={14} /> {getTxt('copyHook')}</>
                        )}
                      </button>
                      <button 
                        className="vsp-btn vsp-btn-primary" 
                        onClick={(e) => { e.stopPropagation(); setSelectedHook(i); handleGenerateScript(i); }}
                        style={{ padding: '8px 12px', fontSize: '12px', flex: 1, justifyContent: 'center' }}
                      >
                        <Sparkles size={14} /> {t('videoScript.generateBtn')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedHook !== null && (
                <button className="vsp-btn vsp-btn-primary" onClick={handleSelectHookAndContinue} style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  <ArrowRight size={16} /> {getTxt('continueWithHook')}
                </button>
              )}
            </>
          ) : (
            <div className="vsp-loading">
              <Loader size={32} className="vsp-spinner" />
              <p>{getTxt('noHooks')}</p>
              <button className="vsp-btn vsp-btn-secondary" onClick={() => setStep(2)}>{getTxt('back')}</button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Analyzing */}
      {step === 4 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText === 'Frames werden extrahiert...' ? getTxt('extracting') : statusText === 'Video wird analysiert...' ? getTxt('analyzing') : statusText}</p>
        </div>
      )}

      {/* STEP 5: Generating */}
      {step === 5 && (
        <div className="vsp-loading">
          <Loader size={32} className="vsp-spinner" />
          <p>{statusText === 'Drehbuch wird geschrieben...' ? getTxt('writing') : statusText}</p>
        </div>
      )}

      {/* STEP 6: Result */}
      {step === 6 && generatedScript && (
        <div className="vsp-result">
          <div className="vsp-result-header">
            <Check size={20} className="vsp-result-check" />
            <div>
              <h3>{t('videoScript.scriptReady')}</h3>
              <p>{t('videoScript.scriptHint')}</p>
            </div>
          </div>

          <div className="vsp-script-output">
            <pre>{generatedScript}</pre>
          </div>

          <div className="vsp-result-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
            <button 
              className="vsp-btn vsp-btn-primary" 
              onClick={handleSendToCapCut}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {getTxt('sendToCapCut')}
            </button>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button className="vsp-btn vsp-btn-copy" onClick={handleCopy} style={{ flex: 1, justifyContent: 'center' }}>
                {copied ? <><Check size={16} /> {t('videoScript.copiedBtn')}</> : <><Copy size={16} /> {t('videoScript.copyBtn')}</>}
              </button>
              <button className="vsp-btn vsp-btn-secondary" onClick={handleReset} style={{ flex: 1, justifyContent: 'center' }}>
                {t('videoScript.newVideo')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        title={getTxt('authTitle')}
      />
    </div>
  )
}
