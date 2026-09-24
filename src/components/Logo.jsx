import React from 'react'
import './Logo.css'

export function BrandWord({ fontSize = 'inherit', fontWeight = 'inherit' }) {
  return (
    <span style={{ fontSize, fontWeight, color: '#f8fafc', letterSpacing: '-0.02em' }} className="brand-word">
      NeXus
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
      {parts.slice(1).join('NeXus')}
    </>
  );
}

export default function Logo({ size = 'default', showSubtitle = true, iconOnly = false }) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 34;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      {/* Dark Obsidian App Icon */}
      <div
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          backgroundColor: '#11141a',
          border: '1px solid #2d3544',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8',
          fontWeight: 900,
          fontSize: isSmall ? '16px' : '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
          flexShrink: 0
        }}
      >
        N
      </div>

      {/* Clean Typography */}
      {!iconOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.05' }}>
          <span style={{ fontSize: isSmall ? '18px' : '22px', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            NeXus
          </span>
          {showSubtitle && (
            <span style={{ fontSize: isSmall ? '7.5px' : '8.5px', color: '#38bdf8', letterSpacing: '0.8px', textTransform: 'uppercase', fontWeight: 800, marginTop: '2px' }}>
              B2B INTELLIGENCE
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
        src="/nexus-logo-official.png"
        alt="NeXus B2B Intelligence"
        style={{ maxHeight: '60px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}