/**
 * @fileoverview OwnedTab — displays owned cards in a collection.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract OwnedTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { CARD_SORT_OPTIONS, applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { getOwnedCards } from '../../selectors/inventorySelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function OwnedTab({ collectionCards, collectionTemplateFields, ownershipMap, summary, onView, onEdit, onDelete, onToggleOwned }) {
  const [query, setQuery] = useState('');
  const [sort,  setSort]  = useState('newest');

  const cards = useMemo(
    () => applyCardDefinitionFilters(getOwnedCards(collectionCards, ownershipMap), query, sort),
    [collectionCards, ownershipMap, query, sort]
  );

  return (
    <div className="tab-content">
      <TabToolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
      <CardDefinitionList
        cards={cards}
        templateFields={collectionTemplateFields}
        ownershipMap={ownershipMap}
        totalCount={summary.owned}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleOwned={onToggleOwned}
        emptyTitle={query ? `No results for "${query}"` : 'No owned cards yet'}
        emptySubtitle={query ? 'Try a different search' : 'Mark cards as owned to see them here'}
      />
    </div>
  );
}

// === REFACTOR7e END ===