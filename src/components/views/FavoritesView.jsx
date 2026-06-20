// === ISSUE #38 START: Favorite Cards — FavoritesView ===
// === ISSUE #80 START: Card Images ===
// === ISSUE #84 START: switched from row list to image-first grid ===
// === ISSUE: click-to-favorite star — un-favoriting from here removes
//     the card from this list immediately, since it filters by is_favorite ===

import { useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { CardGridItem } from '../collections/CardGridItem.jsx';
import { getFavoriteCards } from '../../selectors/inventorySelectors.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';

export function FavoritesView({ inventory, cardDefinitions, collections, toast, onNavigate }) {
  const { handleToggleFavorite } = useInventoryActions(toast);

  const favorites = useMemo(
    () => getFavoriteCards(inventory, cardDefinitions),
    [inventory, cardDefinitions]
  );

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
      <div className="card-grid">
        {favorites.map(({ inventoryItem, cardDef }) => (
          <CardGridItem
            key={inventoryItem.id}
            card={cardDef}
            inventoryItem={inventoryItem}
            onView={() => onNavigate && onNavigate('collection', cardDef.collectionId)}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

// === ISSUE #84 END ===
// === ISSUE #80 END: Card Images ===
// === ISSUE #38 END: Favorite Cards ===