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
    <span style={{ fontSize: '32px', fontWeight: 500 }}>
      {letters.map((l, i) => (
        <span key={i} style={{ color: l.color }}>{l.char}</span>
      ))}
    </span>
  );
}