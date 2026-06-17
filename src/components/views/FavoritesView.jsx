// === ISSUE #38 START: Favorite Cards — FavoritesView ===
// === ISSUE #80 START: Card Images ===

import { useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { getFavoriteCards } from '../../selectors/inventorySelectors.js';

export function FavoritesView({ inventory, cardDefinitions, collections, toast }) {
  const favorites = useMemo(
    () => getFavoriteCards(inventory, cardDefinitions),
    [inventory, cardDefinitions]
  );

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  if (favorites.length === 0) {
    return (
      <div className="view">
        <EmptyState
          icon="★"
          title="No favorites yet"
          subtitle="Open any card you own and mark it as a favorite"
        />
      </div>
    );
  }

  return (
    <div className="view">
      <p className="search-count">
        {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
      </p>
      <div className="results-list">
        {favorites.map(({ inventoryItem, cardDef }) => {
          const collection = collectionMap[cardDef.collectionId];
          return (
            <div key={inventoryItem.id} className="result-row">

              {/* === ISSUE #80: card image on left === */}
              {cardDef.image_url ? (
                <img
                  src={cardDef.image_url}
                  alt={cardDef.name}
                  className="card-def-image"
                />
              ) : (
                <div className="card-def-image-placeholder" aria-hidden="true">🃏</div>
              )}

              <div className="result-info">
                <span className="result-name">
                  <span style={{ color: 'var(--favorite-color)', marginRight: 4 }}>★</span>
                  {cardDef.name}
                </span>
                <span className="result-meta">
                  {collection?.name ?? '—'}
                  {inventoryItem.condition_rating && (
                    <> · {inventoryItem.condition_rating.replace('_', ' ')}</>
                  )}
                </span>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

// === ISSUE #80 END: Card Images ===
// === ISSUE #38 END: Favorite Cards ===