import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Sparkles, Check, ArrowRight, Zap, Clock, Target } from 'lucide-react'
import { trackDemoStarted, trackDemoCompleted } from '../intelligence/analytics'
import { trackLandingFunnel } from '../intelligence/analytics/custom'
import { useLanguage } from '../i18n/translations.jsx'
import InstallButton from '../components/InstallButton'
import VideoShowcase from '../components/VideoShowcase'
import Logo from '../components/Logo'
import './LandingPage.css'

const GOAL_CHIPS = [
  { icon: '🎯', de: 'Mehr Kunden gewinnen', en: 'Get more customers', es: 'Ganar más clientes', fr: 'Gagner plus de clients', it: 'Ottenere più clienti', nl: 'Meer klanten winnen', el: 'Κερδίστε περισσότερους πελάτες' },
  { icon: '📈', de: 'Reichweite erhöhen', en: 'Increase reach', es: 'Aumentar alcance', fr: 'Augmenter la portée', it: 'Aumentare la portata', nl: 'Bereik vergroten', el: 'Αυξήστε την εμβέλεια' },
  { icon: '🛒', de: 'Produkt verkaufen', en: 'Sell a product', es: 'Vender producto', fr: 'Vendre un produit', it: 'Vendere un prodotto', nl: 'Product verkopen', el: 'Πουλήστε ένα προϊόν' },
  { icon: '👥', de: 'Community aufbauen', en: 'Build community', es: 'Crear comunidad', fr: 'Créer une communauté', it: 'Creare una community', nl: 'Community opbouwen', el: 'Χτίστε κοινότητα' },
  { icon: '🎪', de: 'Event bewerben', en: 'Promote event', es: 'Promocionar evento', fr: 'Promouvoir un événement', it: 'Promuovere un evento', nl: 'Evenement promoten', el: 'Προωθήστε ένα event' },
  { icon: '💼', de: 'Mitarbeiter finden', en: 'Find employees', es: 'Encontrar empleados', fr: 'Trouver des employés', it: 'Trovare dipendenti', nl: 'Medewerkers vinden', el: 'Βρείτε υπαλλήλους' },
]

