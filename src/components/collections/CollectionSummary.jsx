/**
 * @fileoverview CollectionSummary — stats bar shown across all collection tabs.
 *
 * Shows total, owned, missing, unorganised counts and a completion ring.
 * Receives pre-computed stats via props — no selectors called here.
 */

// === ISSUE #47 START: Collection Summary ===

/**
 * @param {{
 *   stats: { total: number, owned: number, missing: number, unorganised: number, pct: number }
 * }} props
 */
export function CollectionSummary({ stats }) {
  const { total, owned, missing, unorganised, pct } = stats;

  return (
    <div className="collection-summary">
      <SummaryRing pct={pct} />
      <div className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat-value">{total}</span>
          <span className="summary-stat-label">Total</span>
        </div>
        <div className="summary-stat summary-stat-owned">
          <span className="summary-stat-value">{owned}</span>
          <span className="summary-stat-label">Owned</span>
        </div>
        <div className="summary-stat summary-stat-missing">
          <span className="summary-stat-value">{missing}</span>
          <span className="summary-stat-label">Missing</span>
        </div>
        <div className="summary-stat summary-stat-unorganised">
          <span className="summary-stat-value">{unorganised}</span>
          <span className="summary-stat-label">Unorganised</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRing({ pct }) {
  const r    = 24;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;

  return (
    <div className="summary-ring-wrapper">
      <svg width="60" height="60" viewBox="0 0 60 60" aria-label={`${pct}% complete`}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--accent)"  strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={fill}
          strokeLinecap="round" transform="rotate(-90 30 30)" />
        <text x="30" y="34" textAnchor="middle" fontSize="11"
          fontWeight="700" fill="var(--accent)">{pct}%</text>
      </svg>
    </div>
  );
}

// === ISSUE #47 END: Collection Summary ===