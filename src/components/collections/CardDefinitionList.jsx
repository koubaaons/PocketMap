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

export function CardDefinitionList({
  cards,
  templateFields,
  ownershipMap = {},
  totalCount,
  onView,
  onEdit,
  onDelete,
  emptyTitle = 'No cards yet',
  emptySubtitle = 'Add your first card to this collection',
}) {
  if (cards.length === 0) {
    return <EmptyState icon="🃏" title={emptyTitle} subtitle={emptySubtitle} />;
  }

  return (
    <div className="card-grid-wrapper">
      <div className="card-grid">
        {cards.map(card => {
          const inventoryItem = ownershipMap[card.id] ?? null;
          return (
            <CardGridItem
              key={card.id}
              card={card}
              isOwned={inventoryItem !== null}
              isFavorite={inventoryItem?.is_favorite ?? false}
              onView={() => onView(card)}
            />
          );
        })}
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