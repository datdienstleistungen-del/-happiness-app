import React from 'react'
import { 
  Target, AlertTriangle, TrendingUp, Users, MessageSquare, 
  Phone, Lightbulb, ChevronRight, CheckCircle, Flame
} from 'lucide-react'
import { useLanguage } from '../i18n/translations.jsx'
import './NexusAnalysisResult.css'

/**
 * NexusAnalysisResult
 * 
 * Presentation Layer für NeXus KI-Ausgaben.
 * Wandelt rohes JSON in verständliche Sales Intelligence Analyse um.
 */
export default function NexusAnalysisResult({ data, mode = 'angebotsanalyse' }) {
  // Try to parse JSON if it's a string (handles markdown code blocks)
  let parsed = data
  if (typeof data === 'string') {
    // Remove any leading/trailing whitespace
    let cleanStr = data.trim()
    
    // Extract JSON from possible markdown code block
    const jsonMatch = cleanStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      cleanStr = jsonMatch[1].trim()
    }
    
    // Try to find JSON object in the string (might have text before/after)
    const jsonStart = cleanStr.indexOf('{')
    const jsonEnd = cleanStr.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanStr = cleanStr.substring(jsonStart, jsonEnd + 1)
    }
    
    try {
      parsed = JSON.parse(cleanStr)
    } catch {
      // Not JSON, render as plain text
      return <div className="nexus-plain-text">{data}</div>
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return <div className="nexus-plain-text">{String(data)}</div>
  }

  // Render based on mode
  switch (mode) {
    case 'angebotsanalyse':
      return <AngebotsanalyseView data={parsed} />
    case 'trigger_detection':
      return <TriggerDetectionView data={parsed} />
    case 'lead_intelligence':
      return <LeadIntelligenceView data={parsed} />
    case 'sales_pitch':
    case 'follow_up':
    case 'einwandbehandlung':
    case 'forum_response':
      return <SalesMessageView data={parsed} text={data} />
    default:
      return <GenericView data={parsed} />
  }
}

// ── Angebotsanalyse ──

