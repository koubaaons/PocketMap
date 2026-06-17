// === ISSUE #1 START: Split Views — SearchView ===

import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';

export function SearchView({ cardDefinitions = [], collections = [], inventory = [], binders = [], binderSlots = [], toast, onNavigateToBinder }) {
  const [query, setQuery] = useState('');

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return applyCardDefinitionFilters(cardDefinitions, query, 'name_asc').slice(0, 50);
  }, [cardDefinitions, query]);

  return (
    <div className="view">
      <div className="search-bar-wrapper">
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search cards across all collections…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          aria-label="Search cards"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
        )}
      </div>

      {!query && (
        <p className="search-count" style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          Start typing to search across all {cardDefinitions.length} cards…
        </p>
      )}

      {query && results.length === 0 && (
        <EmptyState
          icon="◎"
          title={`No results for "${query}"`}
          subtitle="Try a different card name or attribute"
        />
      )}

      {results.length > 0 && (
        <>
          <p className="search-count">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          <div className="results-list">
            {results.map(card => {
              const collection = collectionMap[card.collectionId];
              const inventoryItem = ownershipMap[card.id];
              const isOwned = inventoryItem !== undefined;
              const isFav = inventoryItem?.is_favorite ?? false;
              return (
                <div key={card.id} className="result-row">
                  <div className="result-info">
                    <span className="result-name">
                      {isFav && <span style={{ color: 'var(--favorite-color)', marginRight: 4 }}>★</span>}
                      {card.name}
                    </span>
                    <span className="result-meta">
                      {collection?.name ?? '—'}
                      {isOwned && (
                        <span style={{ color: 'var(--success)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>✓ Owned</span>
                      )}
                    </span>
                  </div>
                  <span className={`badge ${isOwned ? 'badge-owned' : 'badge-missing'}`}>
                    {isOwned ? 'Owned' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// === ISSUE #1 END: Split Views — SearchView ===