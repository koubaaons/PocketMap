/**
 * @fileoverview BinView — redesigned trash bin with three sections.
 *
 * Three sections:
 *   Binders    — deleted binders
 *   Collections — deleted collections
 *   Cards      — deleted card definitions
 *
 * Each item can be restored or permanently deleted.
 */

// === ISSUE #57 START: Redesigned Trash Bin ===

import { useState, useMemo } from 'react';
import { Button, EmptyState, ConfirmModal } from '../ui/index.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';

const SECTIONS = ['Binders', 'Collections', 'Cards'];

export function BinView({ bin, toast }) {
  const dispatch = useDispatch();
  const [activeSection, setActiveSection] = useState('Binders');
  const [confirmEmpty, setConfirmEmpty]   = useState(false);

  // Split bin into three sections
  const binders     = useMemo(() => bin.filter(i => i._type === 'binder'),     [bin]);
  const collections = useMemo(() => bin.filter(i => i._type === 'collection'), [bin]);
  const cards       = useMemo(() => bin.filter(i => i._type === 'cardDef'),    [bin]);

  const sectionItems = {
    Binders:     binders,
    Collections: collections,
    Cards:       cards,
  };

  const handleRestore = (item) => {
    const typeToAction = {
      binder:     ACTIONS.BIN_RESTORE_BINDER,
      collection: ACTIONS.BIN_RESTORE_COLLECTION,
      cardDef:    ACTIONS.BIN_RESTORE_CARD,
    };
    const action = typeToAction[item._type];
    if (!action) return;
    dispatch({ type: action, payload: { itemId: item.id } });
    toast(`"${item.name}" restored`);
  };

  const handlePermDelete = (item) => {
    dispatch({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: item.id } });
    toast('Deleted permanently');
  };

  const handleEmptyAll = () => {
    dispatch({ type: ACTIONS.BIN_EMPTY });
    toast('Trash emptied');
    setConfirmEmpty(false);
  };

  if (bin.length === 0) {
    return (
      <div className="view">
        <EmptyState
          icon="🗑"
          title="Trash is empty"
          subtitle="Deleted binders, collections, and cards appear here."
        />
      </div>
    );
  }

  const currentItems = sectionItems[activeSection] ?? [];

  return (
    <div className="view">

      {/* Header */}
      <div className="section-header">
        <p className="search-count">{bin.length} item{bin.length !== 1 ? 's' : ''} in trash</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)}>
          Empty All
        </Button>
      </div>

      {/* Section tabs */}
      <div className="bin-tabs">
        {SECTIONS.map(section => (
          <button
            key={section}
            className={`bin-tab ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {section}
            <span className="tab-count">{sectionItems[section].length}</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {currentItems.length === 0 ? (
        <EmptyState
          icon="○"
          title={`No deleted ${activeSection.toLowerCase()}`}
          subtitle={`Deleted ${activeSection.toLowerCase()} will appear here`}
        />
      ) : (
        <div className="bin-list">
          {currentItems.map(item => (
            <div key={item.id} className="bin-row">
              <div className="bin-info">
                <span className="bin-name">{item.name}</span>
                <span className="bin-meta">
                  Deleted {new Date(item.deletedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="bin-actions">
                <Button variant="ghost" size="sm" onClick={() => handleRestore(item)}>
                  Restore
                </Button>
                <Button variant="danger" size="sm" onClick={() => handlePermDelete(item)}>
                  Delete Forever
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Empty trash?"
          message={`This will permanently delete all ${bin.length} item${bin.length !== 1 ? 's' : ''}. This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={handleEmptyAll}
          onClose={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  );
}

// === ISSUE #57 END: Redesigned Trash Bin ===