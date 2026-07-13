/**
 * @fileoverview CardDetailModal — shows a card definition with ownership info.
 *
 * Two-part layout: the card image floats freely on its own (no box or
 * background behind it, just its own shadow, like a real card sitting
 * on a table), with a separate boxed panel beside it holding the
 * name, favorite star, ownership status, attributes, and actions.
 *
 * Doesn't use the shared Modal component, since Modal wraps everything
 * in a single boxed panel with a header — this needs two independent
 * visual pieces instead. Replicates Modal's own overlay/escape-key/
 * focus-trap/click-outside behavior directly so it still behaves like
 * every other modal in the app.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
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
  const [isDetailsOpen, setIsDetailsOpen]     = useState(false);

  const isOwned = inventoryItem !== null;

  const holoType = card.holoType ?? 'none';
  const activeHolo = holoType !== 'off' ? holoType : null;
  const { holoRef, handlePointerMoveWithTilt, handlePointerLeaveWithTilt } = useCardHoloPointer();

  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === card.collectionId)
    .sort((a, b) => a.order - b.order);

  // Same overlay/escape-key/focus-trap behavior as the shared Modal
  // component (see ui/index.jsx) — replicated here since this needs
  // a custom two-part layout instead of Modal's single boxed panel.
  const firstFocusRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    firstFocusRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

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
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
    >
      <div className={`card-detail-group ${isDetailsOpen ? 'card-detail-group-open' : ''}`} ref={firstFocusRef} tabIndex={-1}>

        {/* Card image — floats freely, no box or background behind
            it at all, just its own drop shadow. */}
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
              {activeHolo && (
                <>
                  <span className="card-holo-shine" aria-hidden="true" />
                  <span className="card-holo-glare" aria-hidden="true" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Close button — always visible regardless of details state,
            floating just above the card. */}
        <Button variant="icon" size="sm" onClick={onClose} title="Close" className="card-detail-close-btn">✕</Button>

        {/* "Show details" — sits to the card's LEFT while closed,
            same glass-pill style as the binder's Customize button. */}
        {!isDetailsOpen && (
          <button
            className="card-detail-show-btn"
            onClick={() => setIsDetailsOpen(true)}
          >
            Show details
          </button>
        )}

        {/* Panel reveals on the card's RIGHT once open — the card
            group above slides left (via .card-detail-group-open) to
            make room, so this appears in the space that opens up. */}
        {isDetailsOpen && (
          <div className="card-detail-panel animate-slide-up-fade-in">
            <div className="card-detail-panel-header">
              <h2 id="card-detail-title" className="card-detail-panel-title">{card.name}</h2>
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

            <div className="card-detail-status">
              {isOwned ? (
                <span className="status-badge status-owned">✓ Owned</span>
              ) : (
                <span className="status-badge status-not-owned">Not owned</span>
              )}
            </div>

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
          </div>
        )}

      </div>
    </div>
  );
}