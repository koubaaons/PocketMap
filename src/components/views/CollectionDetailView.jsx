/**
 * @fileoverview CollectionDetailView — collection detail with tab navigation.
 *
 * Milestone 4: Only Cards tab is implemented.
 * Other tabs are placeholders — wired in Milestone 6.
 *
 * Tab structure (final — Milestone 6):
 *   Cards | Owned | Missing | Unorganised | Settings
 *
 * TODO: Render TemplateManagementView inside Settings tab (Milestone 6)
 * Do NOT add standalone routing for TemplateManagementView.
 */

// === ISSUE #13 START: Card Definition Management — CollectionDetailView shell ===

import { useState, useMemo } from 'react';
import { Button, ConfirmModal, PlaceholderTab } from '../ui/index.jsx';
import { CardDefinitionList } from '../collections/CardDefinitionList.jsx';
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';

// === REFACTOR4a START: use useCardEditor hook ===
import { useCardEditor } from '../../hooks/useCardEditor.js';
// === REFACTOR4a END ===

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Settings'];

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'name_asc',  label: 'Name A → Z'   },
  { value: 'name_desc', label: 'Name Z → A'   },
];

export function CollectionDetailView({ collection, cardDefinitions, templateFields, toast, onBack }) {
  const [activeTab, setActiveTab] = useState('Cards');

  // === REFACTOR4a START: card editor state from hook ===
  const editor = useCardEditor();
  // === REFACTOR4a END ===

  const collectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection.id),
    [cardDefinitions, collection.id]
  );

  // === ISSUE #15: apply filter and sort ===
  const filteredCards = useMemo(
    () => applyCardDefinitionFilters(collectionCards, editor.query, editor.sortBy),
    [collectionCards, editor.query, editor.sortBy]
  );

  const { handleCreate, handleUpdate, handleDelete } = useCardDefinitionActions(toast, {
    onCreateSuccess: editor.closeCreate,
    onUpdateSuccess: editor.closeEdit,
    onDeleteSuccess: editor.closeDelete,
  });

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
          <button
            key={tab}
            className={`collection-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'Cards' && (
              <span className="tab-count">{collectionCards.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* === ISSUE #13: Cards tab === */}
      {activeTab === 'Cards' && (
        <div className="tab-content">
          <div className="card-list-toolbar">
            <div className="search-bar-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">◎</span>
              <input
                className="search-input"
                placeholder="Search cards…"
                value={editor.query}
                onChange={e => editor.setQuery(e.target.value)}
                aria-label="Search cards"
              />
              {editor.query && (
                <button className="search-clear" onClick={editor.clearQuery}>✕</button>
              )}
            </div>
            <select className="sort-select" value={editor.sortBy}
              onChange={e => editor.setSortBy(e.target.value)} aria-label="Sort cards">
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={editor.openCreate}>+ Add Card</Button>
          </div>

          <CardDefinitionList
            cards={filteredCards}
            templateFields={collectionTemplateFields}
            totalCount={collectionCards.length}
            onEdit={editor.openEdit}
            onDelete={editor.openDelete}
            emptyTitle={editor.query ? `No results for "${editor.query}"` : 'No cards yet'}
            emptySubtitle={editor.query ? 'Try a different search' : 'Add your first card to start building this collection'}
          />
        </div>
      )}

      {/* === REFACTOR4c START: PlaceholderTab for unimplemented tabs === */}
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
      {/* === REFACTOR4c END === */}

      {editor.showCreate && (
        <CardDefinitionForm
          collection={collection}
          templateFields={collectionTemplateFields}
          mode="create"
          onSubmit={handleCreate}
          onClose={editor.closeCreate}
        />
      )}

      {/* === ISSUE #16: Edit card form === */}
      {editor.editingCard && (
        <CardDefinitionForm
          collection={collection}
          templateFields={collectionTemplateFields}
          initialCard={editor.editingCard}
          mode="edit"
          onSubmit={handleUpdate}
          onClose={editor.closeEdit}
        />
      )}

      {/* Delete confirm */}
      {editor.confirmDelete && (
        <ConfirmModal
          title={`Delete "${editor.confirmDelete.name}"?`}
          message="This will permanently delete this card and remove it from any binder slots or inventory. This cannot be undone."
          confirmLabel="Delete Card"
          onConfirm={() => handleDelete(editor.confirmDelete.id, editor.confirmDelete.name)}
          onClose={editor.closeDelete}
        />
      )}

    </div>
  );
}
