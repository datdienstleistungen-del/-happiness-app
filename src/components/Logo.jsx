import './Logo.css'

const COLORS = [
  'var(--color-petrol)',
  'var(--color-koralle)',
  'var(--color-amber)',
  'var(--color-mint)',
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
  const parts = text.split('Happiness');
  if (parts.length === 1) return text;
  return (
    <>
      {parts[0]}
      <BrandWord />
      {parts.slice(1).join('Happiness')}
    </>
  );
}

export default function Logo() {
  const letters = [
    { char: 'N', color: 'var(--color-petrol)' },
    { char: 'e', color: 'var(--color-koralle)' },
    { char: 'X', color: 'var(--color-amber)' },
    { char: 'u', color: 'var(--color-mint)' },
    { char: 's', color: 'var(--color-petrol)' },
  ];
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.05' }}>
      <span style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.2px' }}>
        {letters.map((l, i) => (
          <span key={i} style={{ color: l.color }}>{l.char}</span>
        ))}
      </span>
      <span style={{ fontSize: '8.5px', color: '#6b7280', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>
        Sales Operating System
      </span>
    </div>
  );
}

export function VerticalLogo({ size = 'large' }) {
  return (
    <div className={`hit-logo-vertical ${size}`}>
      <div className="logo-row">
        <span className="letter-cap cap-h" style={{ color: 'var(--color-petrol)' }}>N</span>
        <span className="letter-small">eXus</span>
      </div>
      <div className="logo-row">
        <span className="letter-cap cap-i" style={{ color: 'var(--color-koralle)' }}>O</span>
        <span className="letter-small">perating</span>
      </div>
      <div className="logo-row">
        <span className="letter-cap cap-t" style={{ color: 'var(--color-amber)' }}>S</span>
        <span className="letter-small">ystem</span>
      </div>
    </div>
  );
}