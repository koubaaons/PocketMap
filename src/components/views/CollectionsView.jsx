// === ISSUE #1 START: Split Views — CollectionsView shell ===

import { useState, useMemo, useCallback } from 'react';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';
import { CreateCollectionModal, EditCollectionModal } from '../modals/index.js';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { debounce } from '../../utils/index.js';

// === ISSUE #1 END: Split Views — CollectionsView shell ===


// === ISSUE #5 START: Collections List View ===

export function CollectionsView({ collections, cardDefinitions, inventory, toast, onNavigate }) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // === ISSUE #5: Search collections — filter by name in real time ===
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(c => c.name.toLowerCase().includes(q));
  }, [collections, query]);

  // === ISSUE #5: Derived stats — never stored, always calculated ===
  const getStats = useCallback((collectionId) => {
    const total = cardDefinitions.filter(cd => cd.collectionId === collectionId).length;
    const owned = inventory.filter(inv =>
      cardDefinitions.some(cd => cd.id === inv.cardDefId && cd.collectionId === collectionId)
    ).length;
    const missing = total - owned;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    return { total, owned, missing, pct };
  }, [cardDefinitions, inventory]);

  // === ISSUE #5: Create collection ===
  const handleCreate = useCallback((payload) => {
    dispatch({ type: ACTIONS.COLLECTION_ADD, payload: payload.collection });
    if (payload.templateFields?.length) {
      dispatch({ type: ACTIONS.TEMPLATE_FIELD_BULK_ADD, payload: payload.templateFields });
    }
    if (payload.cardDefinitions?.length) {
      dispatch({ type: ACTIONS.CARD_DEFINITION_BULK_ADD, payload: payload.cardDefinitions });
    }
    toast(`Collection "${payload.collection.name}" created`);
    setShowCreate(false);
  }, [dispatch, toast]);

  // === ISSUE #5: Edit collection ===
  const handleEdit = useCallback((updated) => {
    dispatch({ type: ACTIONS.COLLECTION_UPDATE, payload: updated });
    toast('Collection updated');
    setEditingCollection(null);
  }, [dispatch, toast]);

  // === ISSUE #5: Delete collection — full cascade ===
  const handleDelete = useCallback((collectionId) => {
    dispatch({ type: ACTIONS.COLLECTION_DELETE, payload: { collectionId } });
    toast('Collection deleted');
    setConfirmDelete(null);
    setOpenMenuId(null);
  }, [dispatch, toast]);

  return (
    <div className="view">

      {/* Header */}
      <div className="section-header">
        <div>
          <p className="section-subtitle">Manage all your collections in one place.</p>
        </div>
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

      {/* Empty state */}
      {collections.length === 0 && (
        <EmptyState
          icon="◈"
          title="No collections yet"
          subtitle="Create your first collection to start tracking your cards"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create Collection</Button>}
        />
      )}

      {/* No search results */}
      {collections.length > 0 && filtered.length === 0 && (
        <EmptyState icon="◎" title={`No results for "${query}"`} subtitle="Try a different name" />
      )}

      {/* Collections list */}
      {filtered.length > 0 && (
        <div className="collections-list">
          {filtered.map(col => {
            const stats = getStats(col.id);
            return (
              <CollectionRow
                key={col.id}
                collection={col}
                stats={stats}
                menuOpen={openMenuId === col.id}
                onToggleMenu={() => setOpenMenuId(openMenuId === col.id ? null : col.id)}
                onView={() => { setOpenMenuId(null); onNavigate('collection', col.id); }}
                onEdit={() => { setOpenMenuId(null); setEditingCollection(col); }}
                onDelete={() => { setOpenMenuId(null); setConfirmDelete(col); }}
              />
            );
          })}
          <p className="list-footer">
            Showing {filtered.length} of {collections.length} collection{collections.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCollectionModal onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      {/* Edit modal */}
      {editingCollection && (
        <EditCollectionModal
          collection={editingCollection}
          onSubmit={handleEdit}
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

// === ISSUE #5: CollectionRow — one row in the list ===
function CollectionRow({ collection, stats, menuOpen, onToggleMenu, onView, onEdit, onDelete }) {
  return (
    <div className="collection-row">
      {/* Cover / icon */}
      <div className="collection-row-cover" onClick={onView}>
        {collection.cover_image_url
          ? <img src={collection.cover_image_url} alt={collection.name} className="collection-cover-img" />
          : <div className="collection-cover-placeholder">◈</div>
        }
      </div>

      {/* Info */}
      <div className="collection-row-info" onClick={onView}>
        <div className="collection-row-name">
          {collection.name}
          <span className={`collection-badge ${collection.is_custom ? 'badge-custom' : 'badge-api'}`}>
            {collection.is_custom ? 'Custom' : 'API'}
          </span>
        </div>
        {collection.import_source && (
          <div className="collection-row-source">{collection.import_source}</div>
        )}

        {/* Stats row */}
        <div className="collection-row-stats">
          <span className="cstat"><strong>{stats.total}</strong> Total</span>
          <span className="cstat cstat-owned"><strong>{stats.owned}</strong> Owned</span>
          <span className="cstat cstat-missing"><strong>{stats.missing}</strong> Missing</span>
        </div>
      </div>

      {/* Completion ring */}
      <div className="collection-row-pct" onClick={onView}>
        <CompletionRing pct={stats.pct} />
      </div>

      {/* Three-dot menu */}
      <div className="collection-row-menu">
        <button className="menu-trigger" onClick={onToggleMenu} aria-label="Collection actions">⋯</button>
        {menuOpen && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={onView}>View Cards</button>
            <button className="menu-item" onClick={onEdit}>Edit Collection</button>
            {!collection.is_custom && (
              <button className="menu-item">Update from API</button>
            )}
            <button className="menu-item menu-item-danger" onClick={onDelete}>Delete Collection</button>
          </div>
        )}
      </div>
    </div>
  );
}

// === ISSUE #5: CompletionRing — SVG progress ring ===
function CompletionRing({ pct }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-label={`${pct}% complete`}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e8627a" strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="600" fill="#e8627a">{pct}%</text>
    </svg>
  );
}

// === ISSUE #5 END: Collections List View ===