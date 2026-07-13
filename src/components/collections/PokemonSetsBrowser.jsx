/**
 * @fileoverview PokemonSetsBrowser — full page listing every Pokémon
 * TCG set, replacing CollectionsView's normal content when a user
 * drills into the "Pokémon TCG" franchise tile.
 * === ISSUE #130 (redesign) ===
 *
 * The original design routed set search through a modal step with a
 * debounced network search — even at 400ms, real network latency on
 * top of that made it feel laggy and not genuinely "live". This
 * fetches every set ONCE on mount (fetchAllSets — comfortably under
 * the API's single-request cap) and filters that array client-side
 * as the user types: a plain JS .filter(), zero network calls per
 * keystroke, genuinely instant.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button, EmptyState } from '../ui/index.jsx';
import { fetchAllSets } from '../../services/pokemonApi.js';
import { PokemonImportModal } from '../modals/PokemonImportModal.jsx';

export function PokemonSetsBrowser({ onBack, onImportSuccess }) {
  const [allSets, setAllSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [importingSet, setImportingSet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllSets()
      .then(sets => { if (!cancelled) setAllSets(sets); })
      .catch(err => {
        console.error('[Pokemon sets browser] failed to load sets:', err);
        if (!cancelled) setLoadError('Could not load sets. Check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Instant client-side filter — no network call, no debounce needed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSets;
    return allSets.filter(s =>
      s.name.toLowerCase().includes(q) || s.series?.toLowerCase().includes(q)
    );
  }, [allSets, query]);

  return (
    <div className="view">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <p className="section-subtitle" style={{ margin: 0 }}>Pokémon TCG Sets</p>
        </div>
      </div>

      <div className="search-bar-wrapper" style={{ marginBottom: 20 }}>
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search sets…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search Pokémon sets"
          autoFocus
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
        )}
      </div>

      {isLoading && <p className="modal-step-intro">Loading sets…</p>}
      {loadError && <p className="modal-step-error">{loadError}</p>}

      {!isLoading && !loadError && filtered.length === 0 && (
        <EmptyState icon="◎" title={`No sets match "${query}"`} subtitle="Try a different word" />
      )}

      {!isLoading && !loadError && filtered.length > 0 && (
        <div className="pokemon-sets-grid">
          {filtered.map(set => (
            <button
              key={set.id}
              className="pokemon-set-tile"
              onClick={() => setImportingSet(set)}
            >
              {set.images?.logo
                ? <img src={set.images.logo} alt={set.name} className="pokemon-set-tile-logo" />
                : <div className="pokemon-set-tile-logo-placeholder">{set.name}</div>}
              <div className="pokemon-set-tile-name">{set.name}</div>
              <div className="pokemon-set-tile-meta">{set.total} cards</div>
            </button>
          ))}
        </div>
      )}

      {importingSet && (
        <PokemonImportModal
          set={importingSet}
          onSubmit={(payload) => { setImportingSet(null); onImportSuccess(payload); }}
          onClose={() => setImportingSet(null)}
        />
      )}
    </div>
  );
}