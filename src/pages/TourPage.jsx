import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, BarChart3, MessageSquare, Film, ArrowRight, Play, Compass, Sparkles } from 'lucide-react'
import { useLanguage } from '../i18n/translations'
import './TourPage.css'

const TRANSLATIONS = {
  de: {
    badge: "🎓 H.I.T. Studio Tour",
    title: "Der Content-Workflow erklärt",
    tagline: "Erfahre in wenigen Minuten, wie das Happiness Intelligence Team (H.I.T.) dir hilft, virale Videoideen vollautomatisch in fertige CapCut-Projekte zu verwandeln.",
    step1Title: "🎯 Ziel & Nische eingeben",
    step1Text: "Alles beginnt mit einer einfachen Idee. Du tippst dein konkretes Video-Ziel ein – zum Beispiel \"Fußball-Fails\" oder \"Mehr Kunden gewinnen\".",
    step1Bullet1: "Einfache Freitext-Eingabe ohne kompliziertes Prompt-Engineering",
    step1Bullet2: "Integrierte Quick-Chips für typische Creator-Ziele",
    step1MockInput: "Ich möchte Fußball-Fails erstellen...",
    step1MockBtn: "H.I.T. starten",
    step2Title: "📊 KI-Recherche & Plattformen",
    step2Text: "H.I.T. analysiert deine Zielgruppe, deinen optimalen Tonalitäts-Fokus und empfiehlt dir die 3 besten Plattformen für deine Nische.",
    step2Bullet1: "Automatische Berechnung deines viralen Content-Scores",
    step2Bullet2: "Optimierte Veröffentlichungszeiten & Hashtags",
    step2Recommended: "Empfohlen",
    step2Active: "Aktiv",
    step3Title: "🤖 Co-Pilot & Metaphern-Brücke",
    step3Text: "Die KI schreibt dir ein fertiges Videoskript mit Hook, Body und CTA. Eine psychologische Brücke (Metapher) verknüpft dein Thema emotional. Passt dir etwas nicht? Ändere es einfach im Chat!",
    step3Bullet1: "120-Wort-Begrenzung für optimales Pacing & Zuschauerbindung",
    step3Bullet2: "Chat-Eingabe per Tastatur oder direkt per Sprache",
    step3Assistant: "Hier ist dein Skript für Fußball-Fails mit einer Metapher über Erfolg im Leben...",
    step3User: "Mach das Skript etwas witziger und kürzer!",
    step4Title: "🎬 Clips & CapCut-Export",
    step4Text: "H.I.T. sucht passende Clips auf YouTube, TikTok und Stock-Plattformen heraus. Am Ende klickst du auf den CapCut-Button, um das Projekt direkt auf deiner Timeline zu bearbeiten.",
    step4Bullet1: "Direktlinks zu echtem Footage passend zur Nische",
    step4Bullet2: "Vorkonfiguriertes XML-Template-Projekt für CapCut",
    step4Btn: "🎬 In CapCut Studio öffnen",
    cta: "Jetzt selbst ausprobieren"
  },
  en: {
    badge: "🎓 H.I.T. Studio Tour",
    title: "The Content Workflow Explained",
    tagline: "Learn in a few minutes how the Happiness Intelligence Team (H.I.T.) helps you transform viral video ideas automatically into ready-to-use CapCut projects.",
    step1Title: "🎯 Enter Goal & Niche",
    step1Text: "Everything starts with a simple idea. You enter your specific video goal – for example \"Football Fails\" or \"Get more customers\".",
    step1Bullet1: "Simple free-text input without complicated prompt engineering",
    step1Bullet2: "Integrated Quick Chips for typical creator goals",
    step1MockInput: "I want to create football fails...",
    step1MockBtn: "Start H.I.T.",
    step2Title: "📊 AI Research & Platforms",
    step2Text: "H.I.T. analyzes your target group, your optimal tone focus, and recommends the 3 best platforms for your niche.",
    step2Bullet1: "Automatic calculation of your viral content score",
    step2Bullet2: "Optimized posting times & hashtags",
    step2Recommended: "Recommended",
    step2Active: "Active",
    step3Title: "🤖 Co-Pilot & Metaphor Bridge",
    step3Text: "The AI writes a finished video script with Hook, Body, and CTA. A psychological bridge (metaphor) connects your topic emotionally. Don't like something? Just change it in chat!",
    step3Bullet1: "120-word limit for optimal pacing & viewer retention",
    step3Bullet2: "Chat input via keyboard or directly by voice",
    step3Assistant: "Here is your script for football fails with a metaphor about success in life...",
    step3User: "Make the script a bit funnier and shorter!",
    step4Title: "🎬 Clips & CapCut Export",
    step4Text: "H.I.T. finds matching clips on YouTube, TikTok, and stock platforms. At the end, you click the CapCut button to edit the project directly on your timeline.",
    step4Bullet1: "Direct links to real footage matching the niche",
    step4Bullet2: "Pre-configured XML template project for CapCut",
    step4Btn: "🎬 Open in CapCut Studio",
    cta: "Try it yourself now"
  },
  es: {
    badge: "🎓 Tour de H.I.T. Studio",
    title: "El flujo de trabajo de contenido explicado",
    tagline: "Aprende en pocos minutos cómo el Happiness Intelligence Team (H.I.T.) te ayuda a transformar ideas de videos virales automáticamente en proyectos listos para CapCut.",
    step1Title: "🎯 Ingresar objetivo y nicho",
    step1Text: "Todo comienza con una idea simple. Escribe tu objetivo específico de video, por ejemplo \"Fails de fútbol\" o \"Atraer más clientes\".",
    step1Bullet1: "Entrada de texto simple sin ingeniería de prompts complicada",
    step1Bullet2: "Chips rápidos integrados para objetivos típicos de creadores",
    step1MockInput: "Quiero crear fails de fútbol...",
    step1MockBtn: "Iniciar H.I.T.",
    step2Title: "📊 Investigación de IA y plataformas",
    step2Text: "H.I.T. analiza tu público objetivo, tu tono ideal y recomienda las 3 mejores plataformas para tu nicho.",
    step2Bullet1: "Cálculo automático de tu puntuación de contenido viral",
    step2Bullet2: "Horarios de publicación y hashtags optimizados",
    step2Recommended: "Recomendado",
    step2Active: "Activo",
    step3Title: "🤖 Co-piloto y puente metafórico",
    step3Text: "La IA escribe un guión de video listo con gancho, cuerpo y llamada a la acción. Un puente psicológico (metáfora) conecta tu tema emocionalmente. ¿No te gusta algo? ¡Cámbialo en el chat!",
    step3Bullet1: "Límite de 120 palabras para un ritmo óptimo y retención de audiencia",
    step3Bullet2: "Entrada de chat por teclado o directamente por voz",
    step3Assistant: "Aquí está tu guión para fails de fútbol con una metáfora sobre el éxito en la vida...",
    step3User: "¡Haz el guión un poco más divertido y corto!",
    step4Title: "🎬 Clips y exportación a CapCut",
    step4Text: "H.I.T. busca clips adecuados en YouTube, TikTok y plataformas de stock. Al final, haces clic en el botón de CapCut para editar el proyecto directamente en tu línea de tiempo.",
    step4Bullet1: "Enlaces directos a videos reales que coinciden con el nicho",
    step4Bullet2: "Proyecto de plantilla XML preconfigurado para CapCut",
    step4Btn: "🎬 Abrir en CapCut Studio",
    cta: "Pruébalo tú mismo ahora"
  },
  fr: {
    badge: "🎓 Tour de H.I.T. Studio",
    title: "Le flux de travail de contenu expliqué",
    tagline: "Découvrez en quelques minutes comment l'Happiness Intelligence Team (H.I.T.) vous aide à transformer automatiquement des idées de vidéos virales en projets CapCut prêts à l'emploi.",
    step1Title: "🎯 Entrer l'objectif et la niche",
    step1Text: "Tout commence par une idée simple. Saisissez votre objectif vidéo spécifique – par exemple \"Fails de football\" ou \"Attirer plus de clients\".",
    step1Bullet1: "Saisie de texte simple sans ingénierie de prompt complexe",
    step1Bullet2: "Chips rapides intégrés pour les objectifs typiques de créateurs",
    step1MockInput: "Je veux créer des fails de football...",
    step1MockBtn: "Lancer H.I.T.",
    step2Title: "📊 Recherche IA & Plateformes",
    step2Text: "H.I.T. analyse votre public cible, votre ton optimal et vous recommande les 3 meilleures plateformes pour votre niche.",
    step2Bullet1: "Calcul automatique de votre score de contenu viral",
    step2Bullet2: "Heures de publication et hashtags optimisés",
    step2Recommended: "Recommandé",
    step2Active: "Actif",
    step3Title: "🤖 Co-pilote & Pont métaphorique",
    step3Text: "L'Al rédige un script vidéo fini avec Hook, Body et CTA. Un pont psychologique (métaphore) relie votre sujet de manière émotionnelle. Quelque chose ne va pas ? Modifiez-le simplement dans le chat !",
    step3Bullet1: "Limite de 120 mots pour un rythme optimal et la fidélisation du public",
    step3Bullet2: "Saisie de chat par clavier ou directement par la voix",
    step3Assistant: "Voici votre script pour les fails de football avec une métaphore sur le succès dans la vie...",
    step3User: "Rendez le script un peu plus drôle et plus court !",
    step4Title: "🎬 Clips & Exportation CapCut",
    step4Text: "H.I.T. trouve des clips correspondants sur YouTube, TikTok et les plateformes de stock. À la fin, vous cliquez sur le bouton CapCut pour éditer le projet directement sur votre timeline.",
    step4Bullet1: "Liens directs vers de vraies vidéos correspondant à la niche",
    step4Bullet2: "Projet de modèle XML préconfiguré pour CapCut",
    step4Btn: "🎬 Ouvrir dans CapCut Studio",
    cta: "Essayez-le vous-même maintenant"
  }
}

