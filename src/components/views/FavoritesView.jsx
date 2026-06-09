// === ISSUE #38 START: Favorite Cards — FavoritesView reads from inventory ===

import { useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { getFavoriteCards } from '../../selectors/inventorySelectors.js';

/**
 * FavoritesView now reads favorites from inventory (is_favorite flag)
 * rather than from legacy binder cards.
 *
 * A card is a favorite when its USER_INVENTORY record has is_favorite = true.
 */
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
              <div className="result-info">
                <span className="result-name">★ {cardDef.name}</span>
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

// === ISSUE #38 END: Favorite Cards ===
