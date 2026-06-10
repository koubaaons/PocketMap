/**
 * @fileoverview CollectionDetailView — collection detail with tab navigation.
 *
 * Milestone 4: Cards tab implemented.
 * Milestone 5: Ownership wired — own/unown, favorites, acquisition info.
 * Milestone 6: All tabs wired — Owned, Missing, Unorganised, Settings, Summary.
 */

// === ISSUE #13 START: Card Definition Management — CollectionDetailView shell ===

import { useState, useMemo } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { CardDefinitionList } from '../collections/CardDefinitionList.jsx';
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { applyCardDefinitionFilters, CARD_SORT_OPTIONS } from '../../selectors/cardDefinitionSelectors.js';
import {
  buildOwnershipMap,
  getOwnedCards,
  getMissingCards,
  getUnorganisedCards,
  buildCollectionSummary,
} from '../../selectors/inventorySelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';
import { useCardEditor } from '../../hooks/useCardEditor.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useOwnershipEditor } from '../../hooks/useOwnershipEditor.js';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';

// === ISSUE #47 START: Collection Summary ===
import { CollectionSummary } from '../collections/CollectionSummary.jsx';
// === ISSUE #47 END ===

// === ISSUE #48 START: Collection Settings Tab ===
import { TemplateManagementView } from './TemplateManagementView.jsx';
// === ISSUE #48 END ===

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Settings'];