export default function TourPage() {
  const navigate = useNavigate()
  const { lang } = useLanguage()

  // Fallback to English if lang is not supported
  const text = TRANSLATIONS[lang] || TRANSLATIONS.de

  return (
    <div className="tour-container">
      <div className="tour-header">
        <span className="tour-badge">{text.badge}</span>
        <h1>{text.title}</h1>
        <p>{text.tagline}</p>
      </div>

      <div className="tour-timeline">
        {/* STEP 1 */}
        <div className="tour-step-card">
          <div className="tour-step-marker">
            <div className="tour-step-number">1</div>
          </div>
          <div className="tour-step-content">
            <div className="tour-step-info">
              <h3>{text.step1Title}</h3>
              <p>{text.step1Text}</p>
              <div className="tour-features-list">
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step1Bullet1}</span>
                </div>
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step1Bullet2}</span>
                </div>
              </div>
            </div>
            <div className="tour-step-visual">
              <div className="tour-mock-input-row">
                <span style={{ fontSize: '0.9rem' }}>🎯</span>
                <div className="tour-mock-text-typed">{text.step1MockInput}</div>
                <button className="tour-mock-btn">{text.step1MockBtn}</button>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className="tour-step-card">
          <div className="tour-step-marker">
            <div className="tour-step-number">2</div>
          </div>
          <div className="tour-step-content">
            <div className="tour-step-info">
              <h3>{text.step2Title}</h3>
              <p>{text.step2Text}</p>
              <div className="tour-features-list">
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step2Bullet1}</span>
                </div>
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step2Bullet2}</span>
                </div>
              </div>
            </div>
            <div className="tour-step-visual">
              <div className="tour-mock-recs">
                <div className="tour-mock-rec-item">
                  <span>🥇 TikTok</span>
                  <span style={{ color: 'var(--color-mint, #10b981)', fontWeight: 'bold' }}>{text.step2Recommended}</span>
                </div>
                <div className="tour-mock-rec-item">
                  <span>🥈 Instagram</span>
                  <span style={{ color: '#64748b' }}>{text.step2Active}</span>
                </div>
                <div className="tour-mock-rec-item">
                  <span>🥉 YouTube Shorts</span>
                  <span style={{ color: '#64748b' }}>{text.step2Active}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3 */}
        <div className="tour-step-card">
          <div className="tour-step-marker">
            <div className="tour-step-number">3</div>
          </div>
          <div className="tour-step-content">
            <div className="tour-step-info">
              <h3>{text.step3Title}</h3>
              <p>{text.step3Text}</p>
              <div className="tour-features-list">
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step3Bullet1}</span>
                </div>
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step3Bullet2}</span>
                </div>
              </div>
            </div>
            <div className="tour-step-visual">
              <div className="tour-mock-chat">
                <div className="tour-mock-chat-bubble assistant">
                  {text.step3Assistant}
                </div>
                <div className="tour-mock-chat-bubble user">
                  {text.step3User}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4 */}
        <div className="tour-step-card">
          <div className="tour-step-marker">
            <div className="tour-step-number">4</div>
          </div>
          <div className="tour-step-content">
            <div className="tour-step-info">
              <h3>{text.step4Title}</h3>
              <p>{text.step4Text}</p>
              <div className="tour-features-list">
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step4Bullet1}</span>
                </div>
                <div className="tour-feature-item">
                  <span className="tour-feature-bullet">✓</span>
                  <span>{text.step4Bullet2}</span>
                </div>
              </div>
            </div>
            <div className="tour-step-visual">
              <div className="tour-mock-export">
                <div className="tour-mock-links">
                  <span className="tour-mock-link-btn">▶️ YouTube</span>
                  <span className="tour-mock-link-btn">🎵 TikTok</span>
                  <span className="tour-mock-link-btn">📹 Pexels</span>
                </div>
                <button className="tour-mock-capcut-btn">
                  {text.step4Btn}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tour-cta-section">
        <button className="tour-cta-btn" onClick={() => navigate('/')}>
          <Sparkles size={20} />
          {text.cta}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
