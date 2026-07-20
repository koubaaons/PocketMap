/**
 * @fileoverview UnorganisedTab — displays owned cards not yet in a binder.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract UnorganisedTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { MultiSelectActionBar } from './MultiSelectActionBar.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import {
  getUnorganisedCards, buildInventoryGroupMap,
  getAllInventoryIdsForCards, getRepresentativeInventoryIdsForCards,
} from '../../selectors/inventorySelectors.js';
import { getOrganisedCardDefIds } from '../../selectors/binderSelectors.js';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';
import { useBulkCardActions } from '../../hooks/useBulkCardActions.js';
import { TabToolbar } from './TabToolbar.jsx';

export function UnorganisedTab({ collectionCards, collectionTemplateFields, ownershipMap, inventory, binderSlots, binderPanels = [], showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned, onToggleFavorite, toast }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const select = useMultiSelect();
  const { handleBulkUnown, handleBulkSetFavorite, handleBulkSetDecluttered } = useBulkCardActions(toast);

  const unorganisedCards = useMemo(
    () => getUnorganisedCards(collectionCards, ownershipMap, getOrganisedCardDefIds(binderSlots, binderPanels)),
    [collectionCards, ownershipMap, binderSlots, binderPanels]
  );

  const inventoryGroupMap = useMemo(() => buildInventoryGroupMap(inventory), [inventory]);

  const filterGroups = useMemo(
    () => getFilterGroupsForCollection(unorganisedCards, collectionTemplateFields),
    [unorganisedCards, collectionTemplateFields]
  );

  const cards = useMemo(
    () => applyCardDefinitionFilters(unorganisedCards, query, sort, filters),
    [unorganisedCards, query, sort, filters]
  );

  const selectedCardIds = [...select.selectedIds];

  const bulkActions = [
    {
      label: 'Favorite',
      onClick: () => handleBulkSetFavorite(getRepresentativeInventoryIdsForCards(ownershipMap, selectedCardIds), true),
    },
    {
      label: 'Unfavorite',
      onClick: () => handleBulkSetFavorite(getRepresentativeInventoryIdsForCards(ownershipMap, selectedCardIds), false),
    },
    {
      label: 'Declutter',
      onClick: () => { handleBulkSetDecluttered(selectedCardIds, true); select.exitSelectMode(); },
    },
    {
      label: 'Unown',
      variant: 'btn-danger',
      onClick: () => handleBulkUnown(getAllInventoryIdsForCards(inventoryGroupMap, selectedCardIds)),
    },
  ];

  return (
    <div className="tab-content">
      <TabToolbar
        query={query} setQuery={setQuery} sort={sort} setSort={setSort}
        showCardInfo={showCardInfo} onToggleCardInfo={onToggleCardInfo}
        filterGroups={filterGroups} filters={filters} setFilters={setFilters}
        isSelectMode={select.isSelectMode} onToggleSelectMode={select.toggleSelectMode}
      />
      {select.isSelectMode && (
        <MultiSelectActionBar
          count={select.selectedIds.size}
          totalAvailable={cards.length}
          onSelectAll={() => select.selectAll(cards.map(c => c.id))}
          onClear={select.clearSelection}
          onExit={select.exitSelectMode}
          actions={bulkActions}
        />
      )}
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
        isSelectMode={select.isSelectMode}
        selectedIds={select.selectedIds}
        onToggleSelect={select.toggle}
      />
    </div>
  );
}

// === REFACTOR7e END ===