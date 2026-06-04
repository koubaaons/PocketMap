/**
 * @fileoverview CompletionRing — SVG progress ring.
 * Standalone component, reusable anywhere a percentage needs visual display.
 *
 * Usage:
 *   <CompletionRing pct={75} />
 */

export function CompletionRing({ pct }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-label={`${pct}% complete`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r}
        fill="none" stroke="#e8627a" strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="600" fill="#e8627a">
        {pct}%
      </text>
    </svg>
  );
}