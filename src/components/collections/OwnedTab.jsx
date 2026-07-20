/**
 * @fileoverview OwnedTab — displays owned cards in a collection.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract OwnedTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import { getOwnedCards } from '../../selectors/inventorySelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function OwnedTab({ collectionCards, collectionTemplateFields, ownershipMap, showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned, onToggleFavorite }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const ownedCards = useMemo(
    () => getOwnedCards(collectionCards, ownershipMap),
    [collectionCards, ownershipMap]
  );

  const filterGroups = useMemo(
    () => getFilterGroupsForCollection(ownedCards, collectionTemplateFields),
    [ownedCards, collectionTemplateFields]
  );

  const cards = useMemo(
    () => applyCardDefinitionFilters(ownedCards, query, sort, filters),
    [ownedCards, query, sort, filters]
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
        totalCount={summary.owned}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleOwned={onToggleOwned}
        onToggleFavorite={onToggleFavorite}
        emptyTitle={query ? `No results for "${query}"` : 'No owned cards yet'}
        emptySubtitle={query ? 'Try a different search' : 'Mark cards as owned to see them here'}
      />
    </div>
  );
}

// === REFACTOR7e END ===