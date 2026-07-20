/**
 * @fileoverview UnorganisedTab — displays owned cards not yet in a binder.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract UnorganisedTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import { getUnorganisedCards } from '../../selectors/inventorySelectors.js';
import { getOrganisedCardDefIds } from '../../selectors/binderSelectors.js';
import { TabToolbar } from './TabToolbar.jsx';

export function UnorganisedTab({ collectionCards, collectionTemplateFields, ownershipMap, binderSlots, binderPanels = [], showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned, onToggleFavorite }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const unorganisedCards = useMemo(
    () => getUnorganisedCards(collectionCards, ownershipMap, getOrganisedCardDefIds(binderSlots, binderPanels)),
    [collectionCards, ownershipMap, binderSlots, binderPanels]
  );

  const filterGroups = useMemo(
    () => getFilterGroupsForCollection(unorganisedCards, collectionTemplateFields),
    [unorganisedCards, collectionTemplateFields]
  );

  const cards = useMemo(
    () => applyCardDefinitionFilters(unorganisedCards, query, sort, filters),
    [unorganisedCards, query, sort, filters]
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
        totalCount={summary.unorganised}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleOwned={onToggleOwned}
        onToggleFavorite={onToggleFavorite}
        emptyTitle={query ? `No results for "${query}"` : 'No unorganised cards'}
        emptySubtitle={query ? 'Try a different search' : 'All your owned cards are in a binder'}
      />
    </div>
  );
}

// === REFACTOR7e END ===