const PRE_FILL_EXAMPLES = [
  { de: 'Mein nächstes Reel soll viral gehen', en: 'Make my next Reel go viral' },
  { de: 'Mehr Reichweite auf Instagram', en: 'More reach on Instagram' },
  { de: 'Mehr Kunden über LinkedIn gewinnen', en: 'Get more customers via LinkedIn' },
  { de: 'Einen erfolgreichen YouTube Short planen', en: 'Plan a successful YouTube Short' },
  { de: 'Einen TikTok erstellen, der geteilt wird', en: 'Create a TikTok that gets shared' },
  { de: 'Mehr Anfragen über Social Media erhalten', en: 'Get more inquiries via social media' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const heroRef = useRef(null)
  const inputChangedTracked = useRef(false)
  const [goal, setGoal] = useState('')
  const [phase, setPhase] = useState('input') // input | analysis | result | error
  const [analysis, setAnalysis] = useState(null)
  const [demoResult, setDemoResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Happiness — Creator Operating System'
    trackLandingFunnel('opened')

    const randomIndex = Math.floor(Math.random() * PRE_FILL_EXAMPLES.length)
    setGoal(PRE_FILL_EXAMPLES[randomIndex][lang] || PRE_FILL_EXAMPLES[randomIndex].de)
  }, [lang])

  useEffect(() => {
    if (!heroRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackLandingFunnel('hero_visible')
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  const handleChipClick = (chip) => {
    setGoal(chip[lang] || chip.de)
    trackLandingFunnel('example_changed', { method: 'chip' })
  }

  const handleInputChange = (e) => {
    setGoal(e.target.value)
    if (!inputChangedTracked.current) {
      inputChangedTracked.current = true
      trackLandingFunnel('example_changed', { method: 'typed' })
    }
  }

  const startDemo = async () => {
    if (!goal.trim()) return
    trackLandingFunnel('generate_clicked')
    trackDemoStarted(goal.trim())
    trackLandingFunnel('analysis_started')
    setPhase('analysis')
    setError('')
    const startTime = Date.now()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Erstelle einen Instagram-Post für dieses Ziel: "${goal.trim()}". Antworte NUR mit JSON: {"hook":"...","body":"...","hashtags":["..."],"cta":"..."}`,
          systemPrompt: `Du bist ein Instagram-Content-Experte. Erstelle einen kurzen, knackigen Post (100-150 Wörter). Hook im ersten Satz. 3-5 Hashtags. CTA am Ende. Antworte NUR mit validem JSON.`,
          history: []
        })
      })

      if (!res.ok) throw new Error('API Fehler')
      const data = await res.json()

      let parsed = null
      try {
        const jsonMatch = (data.response || '').match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { body: data.response, hook: '', hashtags: [], cta: '' }
      } catch {
        parsed = { body: data.response || '', hook: '', hashtags: [], cta: '' }
      }

      trackLandingFunnel('analysis_completed', { duration_ms: Date.now() - startTime })
      setDemoResult(parsed)
      setPhase('result')
      trackDemoCompleted(goal.trim())
      setTimeout(() => trackLandingFunnel('result_visible'), 100)
    } catch (err) {
      console.error('Demo error:', err)
      setError('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.')
      setPhase('input')
    }
  }

  const resetDemo = () => {
    setPhase('input')
    setDemoResult(null)
    setAnalysis(null)
    setError('')
  }

  return (
    <div className="container">
      {/* Hero */}
      <div className="hero landing-hero" ref={heroRef}>
        <h1><Logo /></h1>
        <p className="landing-tagline">{t('landing.tagline')}</p>

        <p className="landing-question">{t('landing.question')}</p>

        <div className="landing-input-wrap">
          <input
            className="landing-input"
            type="text"
            value={goal}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && startDemo()}
            placeholder={t('landing.placeholder')}
            disabled={phase !== 'input'}
            onFocus={() => trackLandingFunnel('input_focused')}
          />
          <button
            className="btn btn-primary landing-start-btn"
            onClick={startDemo}
            disabled={phase !== 'input' || !goal.trim()}
          >
            {phase === 'input' ? (
              <><Rocket size={16} /> {t('landing.startButton')}</>
            ) : (
              <><span className="demo-spinner" /> {t('landing.working')}</>
            )}
          </button>
        </div>

        {error && <p className="landing-error">{error}</p>}

        {/* Quick Chips */}
        {phase === 'input' && (
          <div className="landing-chips">
            {GOAL_CHIPS.map((chip) => (
              <button
                key={chip.de}
                className="landing-chip"
                onClick={() => handleChipClick(chip)}
              >
                <span>{chip.icon}</span> {chip[lang] || chip.de}
              </button>
            ))}
          </div>
        )}

        <div className="landing-social-proof">
          <span className="landing-social-check">✓</span> {t('landing.freeToStart')}
        </div>

        <div className="landing-meta">
          {t('landing.meta')}
        </div>

        <div className="landing-actions">
          <Link to="/register" className="btn btn-outline">{t('landing.register')}</Link>
          <Link to="/login" className="btn btn-outline">{t('landing.login')}</Link>
        </div>

        <div className="landing-install">
          <InstallButton variant="hero" />
        </div>
      </div>

      {/* Analysis Phase */}
      {phase === 'analysis' && (
        <div className="hit-analysis-card">
          <div className="hit-analysis-header">
            <div className="hit-brand">
              <span className="hit-letter">H</span><span className="hit-rest">.I.T.</span>
            </div>
            <span className="hit-status">{t('landing.analyzing')}</span>
          </div>
          <div className="hit-analysis-steps">
            <div className="hit-step done"><Check size={14} /> {t('landing.stepGoal')}</div>
            <div className="hit-step active"><span className="demo-spinner" /> {t('landing.stepStrategy')}</div>
            <div className="hit-step"><span className="hit-step-num">3</span> {t('landing.stepContent')}</div>
          </div>
        </div>
      )}

      {/* Result Phase — Demo with 1 platform */}
      {phase === 'result' && demoResult && (
        <div className="demo-result-card">
          <div className="demo-result-header">
            <div className="hit-brand">
              <span className="hit-letter">H</span><span className="hit-rest">.I.T.</span>
            </div>
            <span className="hit-status">{t('landing.resultReady')}</span>
            <button className="demo-reset" onClick={resetDemo}>{t('landing.demoReset')}</button>
          </div>

          <div className="demo-result-score">
            <div className="score-item">
              <span className="score-label">{t('landing.goalDetected')}</span>
              <span className="score-value done">✅</span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.strategyCreated')}</span>
              <span className="score-value done">✅</span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.contentChance')}</span>
              <span className="score-value highlight">89%</span>
            </div>
            <div className="score-item">
              <span className="score-label">{t('landing.savedTime')}</span>
              <span className="score-value">≈ 2h</span>
            </div>
          </div>

          <div className="demo-result-platform">
            <div className="demo-result-platform-header">
              <span className="platform-badge">📸 Instagram</span>
              <button
                className="copy-btn"
                onClick={() => {
                  const text = `${demoResult.hook ? demoResult.hook + '\n\n' : ''}${demoResult.body || ''}${demoResult.cta ? '\n\n' + demoResult.cta : ''}${demoResult.hashtags?.length ? '\n\n' + demoResult.hashtags.map(h => h.startsWith('#') ? h : '#' + h).join(' ') : ''}`
                  navigator.clipboard.writeText(text)
                }}
              >
                {t('landing.copy')}
              </button>
            </div>
            {demoResult.hook && <p className="demo-result-hook">{demoResult.hook}</p>}
            <p className="demo-result-body">{demoResult.body}</p>
            {demoResult.cta && <p className="demo-result-cta">{demoResult.cta}</p>}
            {demoResult.hashtags?.length > 0 && (
              <p className="demo-result-tags">
                {demoResult.hashtags.map((h, i) => (
                  <span key={i} className="hashtag">{h.startsWith('#') ? h : '#' + h}</span>
                ))}
              </p>
            )}
          </div>

          <div className="demo-result-cta-section">
            <p className="demo-result-cta-text">{t('landing.demoCta')}</p>
            <Link to="/register" className="btn btn-primary">
              <Sparkles size={16} /> {t('landing.startFree')}
            </Link>
          </div>
        </div>
      )}

      {/* Video Showcase — Emotion first */}
      <VideoShowcase />

      {/* How it works — Logic second */}
      <div className="what-we-are">
        <h2>{t('landing.howItWorks')}</h2>
        <div className="what-we-are-content">
          <div className="what-we-are-workflow">
            <div className="what-we-are-steps">
              <div className="landing-step">
                <span className="landing-step-icon">🎯</span>
                <strong>{t('landing.step1Title')}</strong>
                <p>{t('landing.step1Desc')}</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🧠</span>
                <strong>{t('landing.step2Title')}</strong>
                <p>{t('landing.step2Desc')}</p>
              </div>
              <span className="step-arrow">&rarr;</span>
              <div className="landing-step">
                <span className="landing-step-icon">🚀</span>
                <strong>{t('landing.step3Title')}</strong>
                <p>{t('landing.step3Desc')}</p>
              </div>
            </div>
            <p className="what-we-are-tagline">{t('landing.tagline2')}</p>
          </div>

          <div className="what-we-are-cta">
            <p>{t('landing.dsgvo')}</p>
            <Link to="/register" className="btn btn-primary">{t('landing.tryFree')}</Link>
          </div>
        </div>
      </div>

      {/* Wer wir sind */}
      <div className="about-section">
        <div className="about-content">
          <h2 className="about-headline">
            {lang === 'en' ? 'Yes, that magnificent fitness text was written 100% by us... 🤖' :
             lang === 'es' ? '¡Sí, ese magnífico texto de fitness fue escrito al 100% por nosotros... 🤖' :
             lang === 'fr' ? 'Oui, ce magnifique texte fitness a été écrit à 100 % par nous... 🤖' :
             lang === 'it' ? 'Sì, quel magnifico testo fitness è stato scritto al 100% da noi... 🤖' :
             lang === 'nl' ? 'Ja, die geweldige fittekst is voor 100% door ons geschreven... 🤖' :
             lang === 'el' ? 'Ναι, αυτό το υπέροχο κείμενο fitness γράφτηκε 100% από εμάς... 🤖' :
             'Ja, dieser grandiose Fitness-Text wurde zu 100 % von uns geschrieben... 🤖'}
          </h2>
          <p className="about-subtext">
            {lang === 'en' ? "Maybe you just saw a viral video about fitness, mindset or business and ended up here through our link. And no — we don't sell training plans!" :
             lang === 'es' ? 'Tal vez acabas de ver un video viral sobre fitness, mentalidad o negocios y aterrizaste aquí a través de nuestro enlace. ¡Y no — no vendemos planes de entrenamiento!' :
             lang === 'fr' ? "Peut-être que vous venez de voir une vidéo virale sur le fitness, l'état d'esprit ou les affaires et que vous êtes atterri ici via notre lien. Et non — nous ne vendons pas de programmes d'entraînement !" :
             lang === 'it' ? "Forse hai appena visto un video virale su fitness, mindset o business e sei finito qui attraverso il nostro link. E no — non vendiamo piani di allenamento!" :
             lang === 'nl' ? "Misschien heb je net een viraal video over fitness, mindset of business gezien en ben je via onze link hier terechtgekomen. En nee — we verkopen geen trainingsplannen!" :
             lang === 'el' ? 'Ίσως μόλις είδατε ένα ιοβόλο βίντεο για fitness, mindset ή business και κατελήξατε εδώ μέσω του συνδέσμου μας. Και όχι — δεν πουλάμε σχόλια γυμναστικής!' :
             'Vielleicht hast du gerade ein virales Video über Fitness, Mindset oder Business gesehen und bist über unseren Link hier gelandet. Und nein – wir verkaufen keine Trainingspläne!'}
          </p>
          <p className="about-body">
            {lang === 'en' ? "You landed here because you experienced the power of real AI content creation live in action. The text that just captivated you was created in less than 60 seconds right here on this platform." :
             lang === 'es' ? 'Aterrizaste aquí porque experimentaste el poder de la creación de contenido con IA real en acción. El texto que te acaba de capturar se creó en menos de 60 segundos aquí mismo en esta plataforma.' :
             lang === 'fr' ? "Vous êtes arrivé ici parce que vous avez vécu la puissance de la création de contenu IA en direct. Le texte qui vient de vous capturer a été créé en moins de 60 secondes ici même sur cette plateforme." :
             lang === 'it' ? 'Sei finito qui perché hai sperimentato il potere della creazione di contenuti IA dal vivo. Il testo che ti ha appena affascinato è stato creato in meno di 60 secondi proprio qui su questa piattaforma.' :
             lang === 'nl' ? 'Je bent hier terechtgekomen omdat je de kracht van echte AI-contentcreatie live in actie hebt ervaren. De tekst die je net heeft geboeid, is in minder dan 60 seconden precies hier op dit platform gemaakt.' :
             lang === 'el' ? 'Κατελήξατε εδώ γιατί βιώσατε τη δύναμη της πραγματικής δημιουργίας περιεχομένων AI σε δράση. Το κείμενο πού σας είχε μόλις τώρα ελκύσει δημιουργήθηκε σε λιγότερο από 60 δευτερόλεπτα ακριβώς εδώ σε αυτή την πλατφόρμα.' :
             'Du bist hier gelandet, weil du die Power echter KI-Content-Erstellung live in Aktion erlebt hast. Der Text, der dich gerade eben noch gefesselt hat, entstand in weniger als 60 Sekunden genau hier auf dieser Plattform.'}
          </p>

          <h3 className="about-what-title">
            {lang === 'en' ? 'What is happiness-eu.netlify.app?' :
             lang === 'es' ? '¿Qué es happiness-eu.netlify.app?' :
             lang === 'fr' ? "Qu'est-ce que happiness-eu.netlify.app ?" :
             lang === 'it' ? 'Che cos è happiness-eu.netlify.app?' :
             lang === 'nl' ? 'Wat is happiness-eu.netlify.app?' :
             lang === 'el' ? 'Τι είναι το happiness-eu.netlify.app;' :
             'Was ist happiness-eu.netlify.app?'}
          </h3>
          <p className="about-body">
            {lang === 'en' ? "We're your smart content machine. An innovative tool that writes high-converting social media texts, scripts, and recipes for creators, entrepreneurs, and businesses." :
             lang === 'es' ? 'Somos tu máquina de contenido inteligente. Una herramienta innovadora que escribe textos, scripts y recetas de redes sociales de alta conversión para creadores, emprendedores y empresas.' :
             lang === 'fr' ? "Nous sommes votre machine à contenu intelligente. Un outil innovant qui écrit des textes, scripts et recettes de réseaux sociaux à forte conversion pour les créateurs, entrepreneurs et entreprises." :
             lang === 'it' ? 'Siamo la tua macchina per contenuti intelligenti. Un tool innovativo che scrive testi, script e ricette per social media ad alta conversione per creator, imprenditori e aziende.' :
             lang === 'nl' ? "We zijn je slimme contentmachine. Een innovatief tool die hoog-converterende social media-teksten, scripts en recepten schrijft voor creators, ondernemers en bedrijven." :
             lang === 'el' ? 'Είμαστε η έξυπνη μηχανή περιεχομένων σας. Ένα καινοτόμο εργαλείο που γράφφει κείμενα, σενάρια και συνταγές social media υψηλής μετατροπής για δημιουργούς, επιχειρηματίες και εταιρείες.' :
             'Wir sind deine smarte Content-Maschine. Ein innovatives Tool, das für Creator, Selbstständige und Unternehmen hochgradig konvertierende Social-Media-Texte, Skripte und Rezepte schreibt.'}
          </p>

          <div className="about-features">
            <div className="about-feature">
              <span className="about-feature-icon">✍️</span>
              <div>
                <strong>{lang === 'en' ? 'No more writer\'s block' : lang === 'es' ? 'Adiós al bloqueo del escritor' : lang === 'fr' ? "Fin de la page blanche" : lang === 'it' ? 'Basta blocchi dello scrittore' : lang === 'nl' ? 'Geen writer\'s block meer' : lang === 'el' ? 'Όχι πια writer block' : 'Schluss mit Schreibblockaden'}</strong>
                <p>{lang === 'en' ? 'Ad-level copywriting texts in no time.' : lang === 'es' ? 'Textos de nivel publicitario en un instante.' : lang === 'fr' ? "Textes de niveau pro en un instant." : lang === 'it' ? 'Testi di livello pubblicitario in un attimo.' : lang === 'nl' ? 'Teksten van reclameniveau in een oogwenk.' : lang === 'el' ? 'Κείμενα επιπέδου διαφημιστικού σε στιγμή.' : 'Texte auf Werbetexter-Niveau im Handumdrehen.'}</p>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">⏰</span>
              <div>
                <strong>{lang === 'en' ? 'No more time pressure' : lang === 'es' ? 'Sin presión de tiempo' : lang === 'fr' ? 'Plus de pression temporelle' : lang === 'it' ? 'Niente più pressione del tempo' : lang === 'nl' ? 'Geen tijdsdruk meer' : lang === 'el' ? 'Χωρίς πίεση χρόνου' : 'Kein Zeitdruck mehr'}</strong>
                <p>{lang === 'en' ? 'Create content for a whole week in minutes.' : lang === 'es' ? 'Crea contenido para toda una semana en minutos.' : lang === 'fr' ? "Créez le contenu d'une semaine entière en quelques minutes." : lang === 'it' ? 'Crea contenuti per un\'intera settimana in pochi minuti.' : lang === 'nl' ? 'Maak content voor een hele week in minuten.' : lang === 'el' ? 'Δημιουργήστε περιεχόμενα για μια ολόκληρη εβδομάδα σε λεπτά.' : 'Erstelle den Content für eine ganze Woche in wenigen Minuten.'}</p>
              </div>
            </div>
            <div className="about-feature">
              <span className="about-feature-icon">🎯</span>
              <div>
                <strong>{lang === 'en' ? 'Focus on your core business' : lang === 'es' ? 'Enfócate en tu negocio principal' : lang === 'fr' ? 'Concentrez-vous sur votre cœur de métier' : lang === 'it' ? 'Concentrati sul tuo business principale' : lang === 'nl' ? 'Focus op je core business' : lang === 'el' ? 'Εστιάστε στη βασική σας δραστηριότητα' : 'Fokus auf dein Core-Business'}</strong>
                <p>{lang === 'en' ? 'Leave the writing to us and focus on what really moves you forward.' : lang === 'es' ? 'Déjanos escribir y concéntrate en lo que realmente te impulsa.' : lang === 'fr' ? "Laissez-nous écrire et concentrez-vous sur ce qui vous fait vraiment avancer." : lang === 'it' ? 'Lascia scrivere a noi e concentrati su ciò che ti fa davvero avanzare.' : lang === 'nl' ? 'Laat het schrijven aan ons over en concentreer je op wat je echt vooruit helpt.' : lang === 'el' ? 'Αφήστε εμάς να γράφουμε και εστιάστε σε αυτό που σας προωθεί πραγματικά.' : 'Überlass uns das Schreiben und konzentriere dich auf das, was dich wirklich voranbringt.'}</p>
              </div>
            </div>
          </div>

          <Link to="/register" className="btn btn-primary about-cta">
            {lang === 'en' ? 'Try it for free' : lang === 'es' ? 'Pruébalo gratis' : lang === 'fr' ? 'Essayez gratuitement' : lang === 'it' ? 'Prova gratis' : lang === 'nl' ? 'Probeer gratis' : lang === 'el' ? 'Δοκιμάστε δωρεάν' : 'Kostenlos testen'}
          </Link>
        </div>
      </div>

      {/* Platforms */}
      <div className="landing-platforms">
        <h2>{t('landing.platforms')}</h2>
        <div className="platform-grid">
          {[
            { name: 'TikTok', icon: '🎵' },
            { name: 'Instagram', icon: '📸' },
            { name: 'LinkedIn', icon: '💼' },
            { name: 'Facebook', icon: '👥' },
            { name: 'YouTube', icon: '▶️' },
            { name: 'X / Twitter', icon: '🐦' },
            { name: 'Pinterest', icon: '📌' },
            { name: 'Reddit', icon: '🔴' },
            { name: 'Blog', icon: '📝' },
            { name: 'Newsletter', icon: '✉️' },
            { name: 'Google Business', icon: '📍' },
            { name: 'Kleinanzeigen', icon: '🏷️' },
          ].map(p => (
            <div key={p.name} className="platform-card">
              <span className="platform-icon">{p.icon}</span>
              <span className="platform-name">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
