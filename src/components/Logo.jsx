import React from 'react'
import './Logo.css'

export function BrandWord({ fontSize = 'inherit', fontWeight = 'inherit' }) {
  return (
    <span style={{ fontSize, fontWeight, color: 'inherit', letterSpacing: '-0.01em' }} className="brand-word">
      D.A.T.
    </span>
  );
}

export function renderBrandText(text) {
  let parts = text.split('NeXus');
  if (parts.length === 1) parts = text.split('Happiness');
  if (parts.length === 1) return text;
  return (
    <>
      {parts[0]}
      <BrandWord />
      {parts.slice(1).join('D.A.T.')}
    </>
  );
}

export default function Logo({ size = 'default', showSubtitle = true, iconOnly = false }) {
  const isSmall = size === 'small';
  const imgHeight = isSmall ? 28 : 34;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      {/* Official D.A.T. Corporate Logo Emblem */}
      <img
        src="/dat-logo-corporate.png"
        alt="D.A.T. Dienstleistungen"
        style={{
          height: `${imgHeight}px`,
          width: 'auto',
          objectFit: 'contain',
          borderRadius: '4px',
          flexShrink: 0
        }}
      />

      {/* Corporate Typography */}
      {!iconOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.15' }}>
          <span style={{
            fontSize: isSmall ? '13px' : '15px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#f8fafc',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap'
          }}>
            D.A.T. DIENSTLEISTUNGEN
          </span>
          {showSubtitle && (
            <span style={{
              fontSize: isSmall ? '8px' : '9px',
              color: '#38bdf8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginTop: '1px',
              whiteSpace: 'nowrap'
            }}>
              Executive Mandate Desk
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function VerticalLogo({ size = 'large' }) {
  return (
    <div className={`hit-logo-vertical ${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <img
        src="/dat-logo-corporate.png"
        alt="D.A.T. Dienstleistungen"
        style={{ maxHeight: '64px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}