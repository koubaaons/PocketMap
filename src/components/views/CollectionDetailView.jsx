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
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';
import { CardDefinitionList } from '../collections/CardDefinitionList.jsx';
import { CardDefinitionForm } from '../collections/CardDefinitionForm.jsx';
import { applyCardDefinitionFilters } from '../../selectors/cardDefinitionSelectors.js';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';

const TABS = ['Cards', 'Owned', 'Missing', 'Unorganised', 'Settings'];

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first'  },
  { value: 'oldest',    label: 'Oldest first'  },
  { value: 'name_asc',  label: 'Name A → Z'    },
  { value: 'name_desc', label: 'Name Z → A'    },
];

export function CollectionDetailView({ collection, cardDefinitions, templateFields, toast, onBack }) {
  const [activeTab, setActiveTab] = useState('Cards');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Cards belonging to this collection
  const collectionCards = useMemo(
    () => cardDefinitions.filter(cd => cd.collectionId === collection.id),
    [cardDefinitions, collection.id]
  );


  const { handleCreate, handleUpdate, handleDelete } = useCardDefinitionActions(toast, {
    onCreateSuccess: () => setShowCreate(false),
    onUpdateSuccess: () => setEditingCard(null),
    onDeleteSuccess: () => setConfirmDelete(null),
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

      {/* === ISSUE #13: Cards tab — the only working tab in Milestone 4 === */}
      {activeTab === 'Cards' && (
        <div className="tab-content">

          {/* Toolbar */}
          <div className="card-list-toolbar">
            <div className="search-bar-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">◎</span>
              <input
                className="search-input"
                placeholder="Search cards…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search cards"
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery('')}>✕</button>
              )}
            </div>

            <select
              className="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              aria-label="Sort cards"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              + Add Card
            </Button>
          </div>

          {/* Card list — collection-agnostic, receives slice */}
          <CardDefinitionList
            cards={filteredCards}
            templateFields={collectionTemplateFields}
            totalCount={collectionCards.length}
            onEdit={(card) => setEditingCard(card)}
            onDelete={(card) => setConfirmDelete(card)}
            emptyTitle={query ? `No results for "${query}"` : 'No cards yet'}
            emptySubtitle={query ? 'Try a different search' : 'Add your first card to start building this collection'}
          />
        </div>
      )}

      {/* Placeholder tabs — implemented in Milestone 6 */}
      {activeTab === 'Owned' && (
        <div className="tab-content tab-placeholder">
          <EmptyState icon="✓" title="Owned Cards" subtitle="Coming in Milestone 6 — Ownership Tracking" />
        </div>
      )}
      {activeTab === 'Missing' && (
        <div className="tab-content tab-placeholder">
          <EmptyState icon="?" title="Missing Cards" subtitle="Coming in Milestone 6 — Ownership Tracking" />
        </div>
      )}
      {activeTab === 'Unorganised' && (
        <div className="tab-content tab-placeholder">
          <EmptyState icon="◫" title="Unorganised Cards" subtitle="Coming in Milestone 6 — Binder Integration" />
        </div>
      )}
      {activeTab === 'Settings' && (
        <div className="tab-content tab-placeholder">
          <EmptyState icon="⚙" title="Collection Settings" subtitle="Coming in Milestone 6 — includes field management" />
        </div>
      )}

      {/* === ISSUE #14: Create card form === */}
      {showCreate && (
        <CardDefinitionForm
          collection={collection}
          templateFields={collectionTemplateFields}
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}



      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This will permanently delete this card and remove it from any binder slots or inventory. This cannot be undone."
          confirmLabel="Delete Card"
          onConfirm={() => handleDelete(confirmDelete.id, confirmDelete.name)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

    </div>
  );
}

// === ISSUE #13 END: Card Definition Management — CollectionDetailView shell ===