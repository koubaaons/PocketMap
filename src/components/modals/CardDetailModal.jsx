/**
 * @fileoverview CardDetailModal — shows a card definition with ownership info.
 *
 * Two states:
 *   Not owned → shows "I own it" button
 *   Owned     → shows acquisition details, favorite toggle, "Remove ownership"
 *
 * When not owned, clicking "I own it" creates an inventory entry.
 * When owned, user can edit acquisition info or remove ownership.
 */
import { useState } from 'react';
import { Button, Modal, ModalActions, ConfirmModal } from '../ui/index.jsx';
import { AcquisitionForm } from './AcquisitionForm.jsx';

/**
 * @param {{
 *   card: object,                    — card definition
 *   inventoryItem: object | null,    — null if not owned
 *   templateFields: object[],
 *   onOwn: () => void,
 *   onUnown: (inventoryId) => void,
 *   onUpdateAcquisition: (item) => void,
 *   onToggleFavorite: (item) => void,
 *   onEdit: () => void,
 *   onDelete: () => void,
 *   onClose: () => void,
 * }} props
 */
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
  const [confirmUnown, setConfirmUnown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        message="This will permanently delete this card definition and any ownership record. This cannot be undone."
        confirmLabel="Delete Card"
        onConfirm={() => { onDelete(); onClose(); }}
        onClose={() => setConfirmDelete(false)}
      />
    );
  }

  return (
    <Modal title={card.name} onClose={onClose}>

      {/* Ownership status badge */}
      <div className="card-detail-status">
        {isOwned ? (
          <span className="status-badge status-owned">✓ Owned</span>
        ) : (
          <span className="status-badge status-not-owned">Not owned</span>
        )}
        {/* === ISSUE #38 START: Favorite indicator === */}
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
      {isOwned && (
        <div className="acquisition-summary">
          {inventoryItem.condition_rating && (
            <div className="detail-field">
              <span className="detail-label">Condition</span>
              <span className="detail-value">{inventoryItem.condition_rating.replace('_', ' ')}</span>
            </div>
          )}
          {inventoryItem.acquired_at && (
            <div className="detail-field">
              <span className="detail-label">Acquired</span>
              <span className="detail-value">
                {new Date(inventoryItem.acquired_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {inventoryItem.personal_notes && (
            <div className="detail-field">
              <span className="detail-label">Notes</span>
              <span className="detail-value">{inventoryItem.personal_notes}</span>
            </div>
          )}
          {(inventoryItem.is_tradeable || inventoryItem.is_sellable) && (
            <div className="detail-field">
              <span className="detail-label">Available</span>
              <span className="detail-value">
                {[
                  inventoryItem.is_tradeable && 'Trade',
                  inventoryItem.is_sellable && 'Sale',
                ].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      <hr className="modal-divider" />

      {/* Actions */}
      <div className="card-detail-actions">
        <div className="card-detail-actions-left">
          {!isOwned && (
            <Button variant="primary" size="sm" onClick={onOwn}>
              ✓ I own it
            </Button>
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
