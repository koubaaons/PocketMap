/**
 * @fileoverview CardDefinitionList — grid of card definition items.
 * === ISSUE #80: displays card image in each row ===
 * === ISSUE #84: fixed column grid layout, using shared CardGridItem ===
 */

// === ISSUE #15 START: Card Definitions List ===
// === ISSUE #80 START: Card Images ===
// === ISSUE #84 START: switched from row list to image-first grid ===

import { CardGridItem } from './CardGridItem.jsx';
import { EmptyState } from '../ui/index.jsx';
import { buildInventoryGroupMap, getQuantityOwned } from '../../selectors/inventorySelectors.js';
import { getTotalPlacedCount } from '../../selectors/binderSelectors.js';
import { useCollectionData } from '../../contexts/CollectionDataContext.jsx';

export function CardDefinitionList({
  cards,
  templateFields,
  ownershipMap = {},
  totalCount,
  onView,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleOwned,
  emptyTitle = 'No cards yet',
  emptySubtitle = 'Add your first card to this collection',
}) {
  const { inventory, allBinderSlots, allBinderPanels } = useCollectionData();

  if (cards.length === 0) {
    return <EmptyState icon="🃏" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  // === Quantity tracking: computed once here rather than inside
  // CardGridItem, since CardGridItem is a plain, dumb tile component
  // reused in several places — keeping this calculation at the list
  // level means CardGridItem itself doesn't need to know about
  // binder slots/panels at all. ===
  const inventoryGroupMap = buildInventoryGroupMap(inventory);

  return (
    <div className="card-grid-wrapper">
      <div className="card-grid">
        {cards.map(card => (
          <CardGridItem
            key={card.id}
            card={card}
            inventoryItem={ownershipMap[card.id] ?? null}
            quantityOwned={getQuantityOwned(inventoryGroupMap, card.id)}
            totalPlaced={getTotalPlacedCount(allBinderSlots, allBinderPanels, card.id)}
            onView={() => onView(card)}
            onToggleFavorite={onToggleFavorite}
            onToggleOwned={onToggleOwned}
          />
        ))}
      </div>
      <p className="list-footer">
        Showing {cards.length} of {totalCount} card{totalCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// === ISSUE #84 END ===
// === ISSUE #80 END ===
// === ISSUE #15 END ===