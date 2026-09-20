import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Sparkles, Search, Globe, Filter } from 'lucide-react';

/**
 * NexusLiveProgressBar - Live Visual Multi-Step Progress Bar
 * Informs users clearly about what NeXus is searching, verifying, and generating
 */
export default function NexusLiveProgressBar({
  title = "Recherche & Analyse läuft...",
  subtitle = "Untersuche verifizierte Daten...",
  steps = [],
  estimatedDurationSec = 5
}) {
  const [progress, setProgress] = useState(12);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const defaultSteps = [
    { label: "Offizielle Kanäle (Website, LinkedIn, YouTube) lokalisieren", icon: Globe },
    { label: "Neueste Beiträge, Pressemitteilungen & Videos analysieren", icon: Search },
    { label: "Kaufsignale & Relevanz für dein Angebot prüfen", icon: Filter },
    { label: "Passgenauen Outreach & Mehrwert-Pitch formulieren", icon: Sparkles }
  ];

  const activeSteps = steps.length > 0 ? steps : defaultSteps;

  useEffect(() => {
    const startTime = Date.now();
    const durationMs = estimatedDurationSec * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / durationMs, 0.95);
      
      // Smooth asymptotic progress curve
      const calculatedProgress = Math.round(12 + 83 * (1 - Math.exp(-2.5 * ratio)));
      setProgress(calculatedProgress);

      const stepCount = activeSteps.length;
      const stepIdx = Math.min(Math.floor((calculatedProgress / 100) * stepCount), stepCount - 1);
      setCurrentStepIndex(stepIdx);
    }, 150);

    return () => clearInterval(interval);
  }, [estimatedDurationSec, activeSteps.length]);

  return (
    <div style={{
      background: 'var(--bg-card, #1e293b)',
      border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
      borderRadius: '12px',
      padding: '24px 28px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      margin: '12px 0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(239, 107, 75, 0.12)',
              color: 'var(--color-koralle, #ff6b4a)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              <Loader2 size={12} className="btn-spinner" /> Live-Recherche
            </span>
          </div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            {title}
          </h4>
          {subtitle && (
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary, #94a3b8)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{
          fontSize: '1.35rem',
          fontWeight: 800,
          color: 'var(--color-koralle, #ff6b4a)',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {progress}%
        </div>
      </div>

      {/* Progress Track */}
      <div style={{
        width: '100%',
        height: '8px',
        background: 'var(--bg-secondary, rgba(255,255,255,0.06))',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #ff6b4a 0%, #38bdf8 100%)',
          borderRadius: '6px',
          transition: 'width 0.25s ease-out',
          boxShadow: '0 0 12px rgba(56, 189, 248, 0.5)'
        }} />
      </div>

      {/* Steps List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '6px',
        background: 'var(--bg-secondary, rgba(0,0,0,0.15))',
        padding: '14px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-light, rgba(255,255,255,0.05))'
      }}>
        {activeSteps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;
          const label = typeof step === 'string' ? step : step.label;

          return (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.86rem',
              color: isCurrent 
                ? 'var(--text-primary, #fff)' 
                : (isDone ? 'var(--color-koralle, #ff6b4a)' : 'var(--text-secondary, #64748b)'),
              fontWeight: isCurrent ? 600 : (isDone ? 500 : 400),
              transition: 'all 0.2s ease'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isDone ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : isCurrent ? (
                  <Loader2 size={16} className="btn-spinner" color="#38bdf8" />
                ) : (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--border-light, rgba(255,255,255,0.2))'
                  }} />
                )}
              </div>
              <span style={{
                opacity: isCurrent ? 1 : (isDone ? 0.9 : 0.6),
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
