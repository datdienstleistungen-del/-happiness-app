import React from 'react'
import './Logo.css'

const COLORS = [
  '#0d5e42', // Dark Green (N)
  '#ea580c', // Coral/Orange (e)
  '#b45309', // Amber/Gold (X)
  '#10b981', // Mint/Emerald (u)
  '#0d5e42', // Dark Green (s)
];

export function BrandWord({ fontSize = 'inherit', fontWeight = 'inherit' }) {
  const word = 'NeXus';
  return (
    <span style={{ fontSize, fontWeight }} className="brand-word">
      {word.split('').map((char, i) => (
        <span key={i} style={{ color: COLORS[i % COLORS.length] }}>{char}</span>
      ))}
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

export default function Logo({ size = 'default', showSubtitle = true }) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 28 : 34;
  
  const letters = [
    { char: 'N', color: '#0d5e42' },
    { char: 'e', color: '#ea580c' },
    { char: 'X', color: '#b45309' },
    { char: 'u', color: '#10b981' },
    { char: 's', color: '#0d5e42' },
  ];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      {/* Official Green App Icon */}
      <div
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          backgroundColor: '#0d5e42',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: isSmall ? '16px' : '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 2px 8px rgba(13, 94, 66, 0.25)',
          flexShrink: 0
        }}
      >
        N
      </div>

      {/* Official Typography */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.05' }}>
        <span style={{ fontSize: isSmall ? '19px' : '23px', fontWeight: 900, letterSpacing: '-0.3px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {letters.map((l, i) => (
            <span key={i} style={{ color: l.color }}>{l.char}</span>
          ))}
        </span>
        {showSubtitle && (
          <span style={{ fontSize: isSmall ? '7.5px' : '8.5px', color: '#475569', letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 800, marginTop: '2px' }}>
            REVENUE OS
          </span>
        )}
      </div>
    </div>
  );
}

export function VerticalLogo({ size = 'large' }) {
  return (
    <div className={`hit-logo-vertical ${size}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <img
        src="/nexus-logo-official.png"
        alt="NeXus Revenue OS"
        style={{ maxHeight: '60px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}