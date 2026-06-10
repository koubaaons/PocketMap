/**
 * @fileoverview CardDetailModal — shows a card definition with ownership info.
 *
 * Two states:
 *   Not owned → shows "I own it" button
 *   Owned     → shows acquisition summary, favorite toggle, edit/remove options
 *
 * Moved to modals/ in Refactor5d — it is a modal, not a collection component.
 */

// === ISSUE #36 START: Mark Card As Owned — CardDetailModal ===

import { useState } from 'react';
import { Button, Modal, ModalActions, ConfirmModal } from '../ui/index.jsx';
import { AcquisitionForm } from '../collections/AcquisitionForm.jsx';

// === REFACTOR5b START: use AcquisitionSummary component ===
import { AcquisitionSummary } from '../collections/AcquisitionSummary.jsx';
// === REFACTOR5b END ===

export function CardDetailModal({
  card,
  inventoryItem,
  templateFields,
  onOwn,
  onUnown,
  onUpdateAcquisition,
  onToggleFavorite,
  onEdit,
  onDelete,
  onClose,
}) {
  const [showAcquisition, setShowAcquisition] = useState(false);
  const [confirmUnown, setConfirmUnown]       = useState(false);
  const [confirmDelete, setConfirmDelete]     = useState(false);

  const isOwned = inventoryItem !== null;

  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === card.collectionId)
    .sort((a, b) => a.order - b.order);

  if (showAcquisition && inventoryItem) {
    return (
      <AcquisitionForm
        inventoryItem={inventoryItem}
        cardName={card.name}
        onSubmit={(updated) => { onUpdateAcquisition(updated); setShowAcquisition(false); }}
        onClose={() => setShowAcquisition(false)}
      />
    );
  }

  if (confirmUnown) {
    return (
      <ConfirmModal
        title="Remove Ownership?"
        message={`Remove ownership of "${card.name}"? Your acquisition details will be lost.`}
        confirmLabel="Remove"
        onConfirm={() => { onUnown(inventoryItem.id); setConfirmUnown(false); onClose(); }}
        onClose={() => setConfirmUnown(false)}
      />
    );
  }

  if (confirmDelete) {
    return (
      <ConfirmModal
        title={`Delete "${card.name}"?`}
        message="This will permanently delete this card and any ownership record. This cannot be undone."
        confirmLabel="Delete Card"
        onConfirm={() => { onDelete(); onClose(); }}
        onClose={() => setConfirmDelete(false)}
      />
    );
  }

  return (
    <Modal title={card.name} onClose={onClose}>

      {/* Ownership status + favorite toggle */}
      <div className="card-detail-status">
        {isOwned ? (
          <span className="status-badge status-owned">✓ Owned</span>
        ) : (
          <span className="status-badge status-not-owned">Not owned</span>
        )}
        {/* === ISSUE #38 START: Favorite toggle === */}
        {isOwned && (
          <button
            className={`fav-toggle ${inventoryItem.is_favorite ? 'fav-active' : ''}`}
            onClick={() => onToggleFavorite(inventoryItem)}
            aria-label={inventoryItem.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {inventoryItem.is_favorite ? '★' : '☆'}
          </button>
        )}
        {/* === ISSUE #38 END === */}
      </div>

      {/* Card attributes from template */}
      {sortedFields.length > 0 && (
        <div className="card-detail-attrs">
          {sortedFields.map(f => {
            const val = card.attributes?.[f.field_name];
            if (val === undefined || val === null || val === '') return null;
            return (
              <div key={f.id} className="detail-field">
                <span className="detail-label">{f.field_name}</span>
                <span className="detail-value">
                  {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                </span>
              </div>
            );
          }).filter(Boolean)}
        </div>
      )}

      {/* === REFACTOR5b START: use AcquisitionSummary instead of inline === */}
      {isOwned && <AcquisitionSummary inventoryItem={inventoryItem} />}
      {/* === REFACTOR5b END === */}

      <hr className="modal-divider" />

      {/* Actions */}
      <div className="card-detail-actions">
        <div className="card-detail-actions-left">
          {!isOwned && (
            <Button variant="primary" size="sm" onClick={onOwn}>✓ I own it</Button>
          )}
          {isOwned && (
            <Button variant="ghost" size="sm" onClick={() => setShowAcquisition(true)}>
              Edit Details
            </Button>
          )}
        </div>
        <div className="card-detail-actions-right">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit Card</Button>
          {isOwned && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmUnown(true)}>
              Remove Ownership
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

    </Modal>
  );
}
