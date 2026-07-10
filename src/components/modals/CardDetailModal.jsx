/**
 * @fileoverview CardDetailModal — shows a card definition with ownership info.
 * === ISSUE #80: card image displayed prominently at top ===
 */

// === ISSUE #36 START: Mark Card As Owned — CardDetailModal ===
// === ISSUE #80 START: Card Images ===

import { useState } from 'react';
import { Button, Modal, ModalActions, ConfirmModal } from '../ui/index.jsx';
import { AcquisitionForm } from '../collections/AcquisitionForm.jsx';
import { AcquisitionSummary } from '../collections/AcquisitionSummary.jsx';
import { useCardHoloPointer } from '../../hooks/useCardHoloPointer.js';

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

  // === HOLO: no ownership gate here — unlike BinderSlot, this modal
  // never greys out card.image_url based on ownership in the first
  // place (ownership only changes the status badge below), so the
  // effect just follows card.holoType directly. Only 'off' disables
  // it now — 'none' is Regular Holo, the active default (see
  // collection.types.js for the semantic change). ===
  const holoType = card.holoType ?? 'none';
  const activeHolo = holoType !== 'off' ? holoType : null;
  const { holoRef, handlePointerMoveWithTilt, handlePointerLeaveWithTilt } = useCardHoloPointer();

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
        message="This card will be moved to the trash. You can restore it from there."
        confirmLabel="Delete Card"
        onConfirm={() => { onDelete(); onClose(); }}
        onClose={() => setConfirmDelete(false)}
      />
    );
  }

  return (
    <Modal title={card.name} onClose={onClose}>

      {/* === ISSUE #80: Card image displayed prominently === */}
      {/* === ROTATION: outer wrapper stays static (provides
          perspective + is what pointer math measures against via
          getBoundingClientRect); inner .card-rotator is the element
          that actually tilts. Binder slots never get this — only the
          form preview and this detail modal do, per explicit
          decision (no flip-to-back anywhere, just a pointer-following
          3D lean, and only outside binders). === */}
      {card.image_url && (
        <div
          ref={activeHolo ? holoRef : undefined}
          className="card-detail-image-wrapper card-rotate-wrapper"
          data-holo={activeHolo ?? undefined}
          onPointerMove={activeHolo ? handlePointerMoveWithTilt : undefined}
          onPointerLeave={activeHolo ? handlePointerLeaveWithTilt : undefined}
        >
          <div className="card-rotator">
            <img
              src={card.image_url}
              alt={card.name}
              className="card-detail-image"
            />
            {/* === HOLO: same two-element structure as BinderSlot — see
                card-holo.css for why this is two real elements, not one
                implicit ::after. === */}
            {activeHolo && (
              <>
                <span className="card-holo-shine" aria-hidden="true" />
                <span className="card-holo-glare" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
      )}

      {/* Ownership status + favorite toggle */}
      <div className="card-detail-status">
        {isOwned ? (
          <span className="status-badge status-owned">✓ Owned</span>
        ) : (
          <span className="status-badge status-not-owned">Not owned</span>
        )}
        {isOwned && (
          <button
            className={`fav-toggle ${inventoryItem.is_favorite ? 'fav-active' : ''}`}
            onClick={() => onToggleFavorite(inventoryItem)}
            aria-label={inventoryItem.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {inventoryItem.is_favorite ? '★' : '☆'}
          </button>
        )}
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

      {isOwned && <AcquisitionSummary inventoryItem={inventoryItem} />}

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
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>Edit Card</Button>
          )}
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

// === ISSUE #80 END: Card Images ===
// === ISSUE #36 END: Mark Card As Owned ===