function AngebotsanalyseView({ data }) {
  const { t } = useLanguage()
  return (
    <div className="nexus-analysis">
      {/* Zielgruppe */}
      {data.zielgruppe && (
        <Section title={t('nexus.targetGroup')} icon={Users}>
          <div className="nexus-kpi-row">
            <KPI label={t('nexus.buyingCycle')} value={data.zielgruppe.kaufzyklus} />
            <KPI label={t('nexus.budgetType')} value={data.zielgruppe.budget_typ} />
          </div>
          <p className="nexus-description">{data.zielgruppe.beschreibung}</p>
          {data.zielgruppe.entscheider && (
            <div className="nexus-chips">
              {data.zielgruppe.entscheider.map((e, i) => (
                <span key={i} className="nexus-chip">{e}</span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Schmerzpunkte */}
      {data.schmerzpunkte && data.schmerzpunkte.length > 0 && (
        <Section title={t('nexus.painPoints')} icon={AlertTriangle}>
          <div className="nexus-cards">
            {data.schmerzpunkte.map((sp, i) => (
              <div key={i} className="nexus-card nexus-card-warning">
                <div className="nexus-card-header">
                  <span className={`nexus-priority nexus-priority-${sp.dringlichkeit?.toLowerCase()}`}>
                    {sp.dringlichkeit}
                  </span>
                </div>
                <h4>{sp.problem}</h4>
                <p className="nexus-card-detail">
                  <strong>{t('nexus.impact')}:</strong> {sp.auswirkung}
                </p>
                {sp.kosten && (
                  <p className="nexus-card-cost">{t('nexus.costs')}: {sp.kosten}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Trigger Events */}
      {data.trigger_events && data.trigger_events.length > 0 && (
        <Section title={t('nexus.triggerEvents')} icon={Flame}>
          <div className="nexus-cards">
            {data.trigger_events.map((te, i) => (
              <div key={i} className={`nexus-card nexus-card-trigger nexus-sig-${te.signifikanz?.toLowerCase()}`}>
                <div className="nexus-card-header">
                  <Flame size={16} />
                  <span className={`nexus-priority nexus-priority-${te.signifikanz?.toLowerCase()}`}>
                    {te.signifikanz}
                  </span>
                </div>
                <h4>{te.event}</h4>
                {te.beispiel && (
                  <p className="nexus-card-example">Beispiel: {te.beispiel}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Trigger Quellen */}
      {data.trigger_quellen && data.trigger_quellen.length > 0 && (
        <Section title="Wo findest du diese Trigger?" icon={Target}>
          <div className="nexus-table-wrapper">
            <table className="nexus-table">
              <thead>
                <tr>
                  <th>Quelle</th>
                  <th>Typ</th>
                  <th>Zugang</th>
                  <th>Relevanz</th>
                </tr>
              </thead>
              <tbody>
                {data.trigger_quellen.map((q, i) => (
                  <tr key={i}>
                    <td>{q.quelle}</td>
                    <td><span className="nexus-type-badge">{q.typ}</span></td>
                    <td>{q.zugang}</td>
                    <td><span className={`nexus-relevance nexus-rel-${q.relevanz?.toLowerCase()}`}>{q.relevanz}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Vertriebsstrategie */}
      {data.vertriebsstrategie && (
        <Section title="Vertriebsstrategie" icon={TrendingUp}>
          <div className="nexus-strategy">
            <div className="nexus-strategy-item">
              <span className="nexus-strategy-label">Empfohlener Kanal:</span>
              <span className="nexus-strategy-value">{data.vertriebsstrategie.empfohlener_kanal}</span>
            </div>
            <div className="nexus-strategy-item">
              <span className="nexus-strategy-label">Ansprache:</span>
              <span className="nexus-strategy-value">{data.vertriebsstrategie.ansprache_typ}</span>
            </div>
            <div className="nexus-strategy-item">
              <span className="nexus-strategy-label">Timing:</span>
              <span className="nexus-strategy-value">{data.vertriebsstrategie.timing}</span>
            </div>
            <div className="nexus-strategy-item">
              <span className="nexus-strategy-label">Typische Conversion:</span>
              <span className="nexus-strategy-value">{data.vertriebsstrategie.conversion_rate_typisch}</span>
            </div>
          </div>
          {data.vertriebsstrategie.sequentielles_vorgehen && (
            <div className="nexus-steps">
              <h4>Nächste Schritte:</h4>
              <ol>
                {data.vertriebsstrategie.sequentielles_vorgehen.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </Section>
      )}

      {/* Pitch Grundlage */}
      {data.pitch_grundlage && (
        <Section title="Dein Pitch" icon={MessageSquare}>
          <div className="nexus-pitch">
            <div className="nexus-pitch-item">
              <h4>Value Proposition</h4>
              <p>{data.pitch_grundlage.value_proposition}</p>
            </div>
            <div className="nexus-pitch-item">
              <h4>Differenzierung</h4>
              <p>{data.pitch_grundlage.differenzierung}</p>
            </div>
            <div className="nexus-pitch-item">
              <h4>Social Proof</h4>
              <p>{data.pitch_grundlage.social_proof}</p>
            </div>
            <div className="nexus-pitch-cta">
              <CheckCircle size={18} />
              <span>{data.pitch_grundlage.call_to_action}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Einwandbehandlung */}
      {data.einwandbehandlung && data.einwandbehandlung.length > 0 && (
        <Section title="Einwandbehandlung" icon={MessageSquare}>
          <div className="nexus-cards">
            {data.einwandbehandlung.map((eb, i) => (
              <div key={i} className="nexus-card nexus-card-objection">
                <div className="nexus-objection-q">
                  <span>Kunde sagt:</span> "{eb.einwand}"
                </div>
                <div className="nexus-objection-a">
                  <span>Deine Antwort:</span> {eb.antwort}
                </div>
                {eb.technik && (
                  <span className="nexus-technique">{eb.technik}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Gesprächsstrategie */}
      {data.gesprachsstrategie && (
        <Section title="Gesprächsstrategie" icon={Phone}>
          {data.gesprachsstrategie.erstgespraech && (
            <div className="nexus-convo">
              <h4>Erstgespräch</h4>
              <p className="nexus-convo-goal"><strong>Ziel:</strong> {data.gesprachsstrategie.erstgespraech.ziel}</p>
              {data.gesprachsstrategie.erstgespraech.fragen && (
                <div className="nexus-questions">
                  <span>Fragen:</span>
                  <ul>
                    {data.gesprachsstrategie.erstgespraech.fragen.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.gesprachsstrategie.erstgespraech.golden_rule && (
                <p className="nexus-golden-rule">
                  <Lightbulb size={14} /> {data.gesprachsstrategie.erstgespraech.golden_rule}
                </p>
              )}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

// ── Trigger Detection ──

function TriggerDetectionView({ data }) {
  // Handle object with trigger_events array
  const triggers = Array.isArray(data) 
    ? data 
    : (data?.trigger_events || data?.triggers || [])
  
  if (triggers.length > 0) {
    return (
      <div className="nexus-analysis">
        {data?.zusammenfassung && (
          <Section title="Zusammenfassung" icon={Target}>
            <p className="nexus-description">{data.zusammenfassung}</p>
          </Section>
        )}
        <Section title="Gefundene Trigger Events" icon={Flame}>
          <div className="nexus-cards">
            {triggers.map((item, i) => (
              <div key={i} className="nexus-card nexus-card-trigger">
                <div className="nexus-card-header">
                  <h4>{item.firmenname || item.company || item.event || item.beschreibung || 'Trigger'}</h4>
                  {item.signifikanz && (
                    <span className={`nexus-priority nexus-priority-${item.signifikanz?.toLowerCase()}`}>
                      {item.signifikanz}
                    </span>
                  )}
                </div>
                {item.beschreibung && (
                  <p className="nexus-card-detail">{item.beschreibung}</p>
                )}
                {item.event && item.firmenname && (
                  <p className="nexus-card-detail"><strong>Event:</strong> {item.event}</p>
                )}
                {item.kaufwahrscheinlichkeit && (
                  <p className="nexus-card-cost">Kaufwahrscheinlichkeit: {item.kaufwahrscheinlichkeit}%</p>
                )}
                {item.kaufhinweise && item.kaufhinweise.length > 0 && (
                  <ul className="nexus-card-list">
                    {item.kaufhinweise.map((hinweis, j) => (
                      <li key={j}>{hinweis}</li>
                    ))}
                  </ul>
                )}
                {item.empfohlene_aktion && (
                  <p className="nexus-card-detail"><strong>Empfohlene Aktion:</strong> {item.empfohlene_aktion}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    )
  }
  return <GenericView data={data} />
}

// ── Lead Intelligence ──

function LeadIntelligenceView({ data }) {
  return <AngebotsanalyseView data={data} />
}

// Sales Message (Plain Text)

function SalesMessageView({ data, text }) {
  // If the parsed object has a response property, use it. 
  // This handles the case where Mistral wrapped the JSON in markdown blocks, causing the raw text to fail parsing initially but succeed in safelyParseJSON.
  const content = data?.response ? data.response : (typeof text === 'string' ? text : JSON.stringify(data, null, 2))
  
  return <div className="nexus-plain-text nexus-sales-message">{content}</div>
}

// ── Generic Fallback ──

function GenericView({ data }) {
  return (
    <div className="nexus-analysis">
      <pre className="nexus-raw-json">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}

// ── Helper Components ──

function Section({ title, icon: Icon, children }) {
  return (
    <div className="nexus-section">
      <h3 className="nexus-section-title">
        {Icon && <Icon size={20} />}
        {title}
      </h3>
      {children}
    </div>
  )
}

function KPI({ label, value }) {
  return (
    <div className="nexus-kpi">
      <span className="nexus-kpi-label">{label}</span>
      <span className="nexus-kpi-value">{value}</span>
    </div>
  )
}
