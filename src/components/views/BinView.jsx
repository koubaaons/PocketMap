/**
 * @fileoverview BinView — trash bin with three sections.
 *
 * === REMOVED: the "Copies" section === unowning a card used to
 * soft-delete the removed copy here, but that was reverted per
 * explicit request — unowning is trivially reversible already (click
 * the ownership circle again), so routing it through Trash/restore
 * was unnecessary friction for something that never actually needed
 * recovering. Back to the original three sections.
 */

// === ISSUE #57 START: Redesigned Trash Bin ===

import { useState, useMemo } from 'react';
import { useStore } from '../../hooks/useStore.js';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';

// === REFACTOR7d START: use useBinActions hook ===
import { useBinActions } from '../../hooks/useBinActions.js';
// === REFACTOR7d END ===

const SECTIONS = ['Binders', 'Collections', 'Cards', 'Images'];

export function BinView({ toast }) {
  const bin = useStore(s => s.bin);
  const [activeSection, setActiveSection] = useState('Binders');
  const [confirmEmpty, setConfirmEmpty]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // item to delete forever

  // === REFACTOR7d START: dispatch logic in hook ===
  const { handleRestore, handlePermDelete, handleEmptyAll } = useBinActions(toast);
  // === REFACTOR7d END ===

  const binders     = useMemo(() => bin.filter(i => i._type === 'binder'),     [bin]);
  const collections = useMemo(() => bin.filter(i => i._type === 'collection'), [bin]);
  const cards       = useMemo(() => bin.filter(i => i._type === 'cardDef'),    [bin]);
  const images      = useMemo(() => bin.filter(i => i._type === 'insert'),     [bin]);

  const sectionItems = { Binders: binders, Collections: collections, Cards: cards, Images: images };

  if (bin.length === 0) {
    return (
      <div className="view">
        <EmptyState icon="🗑" title="Trash is empty"
          subtitle="Deleted binders, collections, cards, and library images appear here." />
      </div>
    );
  }

  const currentItems = sectionItems[activeSection] ?? [];

  return (
    <div className="view">
      <div className="section-header">
        <p className="search-count">{bin.length} item{bin.length !== 1 ? 's' : ''} in trash</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)}>Empty All</Button>
      </div>

      <div className="bin-tabs">
        {SECTIONS.map(section => (
          <button key={section}
            className={`bin-tab ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}>
            {section}
            <span className="tab-count">{sectionItems[section].length}</span>
          </button>
        ))}
      </div>

      {currentItems.length === 0 ? (
        <EmptyState icon="○"
          title={`No deleted ${activeSection.toLowerCase()}`}
          subtitle={`Deleted ${activeSection.toLowerCase()} will appear here`} />
      ) : (
        <div className="bin-list">
          {currentItems.map(item => (
            <div key={item.id} className="bin-row">
              {item._type === 'insert' && item.image_url && (
                <img src={item.image_url} alt={item.name} className="bin-row-thumbnail" />
              )}
              <div className="bin-info">
                <span className="bin-name">{item.name}</span>
                <span className="bin-meta">
                  Deleted {new Date(item.deletedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="bin-actions">
                <Button variant="ghost" size="sm" onClick={() => handleRestore(item)}>Restore</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(item)}>Delete Forever</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Permanently delete "${confirmDelete.name}"?`}
          message="This cannot be undone. The item will be gone forever."
          confirmLabel="Delete Forever"
          onConfirm={() => { handlePermDelete(confirmDelete); setConfirmDelete(null); }}
          onClose={() => setConfirmDelete(null)} />
      )}

      {confirmEmpty && (
        <ConfirmModal title="Empty trash?"
          message={`This will permanently delete all ${bin.length} item${bin.length !== 1 ? 's' : ''}. This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={() => handleEmptyAll(() => setConfirmEmpty(false))}
          onClose={() => setConfirmEmpty(false)} />
      )}
    </div>
  );
}

// === ISSUE #57 END: Redesigned Trash Bin ===