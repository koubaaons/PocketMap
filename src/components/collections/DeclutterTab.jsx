/**
 * @fileoverview DeclutterTab — cards the user has hidden away via
 * decluttering. Acts as the "everything sent to declutter lives here
 * until you bring it back" section — restoring (individually via
 * select-mode, or in a batch) is the only action offered, since every
 * card here is, by definition, decluttered already.
 */

import { useState, useMemo } from 'react';
import { CardDefinitionList } from './CardDefinitionList.jsx';
import { MultiSelectActionBar } from './MultiSelectActionBar.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';
import { useBulkCardActions } from '../../hooks/useBulkCardActions.js';
import { TabToolbar } from './TabToolbar.jsx';

export function DeclutterTab({ declutteredCards, collectionTemplateFields, ownershipMap, showCardInfo, onToggleCardInfo, onView, toast }) {
  const [query, setQuery]     = useState('');
  const [sort,  setSort]      = useState('newest');
  const [filters, setFilters] = useState({});

  const select = useMultiSelect();
  const { handleBulkSetDecluttered } = useBulkCardActions(toast);

  const filterGroups = useMemo(
    () => getFilterGroupsForCollection(declutteredCards, collectionTemplateFields),
    [declutteredCards, collectionTemplateFields]
  );

  const cards = useMemo(
    () => applyCardDefinitionFilters(declutteredCards, query, sort, filters),
    [declutteredCards, query, sort, filters]
  );

  const bulkActions = [
    {
      label: 'Restore',
      variant: 'btn-primary',
      onClick: () => { handleBulkSetDecluttered([...select.selectedIds], false); select.exitSelectMode(); },
    },
  ];

  return (
    <div className="tab-content">
      <p className="declutter-tab-intro">
        Cards you've hidden away — they don't count toward your totals or
        show up in Owned/Missing/Unorganised until you restore them.
      </p>
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
        totalCount={declutteredCards.length}
        onView={onView}
        emptyTitle={query ? `No results for "${query}"` : 'Nothing decluttered'}
        emptySubtitle={query ? 'Try a different search' : 'Cards you declutter from other tabs will show up here'}
        isSelectMode={select.isSelectMode}
        selectedIds={select.selectedIds}
        onToggleSelect={select.toggle}
      />
    </div>
  );
}