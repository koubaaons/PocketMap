/**
 * @fileoverview CollectionDetailView — collection detail with tab navigation.
 *
 * Milestone 4: Cards tab implemented.
 * Milestone 5: Ownership wired — own/unown, favorites, acquisition info.
 * Other tabs are placeholders — wired in Milestone 6.
 *
 * TODO: Render TemplateManagementView inside Settings tab (Milestone 6)
 */
import { useState, useMemo } from 'react';
import { Button, ConfirmModal, PlaceholderTab } from '../ui/index.jsx';
import { CardDefinitionList } from '../collections/CardDefinitionList.jsx';
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { CardDetailModal } from '../collections/CardDetailModal.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';
import { useCardEditor } from '../../hooks/useCardEditor.js';

// === ISSUE #36 START: Mark Card As Owned — import inventory actions ===
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
// === ISSUE #36 END ===

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Settings'];

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'name_asc',  label: 'Name A → Z'   },
  { value: 'name_desc', label: 'Name Z → A'   },
];

export function CollectionDetailView({ collection, cardDefinitions, templateFields, inventory, toast, onBack }) {
  const [activeTab, setActiveTab] = useState('Cards');
  const [viewingCard, setViewingCard] = useState(null);

  const editor = useCardEditor();

  const collectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection.id),
    [cardDefinitions, collection.id]
  );

  const filteredCards = useMemo(
    () => applyCardDefinitionFilters(collectionCards, editor.query, editor.sortBy),
    [collectionCards, editor.query, editor.sortBy]
  );

  // === ISSUE #36 START: build ownership map for O(1) lookups ===
  const ownershipMap = useMemo(
    () => buildOwnershipMap(inventory),
    [inventory]
  );
  // === ISSUE #36 END ===

  const { handleCreate, handleUpdate, handleDelete } = useCardDefinitionActions(toast, {
    onCreateSuccess: editor.closeCreate,
    onUpdateSuccess: () => { editor.closeEdit(); setViewingCard(null); },
    onDeleteSuccess: () => { editor.closeDelete(); setViewingCard(null); },
  });

  // === ISSUE #36 START: inventory actions ===
  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess: () => {},
      onUnownSuccess: () => setViewingCard(null),
    });
  // === ISSUE #36 END ===

  const collectionTemplateFields = templateFields.filter(f => f.collectionId === collection.id);

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

      {/* Tab navigation */}
      <div className="collection-tabs">
        {TABS.map(tab => (
          <button key={tab}
            className={`collection-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab}
            {tab === 'Cards' && <span className="tab-count">{collectionCards.length}</span>}
          </button>
        ))}
      </div>

      {/* Cards tab */}
      {activeTab === 'Cards' && (
        <div className="tab-content">
          <div className="card-list-toolbar">
            <div className="search-bar-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">◎</span>
              <input className="search-input" placeholder="Search cards…"
                value={editor.query} onChange={e => editor.setQuery(e.target.value)}
                aria-label="Search cards" />
              {editor.query && (
                <button className="search-clear" onClick={editor.clearQuery}>✕</button>
              )}
            </div>
            <select className="sort-select" value={editor.sortBy}
              onChange={e => editor.setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={editor.openCreate}>+ Add Card</Button>
          </div>

          <CardDefinitionList
            cards={filteredCards}
            templateFields={collectionTemplateFields}
            ownershipMap={ownershipMap}
            totalCount={collectionCards.length}
            onView={setViewingCard}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={editor.query ? `No results for "${editor.query}"` : 'No cards yet'}
            emptySubtitle={editor.query ? 'Try a different search' : 'Add your first card to start building this collection'}
          />
        </div>
      )}

      {/* Placeholder tabs */}
      {activeTab === 'Owned' && (
        <PlaceholderTab icon="✓" title="Owned Cards" milestone="Milestone 6 — Ownership Tracking" />
      )}
      {activeTab === 'Missing' && (
        <PlaceholderTab icon="?" title="Missing Cards" milestone="Milestone 6 — Ownership Tracking" />
      )}
      {activeTab === 'Unorganised' && (
        <PlaceholderTab icon="◫" title="Unorganised Cards" milestone="Milestone 6 — Binder Integration" />
      )}
      {activeTab === 'Settings' && (
        <PlaceholderTab icon="⚙" title="Collection Settings" milestone="Milestone 6 — includes field management" />
      )}

      {/* === ISSUE #36 START: Card detail modal with ownership === */}
      {viewingCard && (
        <CardDetailModal
          card={viewingCard}
          inventoryItem={ownershipMap[viewingCard.id] ?? null}
          templateFields={collectionTemplateFields}
          onOwn={() => handleOwn({ cardDefId: viewingCard.id, collectionId: collection.id })}
          onUnown={(inventoryId) => handleUnown(inventoryId)}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={() => { setViewingCard(null); editor.openEdit(viewingCard); }}
          onDelete={() => handleDelete(viewingCard.id, viewingCard.name)}
          onClose={() => setViewingCard(null)}
        />
      )}
      {/* === ISSUE #36 END === */}

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

