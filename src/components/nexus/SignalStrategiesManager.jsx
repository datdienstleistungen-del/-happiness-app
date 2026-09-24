import React, { useState, useEffect } from 'react';
import { generateSignalStrategies, getSignalStrategies } from '../../lib/nexus-db';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/translations.jsx';
import { Zap, Loader2, Globe, FileText, CheckCircle } from 'lucide-react';

export default function SignalStrategiesManager({ offering }) {
  const { user } = useAuth();
  const { t, lang, language } = useLanguage();
  const activeLang = lang || language || 'de';
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadStrategies = async () => {
    if (!offering) return;
    setLoading(true);
    try {
      const data = await getSignalStrategies(offering.id);
      setStrategies(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, [offering]);

  const handleGenerate = async () => {
    if (!offering) return;
    setGenerating(true);
    setError(null);
    try {
      const aiUnderstanding = offering.ai_understanding || {
        offering_name: offering.offering_name,
        target_audience: offering.target_audience,
        positioning: offering.positioning,
        demand_contexts: []
      };
      const newStrats = await generateSignalStrategies(offering.id, aiUnderstanding, offering.target_markets, activeLang);
      if (newStrats && newStrats.length > 0) {
        await loadStrategies(); // Reload from DB
      } else {
        setError('Es konnten keine Strategien generiert werden.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!offering) return null;

  return (
    <div style={{ background: 'var(--bg-card, #11141a)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-medium, #1e232d)', marginTop: '24px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary, #f8fafc)', fontSize: '1.1rem', fontWeight: 700 }}>
            <Globe size={18} color="var(--accent-blue, #38bdf8)" />
            {t('nexus.offeringAnalysis.strategyEngineTitle', 'Signal Strategies Engine')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary, #94a3b8)' }}>
            {t('nexus.offeringAnalysis.strategyEngineDesc', 'Die KI analysiert dein Angebot und generiert maßgeschneiderte Suchstrategien für deine Zielmärkte.')} ({offering.target_markets?.join(', ') || 'Global'}).
          </p>
        </div>
        <button 
          className="btn-analyze-primary" 
          onClick={handleGenerate} 
          disabled={generating}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {generating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
          {generating ? t('nexus.offeringAnalysis.btnGeneratingStrategies', 'Generiere...') : (strategies.length > 0 ? t('nexus.offeringAnalysis.btnRegenerateStrategies', 'Neu generieren') : t('nexus.offeringAnalysis.btnGenerateStrategies', 'Strategien generieren'))}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', marginBottom: '16px', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {loading && !generating && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <Loader2 className="spin" size={24} color="var(--accent-blue, #38bdf8)" />
        </div>
      )}

      {!loading && strategies.length === 0 && !generating && (
        <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--bg-dark, #0a0c0f)', borderRadius: '8px', border: '1px dashed var(--border-subtle, #1e232d)' }}>
          <FileText size={32} color="var(--text-muted, #64748b)" style={{ marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary, #f8fafc)', fontSize: '1rem', fontWeight: 600 }}>{t('nexus.offeringAnalysis.noStrategiesYet', 'Noch keine Signalstrategien')}</h4>
          <p style={{ margin: 0, color: 'var(--text-secondary, #94a3b8)', fontSize: '0.88rem' }}>
            {t('nexus.offeringAnalysis.noStrategiesDesc', 'Klicke auf "Strategien generieren", um die NeXus Intelligence Engine zu starten.')}
          </p>
        </div>
      )}

      {!loading && strategies.length > 0 && (
        <div style={{ display: 'grid', gap: '14px' }}>
          {strategies.map((strat, idx) => (
            <div key={strat.id || idx} style={{ background: 'var(--bg-dark, #0a0c0f)', border: '1px solid var(--border-subtle, #1e232d)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary, #f8fafc)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600 }}>
                  <CheckCircle size={16} color="var(--accent-blue, #38bdf8)" />
                  {strat.trigger_name}
                </h4>
                <span style={{ fontSize: '0.72rem', background: 'var(--bg-card, #11141a)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle, #1e232d)', color: 'var(--accent-blue, #38bdf8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {strat.signal_category}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                {strat.why_relevant}
              </p>
              
              <div style={{ background: 'var(--bg-card, #11141a)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle, #1e232d)' }}>
                <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '8px', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MARKET QUERIES</strong>
                {Array.isArray(strat.search_queries) && strat.search_queries.map((sq, i) => (
                  <div key={i} style={{ marginBottom: i < strat.search_queries.length - 1 ? '8px' : '0', fontSize: '0.82rem' }}>
                    <span style={{ display: 'inline-block', width: '40px', fontWeight: 700, color: 'var(--accent-blue, #38bdf8)' }}>{sq.market}</span>
                    <code style={{ background: 'var(--bg-input, #0e1015)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle, #1e232d)', color: 'var(--text-primary, #f8fafc)' }}>{sq.query}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
