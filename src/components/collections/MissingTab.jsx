/**
 * @fileoverview MissingTab — displays missing cards in a collection.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract MissingTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { getMissingCards } from '../../selectors/inventorySelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function MissingTab({ collectionCards, collectionTemplateFields, ownershipMap, showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned }) {
  const [query, setQuery] = useState('');
  const [sort,  setSort]  = useState('newest');

  const cards = useMemo(
    () => applyCardDefinitionFilters(getMissingCards(collectionCards, ownershipMap), query, sort),
    [collectionCards, ownershipMap, query, sort]
  );

  return (
    <div className="tab-content">
      <TabToolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} showCardInfo={showCardInfo} onToggleCardInfo={onToggleCardInfo} />
      <CardDefinitionList
        cards={cards}
        templateFields={collectionTemplateFields}
        ownershipMap={ownershipMap}
        totalCount={summary.missing}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleOwned={onToggleOwned}
        emptyTitle={query ? `No results for "${query}"` : 'No missing cards'}
        emptySubtitle={query ? 'Try a different search' : 'You own every card in this collection!'}
      />
    </div>
  );
}

// === REFACTOR7e END ===