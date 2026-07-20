/**
 * @fileoverview MissingTab — displays missing cards in a collection.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract MissingTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import { getMissingCards } from '../../selectors/inventorySelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function MissingTab({ collectionCards, collectionTemplateFields, ownershipMap, showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const missingCards = useMemo(
    () => getMissingCards(collectionCards, ownershipMap),
    [collectionCards, ownershipMap]
  );

  const filterGroups = useMemo(
    () => getFilterGroupsForCollection(missingCards, collectionTemplateFields),
    [missingCards, collectionTemplateFields]
  );

  const cards = useMemo(
    () => applyCardDefinitionFilters(missingCards, query, sort, filters),
    [missingCards, query, sort, filters]
  );

  return (
    <div className="tab-content">
      <TabToolbar
        query={query} setQuery={setQuery} sort={sort} setSort={setSort}
        showCardInfo={showCardInfo} onToggleCardInfo={onToggleCardInfo}
        filterGroups={filterGroups} filters={filters} setFilters={setFilters}
      />
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