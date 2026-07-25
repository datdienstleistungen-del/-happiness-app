import './Logo.css'

const COLORS = [
  'var(--color-petrol)',
  'var(--color-koralle)',
  'var(--color-mint)',
  'var(--color-amber)',
];

export function BrandWord({ fontSize = 'inherit', fontWeight = 'inherit' }) {
  const word = 'happiness';
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
    { char: 'h', color: 'var(--color-petrol)' },
    { char: 'a', color: 'var(--color-koralle)' },
    { char: 'p', color: 'var(--color-mint)' },
    { char: 'p', color: 'var(--color-amber)' },
    { char: 'i', color: 'var(--color-petrol)' },
    { char: 'n', color: 'var(--color-koralle)' },
    { char: 'e', color: 'var(--color-mint)' },
    { char: 's', color: 'var(--color-amber)' },
    { char: 's', color: 'var(--color-petrol)' },
  ];
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.05' }}>
      <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.2px' }}>
        {letters.map((l, i) => (
          <span key={i} style={{ color: l.color }}>{l.char}</span>
        ))}
      </span>
      <span style={{ fontSize: '8px', color: '#6b7280', letterSpacing: '0.4px', textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>
        Intelligence Team
      </span>
    </div>
  );
}

export function VerticalLogo({ size = 'large' }) {
  return (
    <div className={`hit-logo-vertical ${size}`}>
      <div className="logo-row">
        <span className="letter-cap cap-h">H</span>
        <span className="letter-small">appiness</span>
      </div>
      <div className="logo-row">
        <span className="letter-cap cap-i">I</span>
        <span className="letter-small">ntelligence</span>
      </div>
      <div className="logo-row">
        <span className="letter-cap cap-t">T</span>
        <span className="letter-small">eam</span>
      </div>
    </div>
  );
}