// === ISSUE #38 START: Favorite Cards — FavoritesView ===
// === ISSUE #80 START: Card Images ===
// === ISSUE #84 START: switched from row list to image-first grid ===
// === ISSUE #85 START: Favorites View Polish — sort + collection filter ===
//   Two separate controls: sortBy (Recently Added / Name) reorders the
//   list; collectionFilter ('all' or a collectionId) narrows it down to
//   one collection's favorites. Filter is applied before sort.

import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { CardGridItem } from '../collections/CardGridItem.jsx';
import {
  getFavoriteCards,
  sortFavoriteCards,
  getFavoriteCollectionOptions,
  FAVORITES_SORT_OPTIONS,
} from '../../selectors/inventorySelectors.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';

export function FavoritesView({ inventory, cardDefinitions, collections, toast, onNavigate }) {
  const { handleToggleFavorite } = useInventoryActions(toast);
  const [sortBy, setSortBy] = useState('recent');
  const [collectionFilter, setCollectionFilter] = useState('all');

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  const allFavorites = useMemo(
    () => getFavoriteCards(inventory, cardDefinitions),
    [inventory, cardDefinitions]
  );

  const collectionOptions = useMemo(
    () => getFavoriteCollectionOptions(allFavorites, collectionMap),
    [allFavorites, collectionMap]
  );

  const favorites = useMemo(() => {
    const filtered = collectionFilter === 'all'
      ? allFavorites
      : allFavorites.filter(({ cardDef }) => cardDef.collectionId === collectionFilter);
    return sortFavoriteCards(filtered, sortBy);
  }, [allFavorites, collectionFilter, sortBy]);

  if (allFavorites.length === 0) {
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
      <div className="favorites-toolbar">
        <p className="search-count">
          {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
        </p>
        <div className="favorites-toolbar-controls">
          <select
            className="sort-select"
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            aria-label="Filter by collection"
          >
            <option value="all">All Collections</option>
            {collectionOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name} ({opt.count})</option>
            ))}
          </select>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort favorites"
          >
            {FAVORITES_SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon="★"
          title="No favorites in this collection"
          subtitle="Try a different collection filter"
        />
      ) : (
        <div className="card-grid">
          {favorites.map(({ inventoryItem, cardDef }) => (
            <CardGridItem
              key={inventoryItem.id}
              card={cardDef}
              inventoryItem={inventoryItem}
              collectionName={collectionMap[cardDef.collectionId]?.name ?? null}
              onView={() => onNavigate && onNavigate('collection', cardDef.collectionId)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// === ISSUE #85 END ===
// === ISSUE #84 END ===
// === ISSUE #80 END: Card Images ===
// === ISSUE #38 END: Favorite Cards ===