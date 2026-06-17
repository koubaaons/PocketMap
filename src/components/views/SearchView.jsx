// === ISSUE #1 START: Split Views — SearchView ===

import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { getSlotForCard } from '../../selectors/binderSelectors.js';

export function SearchView({
  cardDefinitions = [],
  collections = [],
  inventory = [],
  binders = [],
  binderSlots = [],
  toast,
  onNavigateToBinder,
}) {
  const [query, setQuery] = useState('');

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => { map[b.id] = b; });
    return map;
  }, [binders]);

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return applyCardDefinitionFilters(cardDefinitions, query, 'name_asc').slice(0, 50);
  }, [cardDefinitions, query]);

  /**
   * Returns the organisation status label for the left side of the result row.
   * - Owned + in a binder  → "Binder Name · Page X · Slot Y"
   * - Owned + no binder    → "Unorganised"
   * - Not owned            → "Not owned"
   */
  const getOrganisationStatus = (card) => {
    const isOwned = ownershipMap[card.id] !== undefined;
    if (!isOwned) return { label: 'Not owned', type: 'not-owned' };

    const slot = getSlotForCard(binderSlots, null, card.id);
    if (slot) {
      const binder = binderMap[slot.binderId];
      return {
        label: `${binder?.name ?? 'Binder'} · Page ${slot.pageNumber} · Slot ${slot.slotIndex + 1}`,
        type: 'organised',
        // Expose for future IoT feature — physical binder location
        binderId: slot.binderId,
        pageNumber: slot.pageNumber,
        slotIndex: slot.slotIndex,
      };
    }

    return { label: 'Unorganised', type: 'unorganised' };
  };

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
              const collection  = collectionMap[card.collectionId];
              const isOwned     = ownershipMap[card.id] !== undefined;
              const isFav       = ownershipMap[card.id]?.is_favorite ?? false;
              const orgStatus   = getOrganisationStatus(card);

              return (
                <div key={card.id} className="result-row">
                  <div className="result-info">
                    <span className="result-name">
                      {isFav && <span style={{ color: 'var(--favorite-color)', marginRight: 4 }}>★</span>}
                      {card.name}
                    </span>
                    <span className="result-meta">
                      {collection?.name ?? '—'}
                      {' · '}
                      <span className={`result-org-status result-org-${orgStatus.type}`}>
                        {orgStatus.type === 'organised'    && '📖 '}
                        {orgStatus.type === 'unorganised'  && '○ '}
                        {orgStatus.type === 'not-owned'    && '✕ '}
                        {orgStatus.label}
                      </span>
                    </span>
                  </div>
                  {/* Owned badge on right stays */}
                  <span className={`badge ${isOwned ? 'badge-owned' : 'badge-missing'}`}>
                    {isOwned ? 'Owned' : 'Not owned'}
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