/**
 * @fileoverview CardDefinitionList — collection-agnostic card list.
 * Receives a pre-filtered, pre-sorted slice. No assumptions about full array.
 */

// === ISSUE #15 START: Card Definitions List — CardDefinitionList ===

import { CardDefinitionRow } from './CardDefinitionRow.jsx';
import { EmptyState } from '../ui/index.jsx';

/**
 * @param {{
 *   cards: object[],
 *   templateFields: object[],
 *   ownershipMap: Record<string, object>,   — cardDefId → inventoryItem
 *   totalCount: number,
 *   onView: (card) => void,
 *   onEdit: (card) => void,
 *   onDelete: (card) => void,
 *   emptyTitle?: string,
 *   emptySubtitle?: string,
 * }} props
 */
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
