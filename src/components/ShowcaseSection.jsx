import { useState } from 'react'
import { Eye, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { SHOWCASE_PROJECTS, SHOWCASE_CATEGORIES } from '../intelligence/showcase-data'
import './ShowcaseSection.css'

export default function ShowcaseSection() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [expandedProject, setExpandedProject] = useState(null)
  const [activePlatform, setActivePlatform] = useState(null)

  const filteredProjects = activeCategory === 'all'
    ? SHOWCASE_PROJECTS
    : SHOWCASE_PROJECTS.filter(p =>
        p.id.includes(activeCategory) ||
        p.category.toLowerCase().includes(activeCategory)
      )

  const toggleProject = (id) => {
    if (expandedProject === id) {
      setExpandedProject(null)
      setActivePlatform(null)
    } else {
      setExpandedProject(id)
      setActivePlatform(null)
    }
  }

  return (
    <div className="showcase-section">
      <div className="showcase-header">
        <h2>Mit H.I.T. erstellt</h2>
        <p className="showcase-subtitle">
          Echte Projekte. Echte Ergebnisse. Keine Simulation.
        </p>
      </div>

      <div className="showcase-categories">
        {SHOWCASE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`showcase-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="showcase-grid">
        {filteredProjects.map(project => (
          <div key={project.id} className="showcase-card">
            <button
              className="showcase-card-header"
              onClick={() => toggleProject(project.id)}
            >
              <div className="showcase-card-left">
                <span className="showcase-card-icon">{project.icon}</span>
                <div className="showcase-card-info">
                  <h3>{project.idea}</h3>
                  <span className="showcase-card-category">{project.category}</span>
                </div>
              </div>
              <div className="showcase-card-right">
                <span className="showcase-card-platforms">
                  {Object.keys(project.platforms).length} Plattformen
                </span>
                {expandedProject === project.id ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
            </button>

            {expandedProject === project.id && (
              <div className="showcase-card-content">
                <div className="showcase-platform-tabs">
                  {Object.entries(project.platforms).map(([key, platform]) => (
                    <button
                      key={key}
                      className={`showcase-platform-tab ${activePlatform === key ? 'active' : ''}`}
                      onClick={() => setActivePlatform(key)}
                      style={{ '--platform-color': platform.color }}
                    >
                      <span>{platform.icon}</span>
                      <span>{platform.label}</span>
                    </button>
                  ))}
                </div>

                {activePlatform && project.platforms[activePlatform] && (
                  <div className="showcase-output">
                    <div className="showcase-output-header">
                      <span className="showcase-output-label">
                        {project.platforms[activePlatform].icon}{' '}
                        {project.platforms[activePlatform].label}
                      </span>
                      <span className="showcase-output-hint">
                        KI-generiert aus: "{project.idea}"
                      </span>
                    </div>
                    <div className="showcase-output-text">
                      {project.platforms[activePlatform].content}
                    </div>
                  </div>
                )}

                {!activePlatform && (
                  <div className="showcase-hint">
                    <Eye size={14} />
                    <span>Wähle eine Plattform oben, um den generierten Inhalt zu sehen</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="showcase-cta">
        <p>Das ist nur ein kleiner Ausschnitt. H.I.T. kann das für jedes Thema und jede Plattform.</p>
        <a href="/register" className="btn btn-primary">
          <ExternalLink size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Jetzt selbst ausprobieren
        </a>
      </div>
    </div>
  )
}
