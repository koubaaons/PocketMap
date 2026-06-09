/**
 * @fileoverview CollectionsView — orchestration only.
 *
 * Responsibilities:
 * - Search state
 * - Modal state (create, edit, delete confirm)
 * - Dispatch via useCollectionActions
 * - Compose CollectionList, EmptyState, modals
 *
 * No SVG. No row markup. No stats calculation.
 * Stats are computed once via buildCollectionStatsMap selector.
 */

// === ISSUE #1 START: Split Views — CollectionsView shell ===
// === ISSUE #5 START: Collections List View ===

import { useState, useMemo } from 'react';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';
import { CreateCollectionModal, EditCollectionModal } from '../modals/index.js';
import { CollectionList } from '../collections/CollectionList.jsx';
import { buildCollectionStatsMap } from '../../selectors/collectionStats.js';
import { useCollectionActions } from '../../hooks/useCollectionActions.js';

export function CollectionsView({ collections, cardDefinitions, inventory, toast, onNavigate }) {
  const [query, setQuery]                       = useState('');
  const [showCreate, setShowCreate]             = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [confirmDelete, setConfirmDelete]       = useState(null);
  const [openMenuId, setOpenMenuId]             = useState(null);

  // Stats computed once in a single O(n) pass — not per row
  const statsMap = useMemo(
    () => buildCollectionStatsMap(collections, cardDefinitions, inventory),
    [collections, cardDefinitions, inventory]
  );

  // Filter collections by search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(c => c.name.toLowerCase().includes(q));
  }, [collections, query]);

  // All dispatch logic lives in the hook
  const { handleCreate, handleEdit, handleDelete } = useCollectionActions(toast, {
    onCreateSuccess: () => setShowCreate(false),
    onDeleteSuccess: () => { setConfirmDelete(null); setOpenMenuId(null); },
  });

  const handleEditSuccess = (updated) => {
    handleEdit(updated);
    setEditingCollection(null);
  };

  return (
    <div className="view">

      {/* Header */}
      <div className="section-header">
        <p className="section-subtitle">Manage all your collections in one place.</p>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          + Create Collection
        </Button>
      </div>

      {/* Search bar */}
      <div className="search-bar-wrapper" style={{ marginBottom: 20 }}>
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search collections…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search collections"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
        )}
      </div>

      {/* Empty state — no collections at all */}
      {collections.length === 0 && (
        <EmptyState
          icon="◈"
          title="No collections yet"
          subtitle="Create your first collection to start tracking your cards"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create Collection</Button>}
        />
      )}

      {/* Empty state — search returned nothing */}
      {collections.length > 0 && filtered.length === 0 && (
        <EmptyState icon="◎" title={`No results for "${query}"`} subtitle="Try a different name" />
      )}

      {/* Collections list */}
      {filtered.length > 0 && (
        <>
          <CollectionList
            collections={filtered}
            statsMap={statsMap}
            openMenuId={openMenuId}
            onToggleMenu={(id) => setOpenMenuId(openMenuId === id ? null : id)}
            onView={(id) => { setOpenMenuId(null); onNavigate('collection', id); }}
            onEdit={(col) => { setOpenMenuId(null); setEditingCollection(col); }}
            onDelete={(col) => { setOpenMenuId(null); setConfirmDelete(col); }}
          />
          <p className="list-footer">
            Showing {filtered.length} of {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </p>
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCollectionModal onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      {/* Edit modal */}
      {editingCollection && (
        <EditCollectionModal
          collection={editingCollection}
          onSubmit={handleEditSuccess}
          onClose={() => setEditingCollection(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${confirmDelete.name}"?`}
          message="This will permanently delete the collection, all its template fields, card definitions, and any inventory entries. This cannot be undone."
          confirmLabel="Delete Collection"
          onConfirm={() => handleDelete(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

    </div>
  );
}