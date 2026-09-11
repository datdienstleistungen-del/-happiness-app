import React, { useState, useEffect } from 'react';
import { generateSignalStrategies, getSignalStrategies } from '../../lib/nexus-db';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/translations.jsx';
import { Zap, Loader2, Globe, FileText, CheckCircle } from 'lucide-react';

export default function SignalStrategiesManager({ offering }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
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
      const newStrats = await generateSignalStrategies(offering.id, offering.ai_understanding, offering.target_markets, language);
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
    <div style={{ background: 'var(--bg-elevated)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="var(--color-brand)" />
            Signal Strategies Engine
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Die KI analysiert dein Angebot und generiert maßgeschneiderte Suchstrategien für deine Zielmärkte ({offering.target_markets?.join(', ') || 'Global'}).
          </p>
        </div>
        <button 
          className="btn-primary" 
          onClick={handleGenerate} 
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {generating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
          {generating ? 'Generiere...' : (strategies.length > 0 ? 'Neu generieren' : 'Strategien generieren')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && !generating && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <Loader2 className="spin" size={24} />
        </div>
      )}

      {!loading && strategies.length === 0 && !generating && (
        <div style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>
          <FileText size={32} color="var(--text-tertiary)" style={{ marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 8px 0' }}>Noch keine Signalstrategien</h4>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Klicke auf "Strategien generieren", um die NeXus Intelligence Engine zu starten.
          </p>
        </div>
      )}

      {!loading && strategies.length > 0 && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {strategies.map((strat, idx) => (
            <div key={strat.id || idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="var(--color-koralle)" />
                  {strat.trigger_name}
                </h4>
                <span style={{ fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                  {strat.signal_category}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                {strat.why_relevant}
              </p>
              
              <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px', color: 'var(--text-tertiary)' }}>MARKET QUERIES</strong>
                {Array.isArray(strat.search_queries) && strat.search_queries.map((sq, i) => (
                  <div key={i} style={{ marginBottom: i < strat.search_queries.length - 1 ? '8px' : '0', fontSize: '0.85rem' }}>
                    <span style={{ display: 'inline-block', width: '40px', fontWeight: 'bold', color: 'var(--color-brand)' }}>{sq.market}</span>
                    <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>{sq.query}</code>
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
