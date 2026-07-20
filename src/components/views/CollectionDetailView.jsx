/**
 * @fileoverview CollectionDetailView — collection detail with tab navigation.
 *
 * Milestone 4: Cards tab implemented.
 * Milestone 5: Ownership wired.
 * Milestone 6: All tabs wired.
 * Refactor7e: Tab content extracted into dedicated components.
 * === ISSUE: click-to-favorite star in grid — wired handleToggleFavorite
 *     (already existed for CardDetailModal) through to all tabs too ===
 */

// === ISSUE #13 START: Card Definition Management — CollectionDetailView shell ===

import { useStore } from '../../hooks/useStore.js';
import { useState, useMemo } from 'react';
import { Button, ConfirmModal, EmptyState } from '../ui/index.jsx';
import { CardDefinitionList } from '../collections/CardDefinitionList.jsx';
import { MultiSelectActionBar } from '../collections/MultiSelectActionBar.jsx';
import { CollectionDataProvider } from '../../contexts/CollectionDataContext.jsx';
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { CollectionSummary } from '../collections/CollectionSummary.jsx';
import { TabToolbar } from '../collections/TabToolbar.jsx';
import { applyCardDefinitionFilters, getFilterGroupsForCollection } from '../../selectors/cardDefinitionSelectors.js';
import {
  buildOwnershipMap, buildInventoryGroupMap, buildCollectionSummary,
  getAllInventoryIdsForCards, getRepresentativeInventoryIdsForCards,
} from '../../selectors/inventorySelectors.js';
import { getOrganisedCardDefIds } from '../../selectors/binderSelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';
import { useCardEditor } from '../../hooks/useCardEditor.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useOwnershipEditor } from '../../hooks/useOwnershipEditor.js';
import { useCardInfoToggle } from '../../hooks/useCardInfoToggle.js';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';
import { useBulkCardActions } from '../../hooks/useBulkCardActions.js';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';

// === REFACTOR7e START: import extracted tab components ===
import { OwnedTab }        from '../collections/OwnedTab.jsx';
import { MissingTab }      from '../collections/MissingTab.jsx';
import { UnorganisedTab }  from '../collections/UnorganisedTab.jsx';
import { DeclutterTab }    from '../collections/DeclutterTab.jsx';
import { SettingsTab }     from '../collections/SettingsTab.jsx';
// === REFACTOR7e END ===

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Declutter', 'Settings'];

