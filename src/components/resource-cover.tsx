// On-brand generated cover art (geometric, Apple-style — no stock imagery).
// One distinct motif per resource type; dark surface + faint blue grid + blue accents.

export type CoverKind = "assessment" | "calculator" | "template" | "playbook" | "insight";

export function ResourceCover({ kind, label }: { kind: CoverKind; label: string }) {
  const id = `g-${kind}`;
  return (
    <svg viewBox="0 0 400 200" width="100%" role="img" aria-label={`${label} cover`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b0b0d" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id})`} />
      {/* faint grid (matches the hero) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="200" stroke="rgba(0,113,227,0.20)" strokeWidth="1" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="rgba(0,113,227,0.20)" strokeWidth="1" />
      ))}

      {kind === "assessment" ? (
        <g fill="none" stroke="#2997ff" strokeWidth="6" strokeLinecap="round">
          <path d="M120 150 A70 70 0 1 1 280 150" opacity="0.25" />
          <path d="M120 150 A70 70 0 0 1 235 95" />
          <line x1="200" y1="150" x2="245" y2="110" stroke="#fff" strokeWidth="4" />
          <circle cx="200" cy="150" r="7" fill="#fff" stroke="none" />
        </g>
      ) : null}

      {kind === "calculator" ? (
        <g>
          {[40, 90, 140].map((h, i) => (
            <rect key={i} x={140 + i * 45} y={160 - h} width="28" height={h} rx="4" fill={i === 2 ? "#2997ff" : "rgba(41,151,255,0.45)"} />
          ))}
          <line x1="120" y1="160" x2="290" y2="160" stroke="#fff" strokeWidth="3" opacity="0.5" />
        </g>
      ) : null}

      {kind === "template" ? (
        <g>
          <rect x="150" y="50" width="100" height="120" rx="8" fill="#161618" stroke="#2997ff" strokeWidth="3" />
          {[78, 98, 118, 138].map((y, i) => (
            <line key={i} x1="166" y1={y} x2={i % 2 ? 220 : 234} y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth="5" strokeLinecap="round" />
          ))}
        </g>
      ) : null}

      {kind === "playbook" ? (
        <g fill="none" stroke="#2997ff" strokeWidth="4">
          {[120, 200, 280].map((cx, i) => (
            <g key={i}>
              <circle cx={cx} cy="100" r="18" fill="#161618" />
              <text x={cx} y="106" fontSize="18" fontFamily="Inter, sans-serif" fontWeight="700" fill="#fff" textAnchor="middle" stroke="none">{i + 1}</text>
              {i < 2 ? <line x1={cx + 18} y1="100" x2={cx + 62} y2="100" strokeDasharray="2 6" strokeLinecap="round" /> : null}
            </g>
          ))}
        </g>
      ) : null}

      {kind === "insight" ? (
        <g>
          <text x="150" y="120" fontSize="120" fontFamily="Georgia, serif" fill="#2997ff" opacity="0.85">&ldquo;</text>
          <line x1="150" y1="135" x2="270" y2="135" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" />
          <line x1="150" y1="152" x2="230" y2="152" stroke="rgba(255,255,255,0.25)" strokeWidth="5" strokeLinecap="round" />
        </g>
      ) : null}

      <text x="20" y="184" fontSize="11" letterSpacing="2" fontFamily="Inter, sans-serif" fontWeight="600" fill="rgba(255,255,255,0.55)">
        {label.toUpperCase()}
      </text>
    </svg>
  );
}
