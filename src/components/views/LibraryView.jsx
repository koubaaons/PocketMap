/**
 * @fileoverview LibraryView — manage the Michi Method image library
 * (the pool of decorative images used to fill combined binder slots).
 *
 * A brand-new sidebar destination, requested directly. Supports:
 * - Batch upload (multiple files in one go, not one at a time)
 * - Browsing everything currently in the library
 * - Multiselect + soft-delete (moves to Trash, restorable — see
 *   useBinderInsertActions.js and reducer.js's BINDER_INSERT_DELETE
 *   for why this isn't a hard delete)
 *
 * The OTHER place these images get used — dragging one onto a freshly
 * combined binder panel — is InsertLibraryPanel.jsx, a floating
 * version of this same library shown only in Combine Mode. This page
 * is for managing the library itself; that panel is for using it.
 */

import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../hooks/useStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button, EmptyState } from '../ui/index.jsx';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';
import { useBinderInsertActions } from '../../hooks/useBinderInsertActions.js';

export function LibraryView({ toast }) {
  const binderInserts = useStore(s => s.binderInserts ?? []);
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const select = useMultiSelect();
  const { handleBulkAddInserts, handleBulkDeleteInserts } = useBinderInsertActions(toast, user?.id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return binderInserts;
    return binderInserts.filter(i => i.name.toLowerCase().includes(q));
  }, [binderInserts, query]);

  const handleFilesSelected = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      await handleBulkAddInserts(files);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // allow re-selecting the same file(s) later
    }
  };

  return (
    <div className="view">
      <div className="section-header">
        <div>
          <h2>Library</h2>
          <p className="section-subtitle">
            Decorative images for combined binder slots (Michi Method) — not cards, no ownership.
          </p>
        </div>
        <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? 'Uploading…' : '+ Add Images'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesSelected}
        />
      </div>

      {binderInserts.length > 0 && (
        <div className="search-bar-wrapper" style={{ marginBottom: 16 }}>
          <span className="search-icon">◎</span>
          <input
            className="search-input"
            placeholder="Search library…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search library images"
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
          )}
        </div>
      )}

      {binderInserts.length > 0 && (
        <div className="pokemon-sets-toolbar">
          <Button
            variant={select.isSelectMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={select.toggleSelectMode}
            className="pokemon-sets-select-btn"
          >
            {select.isSelectMode ? 'Cancel Select' : 'Select'}
          </Button>
        </div>
      )}

      {select.isSelectMode && (
        <div className="multiselect-bar">
          <span className="multiselect-count">{select.selectedIds.size} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={() => select.selectAll(filtered.map(i => i.id))}>
            Select all {filtered.length}
          </button>
          {select.selectedIds.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={select.clearSelection}>Clear</button>
          )}
          <div className="multiselect-actions">
            <button
              className="btn btn-danger btn-sm"
              disabled={select.selectedIds.size === 0}
              onClick={() => { handleBulkDeleteInserts([...select.selectedIds]); select.exitSelectMode(); }}
            >
              Delete
            </button>
          </div>
          <button className="btn btn-ghost btn-sm multiselect-done" onClick={select.exitSelectMode}>Done</button>
        </div>
      )}

      {binderInserts.length === 0 && (
        <EmptyState
          icon="🖼"
          title="Your library is empty"
          subtitle="Add images here to use them when combining slots in a binder (Michi Method)"
        />
      )}

      {binderInserts.length > 0 && filtered.length === 0 && (
        <EmptyState icon="◎" title={`No images match "${query}"`} subtitle="Try a different word" />
      )}

      {filtered.length > 0 && (
        <div className="pokemon-sets-grid">
          {filtered.map(insert => {
            const isSelected = select.selectedIds.has(insert.id);
            return (
              <button
                key={insert.id}
                className={`pokemon-set-tile ${select.isSelectMode ? 'pokemon-set-tile-select-mode' : ''} ${isSelected ? 'pokemon-set-tile-selected' : ''}`}
                onClick={() => select.isSelectMode && select.toggle(insert.id)}
              >
                {select.isSelectMode && (
                  <span className={`pokemon-set-tile-checkbox ${isSelected ? 'pokemon-set-tile-checkbox-checked' : ''}`} aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                )}
                <img src={insert.image_url} alt={insert.name} className="pokemon-set-tile-logo" />
                <div className="pokemon-set-tile-name">{insert.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}