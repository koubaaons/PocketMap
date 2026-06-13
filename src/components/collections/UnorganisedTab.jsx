/**
 * @fileoverview UnorganisedTab — displays owned cards not yet in a binder.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract UnorganisedTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { getUnorganisedCards } from '../../selectors/inventorySelectors.js';
import { getOrganisedCardDefIds } from '../../selectors/binderSelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function UnorganisedTab({ collectionCards, collectionTemplateFields, ownershipMap, binderSlots, summary, onView, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [sort,  setSort]  = useState('newest');

  const cards = useMemo(
    () => applyCardDefinitionFilters(
      getUnorganisedCards(collectionCards, ownershipMap, getOrganisedCardDefIds(binderSlots)),
      query,
      sort
    ),
    [collectionCards, ownershipMap, binderSlots, query, sort]
  );

  return (
    <div className="tab-content">
      <TabToolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
      <CardDefinitionList
        cards={cards}
        templateFields={collectionTemplateFields}
        ownershipMap={ownershipMap}
        totalCount={summary.unorganised}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyTitle={query ? `No results for "${query}"` : 'No unorganised cards'}
        emptySubtitle={query ? 'Try a different search' : 'All your owned cards are in a binder'}
      />
    </div>
  );
}

// === REFACTOR7e END ===