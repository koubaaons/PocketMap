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
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { CollectionSummary } from '../collections/CollectionSummary.jsx';
import { TabToolbar } from '../collections/TabToolbar.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { buildOwnershipMap, buildCollectionSummary } from '../../selectors/inventorySelectors.js';
import { getOrganisedCardDefIds } from '../../selectors/binderSelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';
import { useCardEditor } from '../../hooks/useCardEditor.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useOwnershipEditor } from '../../hooks/useOwnershipEditor.js';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';

// === REFACTOR7e START: import extracted tab components ===
import { OwnedTab }        from '../collections/OwnedTab.jsx';
import { MissingTab }      from '../collections/MissingTab.jsx';
import { UnorganisedTab }  from '../collections/UnorganisedTab.jsx';
import { SettingsTab }     from '../collections/SettingsTab.jsx';
// === REFACTOR7e END ===

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Settings'];

export function CollectionDetailView({ toast, onBack }) {
  const nav             = useStore(s => s.nav);
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  const binderSlots     = useStore(s => s.binderSlots ?? []);
  const collection      = collections.find(c => c.id === nav.currentCollectionId) ?? null;
  const [activeTab, setActiveTab] = useState('Cards');

  const editor    = useCardEditor();
  const ownership = useOwnershipEditor();

  const collectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection?.id),
    [cardDefinitions, collection?.id]
  );

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const summary = useMemo(
    () => buildCollectionSummary(collectionCards, ownershipMap, getOrganisedCardDefIds(binderSlots)),
    [collectionCards, ownershipMap, binderSlots]
  );

  const filteredCards = useMemo(
    () => applyCardDefinitionFilters(collectionCards, editor.query, editor.sortBy),
    [collectionCards, editor.query, editor.sortBy]
  );

  const { handleCreate, handleUpdate, handleDelete } = useCardDefinitionActions(toast, {
    onCreateSuccess: editor.closeCreate,
    onUpdateSuccess: () => { editor.closeEdit(); ownership.closeDetail(); },
    onDeleteSuccess: () => { editor.closeDelete(); ownership.closeDetail(); },
  });

  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess:   () => {},
      onUnownSuccess: ownership.closeDetail,
    });

  const collectionTemplateFields = templateFields.filter(f => f.collectionId === collection?.id);

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

  const sharedTabProps = {
    collectionCards,
    collectionTemplateFields,
    ownershipMap,
    summary,
    onView:   ownership.openDetail,
    onEdit:   editor.openEdit,
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
            tab === 'Unorganised' ? summary.unorganised : null;
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

      {/* Cards tab — stays in parent since it needs editor state */}
      {activeTab === 'Cards' && (
        <div className="tab-content">
          <TabToolbar
            query={editor.query} setQuery={editor.setQuery}
            sort={editor.sortBy} setSort={editor.setSortBy}
            showAdd onAdd={editor.openCreate}
          />
          <CardDefinitionList
            cards={filteredCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={collectionCards.length}
            onView={ownership.openDetail}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            onToggleFavorite={handleToggleFavorite}
            onToggleOwned={handleToggleOwned}
            emptyTitle={editor.query ? `No results for "${editor.query}"` : 'No cards yet'}
            emptySubtitle={editor.query ? 'Try a different search' : 'Add your first card to start building this collection'}
          />
        </div>
      )}

      {/* === REFACTOR7e START: extracted tab components === */}
      {activeTab === 'Owned'        && <OwnedTab       {...sharedTabProps} />}
      {activeTab === 'Missing'      && <MissingTab      {...sharedTabProps} />}
      {activeTab === 'Unorganised'  && <UnorganisedTab  {...sharedTabProps} binderSlots={binderSlots} />}
      {activeTab === 'Settings'     && <SettingsTab     collection={collection} templateFields={templateFields} toast={toast} />}
      {/* === REFACTOR7e END === */}

      {/* Card detail modal */}
      {ownership.viewingCard && (
        <CardDetailModal
          card={ownership.viewingCard}
          inventoryItem={ownershipMap[ownership.viewingCard.id] ?? null}
          templateFields={collectionTemplateFields}
          onOwn={() => handleOwn({ cardDefId: ownership.viewingCard.id, collectionId: collection.id })}
          onUnown={handleUnown}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={() => { ownership.closeDetail(); editor.openEdit(ownership.viewingCard); }}
          onDelete={() => handleDelete(ownership.viewingCard.id, ownership.viewingCard.name)}
          onClose={ownership.closeDetail}
        />
      )}

      {editor.showCreate && (
        <CardDefinitionForm collection={collection} templateFields={collectionTemplateFields}
          mode="create" onSubmit={handleCreate} onClose={editor.closeCreate} />
      )}
      {editor.editingCard && (
        <CardDefinitionForm collection={collection} templateFields={collectionTemplateFields}
          initialCard={editor.editingCard} mode="edit"
          onSubmit={handleUpdate} onClose={editor.closeEdit} />
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