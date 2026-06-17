/**
 * @fileoverview CardDefinitionList — grid of card definition items.
 * === ISSUE #80: displays card image in each row ===
 * === ISSUE #84: fixed column grid layout ===
 */

// === ISSUE #15 START: Card Definitions List ===
// === ISSUE #80 START: Card Images ===

import { CardDefinitionRow } from './CardDefinitionRow.jsx';
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
    <div className="card-def-list">
      {cards.map(card => {
        const inventoryItem = ownershipMap[card.id] ?? null;
        return (
          <CardDefinitionRow
            key={card.id}
            card={card}
            templateFields={templateFields}
            isOwned={inventoryItem !== null}
            isFavorite={inventoryItem?.is_favorite ?? false}
            onView={() => onView(card)}
            onEdit={() => onEdit(card)}
            onDelete={() => onDelete(card)}
          />
        );
      })}
      <p className="list-footer">
        Showing {cards.length} of {totalCount} card{totalCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// === ISSUE #80 END ===
// === ISSUE #15 END ===