/**
 * @fileoverview CardDefinitionList — collection-agnostic card list.
 *
 * Receives a SLICE of cards (pre-filtered and sorted by the parent).
 * Does not assume the full array is in memory.
 * This makes it trivial to add react-virtuoso later if needed.
 *
 * Reusable across:
 *   - All Cards tab
 *   - Owned tab (Milestone 6)
 *   - Missing tab (Milestone 6)
 *   - Unorganised tab (Milestone 6)
 */

// === ISSUE #15 START: Card Definitions List — CardDefinitionList ===

import { CardDefinitionRow } from './CardDefinitionRow.jsx';
import { EmptyState } from '../ui/index.jsx';

/**
 * @param {{
 *   cards: object[],           — pre-filtered, pre-sorted slice
 *   templateFields: object[],  — for rendering attribute previews
 *   totalCount: number,        — total before filtering (for footer)
 *   onEdit: (card) => void,
 *   onDelete: (card) => void,
 *   emptyTitle?: string,
 *   emptySubtitle?: string,
 * }} props
 */
export function CardDefinitionList({
  cards,
  templateFields,
  totalCount,
  onEdit,
  onDelete,
  emptyTitle = 'No cards yet',
  emptySubtitle = 'Add your first card to this collection',
}) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon="🃏"
        title={emptyTitle}
        subtitle={emptySubtitle}
      />
    );
  }

  return (
    <div className="card-def-list">
      {cards.map(card => (
        <CardDefinitionRow
          key={card.id}
          card={card}
          templateFields={templateFields}
          onEdit={() => onEdit(card)}
          onDelete={() => onDelete(card)}
        />
      ))}
      <p className="list-footer">
        Showing {cards.length} of {totalCount} card{totalCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// === ISSUE #15 END: Card Definitions List — CardDefinitionList ===