export function CollectionDetailView({ collection, cardDefinitions, templateFields, inventory, toast, onBack }) {
  const [activeTab, setActiveTab] = useState('Cards');

  const editor    = useCardEditor();
  const ownership = useOwnershipEditor();

  // === ISSUE #45 START: per-tab search/sort state ===
  const [ownedQuery,        setOwnedQuery]        = useState('');
  const [ownedSort,         setOwnedSort]          = useState('newest');
  const [missingQuery,      setMissingQuery]       = useState('');
  const [missingSort,       setMissingSort]        = useState('newest');
  const [unorganisedQuery,  setUnorganisedQuery]   = useState('');
  const [unorganisedSort,   setUnorganisedSort]    = useState('newest');
  // === ISSUE #45 END ===

  const collectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection.id),
    [cardDefinitions, collection.id]
  );

  const ownershipMap = useMemo(
    () => buildOwnershipMap(inventory),
    [inventory]
  );

  // === ISSUE #47 START: collection summary stats ===
  const summary = useMemo(
    () => buildCollectionSummary(collectionCards, ownershipMap),
    [collectionCards, ownershipMap]
  );
  // === ISSUE #47 END ===

  // All Cards tab
  const filteredCards = useMemo(
    () => applyCardDefinitionFilters(collectionCards, editor.query, editor.sortBy),
    [collectionCards, editor.query, editor.sortBy]
  );

  // === ISSUE #45 START: Owned & Missing filtered slices ===
  const ownedCards = useMemo(
    () => applyCardDefinitionFilters(getOwnedCards(collectionCards, ownershipMap), ownedQuery, ownedSort),
    [collectionCards, ownershipMap, ownedQuery, ownedSort]
  );

  const missingCards = useMemo(
    () => applyCardDefinitionFilters(getMissingCards(collectionCards, ownershipMap), missingQuery, missingSort),
    [collectionCards, ownershipMap, missingQuery, missingSort]
  );
  // === ISSUE #45 END ===

  // === ISSUE #46 START: Unorganised filtered slice ===
  const unorganisedCards = useMemo(
    () => applyCardDefinitionFilters(getUnorganisedCards(collectionCards, ownershipMap), unorganisedQuery, unorganisedSort),
    [collectionCards, ownershipMap, unorganisedQuery, unorganisedSort]
  );
  // === ISSUE #46 END ===

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

  const collectionTemplateFields = templateFields.filter(f => f.collectionId === collection.id);

  // Helper — renders a toolbar with search + sort
  const renderToolbar = (query, setQuery, sort, setSort, showAdd = false) => (
    <div className="card-list-toolbar">
      <div className="search-bar-wrapper" style={{ flex: 1 }}>
        <span className="search-icon">◎</span>
        <input className="search-input" placeholder="Search cards…"
          value={query} onChange={e => setQuery(e.target.value)}
          aria-label="Search cards" />
        {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>
      <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
        {CARD_SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {showAdd && (
        <Button variant="primary" size="sm" onClick={editor.openCreate}>+ Add Card</Button>
      )}
    </div>
  );

  return (
    <div className="collection-detail-view">

      {/* Header */}
      <div className="collection-detail-header">
        <button className="back-btn" onClick={onBack}>← Collections</button>
        <div className="collection-detail-title">
          <h2>{collection.name}</h2>
          <span className={`collection-badge ${collection.is_custom ? 'badge-custom' : 'badge-api'}`}>
            {collection.is_custom ? 'Custom' : 'API'}
          </span>
        </div>
      </div>

      {/* === ISSUE #47 START: Collection summary shown on all tabs === */}
      <CollectionSummary stats={summary} />
      {/* === ISSUE #47 END === */}

      {/* Tab navigation with live counts */}
      <div className="collection-tabs">
        {TABS.map(tab => {
          // === ISSUE #45 START: tab count badges ===
          const count =
            tab === 'Cards'       ? summary.total        :
            tab === 'Owned'       ? summary.owned        :
            tab === 'Missing'     ? summary.missing      :
            tab === 'Unorganised' ? summary.unorganised  : null;
          // === ISSUE #45 END ===
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

      {/* ── Cards tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'Cards' && (
        <div className="tab-content">
          {renderToolbar(editor.query, editor.setQuery, editor.sortBy, editor.setSortBy, true)}
          <CardDefinitionList
            cards={filteredCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={collectionCards.length}
            onView={ownership.openDetail}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={editor.query ? `No results for "${editor.query}"` : 'No cards yet'}
            emptySubtitle={editor.query ? 'Try a different search' : 'Add your first card to start building this collection'}
          />
        </div>
      )}

      {/* === ISSUE #45 START: Owned tab === */}
      {activeTab === 'Owned' && (
        <div className="tab-content">
          {renderToolbar(ownedQuery, setOwnedQuery, ownedSort, setOwnedSort)}
          <CardDefinitionList
            cards={ownedCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={summary.owned}
            onView={ownership.openDetail}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={ownedQuery ? `No results for "${ownedQuery}"` : 'No owned cards yet'}
            emptySubtitle={ownedQuery ? 'Try a different search' : 'Mark cards as owned to see them here'}
          />
        </div>
      )}
      {/* === ISSUE #45 END: Owned tab === */}

      {/* === ISSUE #45 START: Missing tab === */}
      {activeTab === 'Missing' && (
        <div className="tab-content">
          {renderToolbar(missingQuery, setMissingQuery, missingSort, setMissingSort)}
          <CardDefinitionList
            cards={missingCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={summary.missing}
            onView={ownership.openDetail}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={missingQuery ? `No results for "${missingQuery}"` : 'No missing cards'}
            emptySubtitle={missingQuery ? 'Try a different search' : 'You own every card in this collection!'}
          />
        </div>
      )}
      {/* === ISSUE #45 END: Missing tab === */}

      {/* === ISSUE #46 START: Unorganised tab === */}
      {activeTab === 'Unorganised' && (
        <div className="tab-content">
          {renderToolbar(unorganisedQuery, setUnorganisedQuery, unorganisedSort, setUnorganisedSort)}
          <CardDefinitionList
            cards={unorganisedCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={summary.unorganised}
            onView={ownership.openDetail}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={unorganisedQuery ? `No results for "${unorganisedQuery}"` : 'No unorganised cards'}
            emptySubtitle={unorganisedQuery ? 'Try a different search' : 'All your owned cards are in a binder'}
          />
        </div>
      )}
      {/* === ISSUE #46 END: Unorganised tab === */}

      {/* === ISSUE #48 START: Settings tab — wire TemplateManagementView === */}
      {activeTab === 'Settings' && (
        <div className="tab-content">
          <TemplateManagementView
            collection={collection}
            templateFields={templateFields}
            toast={toast}
          />
        </div>
      )}
      {/* === ISSUE #48 END: Settings tab === */}

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

      {/* Create / Edit forms */}
      {editor.showCreate && (
        <CardDefinitionForm collection={collection} templateFields={collectionTemplateFields}
          mode="create" onSubmit={handleCreate} onClose={editor.closeCreate} />
      )}
      {editor.editingCard && (
        <CardDefinitionForm collection={collection} templateFields={collectionTemplateFields}
          initialCard={editor.editingCard} mode="edit"
          onSubmit={handleUpdate} onClose={editor.closeEdit} />
      )}

      {/* Delete confirm */}
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