export function CollectionDetailView({ toast, onBack }) {
  const nav             = useStore(s => s.nav);
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  const binderSlots     = useStore(s => s.binderSlots ?? []);
  const binderPanels    = useStore(s => s.binderPanels ?? []);
  const collection      = collections.find(c => c.id === nav.currentCollectionId) ?? null;
  const [activeTab, setActiveTab] = useState('Cards');

  const editor    = useCardEditor();
  const ownership = useOwnershipEditor();
  const { showCardInfo, toggle: toggleCardInfo } = useCardInfoToggle();

  const allCollectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection?.id),
    [cardDefinitions, collection?.id]
  );

  // Decluttered cards act like they don't exist everywhere except the
  // Declutter tab itself — excluding them right here at the source
  // means Owned/Missing/Unorganised, the summary, and the Cards tab
  // all inherit that automatically, with no changes needed in any of
  // those selectors.
  const collectionCards = useMemo(
    () => allCollectionCards.filter(cd => !cd.isDecluttered),
    [allCollectionCards]
  );
  const declutteredCards = useMemo(
    () => allCollectionCards.filter(cd => cd.isDecluttered),
    [allCollectionCards]
  );

  const collectionTemplateFields = templateFields.filter(f => f.collectionId === collection?.id);

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);
  const inventoryGroupMap = useMemo(() => buildInventoryGroupMap(inventory), [inventory]);

  const summary = useMemo(
    () => buildCollectionSummary(collectionCards, ownershipMap, getOrganisedCardDefIds(binderSlots, binderPanels)),
    [collectionCards, ownershipMap, binderSlots, binderPanels]
  );

  const cardFilterGroups = useMemo(
    () => getFilterGroupsForCollection(collectionCards, collectionTemplateFields),
    [collectionCards, collectionTemplateFields]
  );

  const filteredCards = useMemo(
    () => applyCardDefinitionFilters(collectionCards, editor.query, editor.sortBy, editor.filters),
    [collectionCards, editor.query, editor.sortBy, editor.filters]
  );

  const { handleCreate, handleUpdate, handleDelete } = useCardDefinitionActions(toast, {
    onCreateSuccess: editor.closeCreate,
    // === CHANGED: editing now happens inline inside CardDetailModal
    // itself (see that file), which already transitions back to its
    // own view mode after a successful save. This used to also close
    // the whole detail modal (ownership.closeDetail()) — that made
    // sense when editing opened a completely separate modal on top,
    // but now it would yank the user back to the grid the instant
    // they save, rather than letting them see the updated card. ===
    onUpdateSuccess: () => {},
    onDeleteSuccess: () => { editor.closeDelete(); ownership.closeDetail(); },
  });

  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess:   () => {},
      // === CHANGED (quantity tracking): see BinderView.jsx's
      // identical fix - removing one of several copies shouldn't
      // close the whole modal, and CardDetailModal now decides that
      // itself based on remaining quantity. ===
    });

  // === FIX (own/unown flow — quick-toggle from the grid): reused by
  // the Cards tab below AND by sharedTabProps, so Missing/Owned get
  // the same click-to-toggle circle without duplicating this logic —
  // Missing in particular is arguably the most useful place for it,
  // since it's specifically the list of cards you don't have yet.
  const handleToggleOwned = (card, inventoryItem) => {
    if (inventoryItem) {
      handleUnown(inventoryItem.id);
    } else {
      handleOwn({ cardDefId: card.id, collectionId: collection.id });
    }
  };

  // === New: multiselect for the Cards tab — a mixed set of owned and
  // unowned cards, so both "mark owned" and "unown" are offered
  // together (unlike Owned/Missing/Unorganised, which only ever need
  // one direction).
  const cardsSelect = useMultiSelect();
  const { handleBulkOwn, handleBulkUnown, handleBulkSetFavorite, handleBulkSetDecluttered } = useBulkCardActions(toast);

  const sharedTabProps = {
    collectionCards,
    collectionTemplateFields,
    collectionId: collection?.id,
    ownershipMap,
    inventory,
    toast,
    showCardInfo,
    onToggleCardInfo: toggleCardInfo,
    summary,
    onView:   ownership.openDetail,
    onEdit:   handleUpdate,
    onDelete: editor.openDelete,
    onToggleFavorite: handleToggleFavorite,
    onToggleOwned: handleToggleOwned,
  };

  // === FIX (real crash): if this collection no longer exists — e.g.
  // deleted while this view was still open/referenced, or nav state
  // pointing at a stale id after a delete — collection is null, and
  // every collection.id/name access below would throw. This can only
  // go after every hook above (Rules of Hooks: hooks must run
  // unconditionally, in the same order, every render), which is why
  // those hooks were made null-safe (collection?.id) rather than
  // just guarding here and calling it done.
  if (!collection) {
    return (
      <div className="view">
        <EmptyState
          icon="◈"
          title="Collection not found"
          subtitle="This collection may have been deleted."
          action={<Button variant="primary" onClick={onBack}>← Back to Collections</Button>}
        />
      </div>
    );
  }

  return (
    <div className="collection-detail-view">

      <div className="collection-detail-header">
        <button className="back-btn" onClick={onBack}>← Collections</button>
        <div className="collection-detail-title">
          <h2>{collection.name}</h2>
          <span className={`collection-badge ${collection.is_custom ? 'badge-custom' : 'badge-api'}`}>
            {collection.is_custom ? 'Custom' : 'API'}
          </span>
        </div>
      </div>

      <CollectionSummary stats={summary} />

      <div className="collection-tabs">
        {TABS.map(tab => {
          const count =
            tab === 'Cards'       ? summary.total       :
            tab === 'Owned'       ? summary.owned       :
            tab === 'Missing'     ? summary.missing     :
            tab === 'Unorganised' ? summary.unorganised :
            tab === 'Declutter'   ? declutteredCards.length : null;
          return (
            <button key={tab}
              className={`collection-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab}
              {count !== null && <span className="tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      <CollectionDataProvider value={{ inventory, allBinderSlots: binderSlots, allBinderPanels: binderPanels }}>
        {/* Cards tab — stays in parent since it needs editor state */}
        {activeTab === 'Cards' && (
          <div className="tab-content">
            <TabToolbar
              query={editor.query} setQuery={editor.setQuery}
              sort={editor.sortBy} setSort={editor.setSortBy}
              showAdd onAdd={editor.openCreate}
              showCardInfo={showCardInfo} onToggleCardInfo={toggleCardInfo}
              filterGroups={cardFilterGroups} filters={editor.filters} setFilters={editor.setFilters}
              isSelectMode={cardsSelect.isSelectMode} onToggleSelectMode={cardsSelect.toggleSelectMode}
            />
            {cardsSelect.isSelectMode && (() => {
              const selectedIds = [...cardsSelect.selectedIds];
              const selectedCards = filteredCards.filter(c => cardsSelect.selectedIds.has(c.id));
              const unownedSelected = selectedCards.filter(c => !ownershipMap[c.id]);
              const ownedSelectedIds = selectedCards.filter(c => ownershipMap[c.id]).map(c => c.id);
              return (
                <MultiSelectActionBar
                  count={cardsSelect.selectedIds.size}
                  totalAvailable={filteredCards.length}
                  onSelectAll={() => cardsSelect.selectAll(filteredCards.map(c => c.id))}
                  onClear={cardsSelect.clearSelection}
                  onExit={cardsSelect.exitSelectMode}
                  actions={[
                    { label: 'Mark Owned', variant: 'btn-primary', onClick: () => handleBulkOwn(unownedSelected, collection.id) },
                    { label: 'Favorite', onClick: () => handleBulkSetFavorite(getRepresentativeInventoryIdsForCards(ownershipMap, ownedSelectedIds), true) },
                    { label: 'Unfavorite', onClick: () => handleBulkSetFavorite(getRepresentativeInventoryIdsForCards(ownershipMap, ownedSelectedIds), false) },
                    { label: 'Declutter', onClick: () => { handleBulkSetDecluttered(selectedIds, true); cardsSelect.exitSelectMode(); } },
                    { label: 'Unown', variant: 'btn-danger', onClick: () => handleBulkUnown(getAllInventoryIdsForCards(inventoryGroupMap, ownedSelectedIds)) },
                  ]}
                />
              );
            })()}
            <CardDefinitionList
              cards={filteredCards}
              templateFields={collectionTemplateFields}
              ownershipMap={ownershipMap}
              totalCount={collectionCards.length}
              onView={ownership.openDetail}
              onEdit={handleUpdate}
              onDelete={editor.openDelete}
              onToggleFavorite={handleToggleFavorite}
              onToggleOwned={handleToggleOwned}
              emptyTitle={editor.query ? `No results for "${editor.query}"` : 'No cards yet'}
              emptySubtitle={editor.query ? 'Try a different search' : 'Add your first card to start building this collection'}
              isSelectMode={cardsSelect.isSelectMode}
              selectedIds={cardsSelect.selectedIds}
              onToggleSelect={cardsSelect.toggle}
            />
          </div>
        )}

        {/* === REFACTOR7e START: extracted tab components === */}
        {activeTab === 'Owned'        && <OwnedTab       {...sharedTabProps} />}
        {activeTab === 'Missing'      && <MissingTab      {...sharedTabProps} />}
        {activeTab === 'Unorganised'  && <UnorganisedTab  {...sharedTabProps} binderSlots={binderSlots} binderPanels={binderPanels} />}
        {activeTab === 'Declutter'    && (
          <DeclutterTab
            declutteredCards={declutteredCards}
            collectionTemplateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            showCardInfo={showCardInfo}
            onToggleCardInfo={toggleCardInfo}
            onView={ownership.openDetail}
            toast={toast}
          />
        )}
        {/* === REFACTOR7e END === */}
      </CollectionDataProvider>
      {activeTab === 'Settings'     && <SettingsTab     collection={collection} templateFields={templateFields} toast={toast} />}

      {/* Card detail modal */}
      {ownership.viewingCard && (
        <CardDetailModal
          card={ownership.viewingCard}
          inventoryItems={inventoryGroupMap[ownership.viewingCard.id] ?? []}
          templateFields={collectionTemplateFields}
          onOwn={() => handleOwn({ cardDefId: ownership.viewingCard.id, collectionId: collection.id })}
          onUnown={handleUnown}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={handleUpdate}
          onDelete={() => handleDelete(ownership.viewingCard.id, ownership.viewingCard.name)}
          onClose={ownership.closeDetail}
        />
      )}

      {editor.showCreate && (
        <CardDefinitionForm collection={collection} templateFields={collectionTemplateFields}
          mode="create" onSubmit={handleCreate} onClose={editor.closeCreate} />
      )}

      {editor.confirmDelete && (
        <ConfirmModal
          title={`Delete "${editor.confirmDelete.name}"?`}
          message="This will permanently delete this card and any ownership record."
          confirmLabel="Delete Card"
          onConfirm={() => handleDelete(editor.confirmDelete.id, editor.confirmDelete.name)}
          onClose={editor.closeDelete}
        />
      )}
    </div>
  );
}