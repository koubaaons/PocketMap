/**
 * @fileoverview MissingTab — displays missing cards in a collection.
 * Extracted from CollectionDetailView in Refactor7e.
 */

// === REFACTOR7e START: Extract MissingTab component ===

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { MultiSelectActionBar } from './MultiSelectActionBar.jsx';
import { ConfirmModal } from '../ui/index.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import { getMissingCards } from '../../selectors/inventorySelectors.js';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';
import { useBulkCardActions } from '../../hooks/useBulkCardActions.js';
import { useDeclutterConfirm } from '../../hooks/useDeclutterConfirm.js';
import { TabToolbar } from './TabToolbar.jsx';

export function MissingTab({ collectionCards, collectionTemplateFields, collectionId, ownershipMap, binderSlots, binderPanels, showCardInfo, onToggleCardInfo, summary, onView, onEdit, onDelete, onToggleOwned, toast }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const select = useMultiSelect();
  const { handleBulkOwn, handleBulkSetDecluttered } = useBulkCardActions(toast);
  const declutterConfirm = useDeclutterConfirm({
    binderSlots, binderPanels,
    onDeclutter: (ids) => { handleBulkSetDecluttered(ids, true); select.exitSelectMode(); },
  });

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

  const selectedCardIds = [...select.selectedIds];
  const selectedCards = cards.filter(c => select.selectedIds.has(c.id));

  const bulkActions = [
    {
      label: 'Mark Owned',
      variant: 'btn-primary',
      onClick: () => { handleBulkOwn(selectedCards, collectionId); select.exitSelectMode(); },
    },
    {
      label: 'Declutter',
      onClick: () => declutterConfirm.requestDeclutter(selectedCardIds),
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
        totalCount={summary.missing}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleOwned={onToggleOwned}
        emptyTitle={query ? `No results for "${query}"` : 'No missing cards'}
        emptySubtitle={query ? 'Try a different search' : 'You own every card in this collection!'}
        isSelectMode={select.isSelectMode}
        selectedIds={select.selectedIds}
        onToggleSelect={select.toggle}
      />
      {declutterConfirm.pendingIds && (
        <ConfirmModal
          title="Remove from binders?"
          message={`${declutterConfirm.pendingIds.length} of the selected card${declutterConfirm.pendingIds.length !== 1 ? 's are' : ' is'} placed in a binder. Decluttering will remove ${declutterConfirm.pendingIds.length !== 1 ? 'them' : 'it'} from the binder as well. This can't be undone automatically — you'd need to place it again after restoring.`}
          confirmLabel="Declutter"
          onConfirm={declutterConfirm.confirmDeclutter}
          onClose={declutterConfirm.cancelDeclutter}
        />
      )}
    </div>
  );
}

// === REFACTOR7e END ===