/**
 * @fileoverview BinView — redesigned trash bin with three sections.
 */

// === ISSUE #57 START: Redesigned Trash Bin ===

import { useState, useMemo } from 'react';
import { useStore, useDispatch } from '../../hooks/useStore.js';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';

// === REFACTOR7d START: use useBinActions hook ===
import { useBinActions } from '../../hooks/useBinActions.js';
// === REFACTOR7d END ===

const SECTIONS = ['Binders', 'Collections', 'Cards', 'Copies'];

export function BinView({ toast }) {
  const bin = useStore(s => s.bin);
  const inventory = useStore(s => s.inventory);
  const [activeSection, setActiveSection] = useState('Binders');
  const [confirmEmpty, setConfirmEmpty]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // item to delete forever

  // === REFACTOR7d START: dispatch logic in hook ===
  const { handleRestore, handlePermDelete, handleEmptyAll } = useBinActions(toast);
  // === REFACTOR7d END ===

  const binders     = useMemo(() => bin.filter(i => i._type === 'binder'),     [bin]);
  const collections = useMemo(() => bin.filter(i => i._type === 'collection'), [bin]);
  const cards       = useMemo(() => bin.filter(i => i._type === 'cardDef'),    [bin]);
  const copies      = useMemo(() => bin.filter(i => i._type === 'inventoryItem'), [bin]);

  const sectionItems = { Binders: binders, Collections: collections, Cards: cards, Copies: copies };

  if (bin.length === 0) {
    return (
      <div className="view">
        <EmptyState icon="🗑" title="Trash is empty"
          subtitle="Deleted binders, collections, cards, and removed copies appear here." />
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
          title={activeSection === 'Copies' ? 'No unowned copies' : `No deleted ${activeSection.toLowerCase()}`}
          subtitle={activeSection === 'Copies' ? 'Copies you remove ownership of will appear here' : `Deleted ${activeSection.toLowerCase()} will appear here`} />
      ) : (
        <div className="bin-list">
          {currentItems.map(item => {
            const isInventoryItem = item._type === 'inventoryItem';
            // How many OTHER copies of this same card are still
            // owned right now — extra context so it's clear this
            // isn't "the card is gone", just one physical copy.
            const remainingOwned = isInventoryItem
              ? inventory.filter(inv => inv.cardDefId === item.cardDefId).length
              : 0;

            return (
              <div key={item.id} className="bin-row">
                <div className="bin-info">
                  <span className="bin-name">{item.name ?? item.cardName}</span>
                  <span className="bin-meta">
                    {/* === Real distinction the user asked for: a fully
                        deleted card (removed from the collection
                        entirely) reads as "Deleted"; an unowned copy
                        (the card itself is still there, untouched)
                        reads as "Unowned" instead — same Trash
                        mechanism underneath, genuinely different
                        meaning, shouldn't look identical. === */}
                    {isInventoryItem ? 'Unowned' : 'Deleted'} {new Date(item.deletedAt).toLocaleDateString()}
                    {isInventoryItem && (
                      remainingOwned > 0
                        ? ` · the card itself is still in your collection (${remainingOwned} other cop${remainingOwned === 1 ? 'y' : 'ies'} still owned)`
                        : ' · the card itself is still in your collection, just not owned anymore'
                    )}
                    {isInventoryItem && item.hadPlacementRemoved && ' · was placed in a binder when removed'}
                  </span>
                </div>
                <div className="bin-actions">
                  <Button variant="ghost" size="sm" onClick={() => handleRestore(item)}>Restore</Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(item)}>Delete Forever</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Permanently delete "${confirmDelete.name ?? confirmDelete.cardName}"?`}
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