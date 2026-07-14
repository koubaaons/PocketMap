/**
 * @fileoverview CardDetailModal — shows a card definition with ownership
 * info, and now also handles editing it, in place.
 *
 * Two-part layout: the card image floats freely on its own (no box or
 * background behind it, just its own shadow, like a real card sitting
 * on a table), with a separate boxed panel beside it holding either
 * the view (name, favorite star, ownership status, attributes,
 * actions) or, once "Edit Card" is clicked, an edit form in the exact
 * same panel space.
 *
 * === Inline editing with live preview === Editing used to open a
 * completely separate modal (CardDefinitionForm) on top of this one.
 * Now the panel's own contents swap to an edit form instead — the
 * floating card image stays visible the whole time, and reflects the
 * DRAFT values (name doesn't visually matter, but holoType and
 * image_url do) as they're changed, not the saved ones. Nothing is
 * written to the store until Save is clicked; Cancel discards the
 * draft and the card reverts to exactly what it was. Same underlying
 * useCardDefinitionForm hook CardDefinitionForm.jsx already used for
 * create/edit forms elsewhere — reused directly here, not
 * reimplemented, so validation and the actual update shape can't
 * drift between the two.
 *
 * Doesn't use the shared Modal component, since Modal wraps everything
 * in a single boxed panel with a header — this needs two independent
 * visual pieces instead. Replicates Modal's own overlay/escape-key/
 * focus-trap/click-outside behavior directly so it still behaves like
 * every other modal in the app.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { AcquisitionFields } from '../collections/AcquisitionForm.jsx';
import { AcquisitionSummary } from '../collections/AcquisitionSummary.jsx';
import { HolographicPicker, DynamicField } from '../collections/CardDefinitionForm.jsx';
import { useCardDefinitionForm } from '../../hooks/useCardDefinitionForm.js';
import { useAcquisitionForm } from '../../hooks/useAcquisitionForm.js';
import { useCardHoloPointer } from '../../hooks/useCardHoloPointer.js';
import { compressImage } from '../../utils/index.js';
import { uploadImageToStorage } from '../../utils/supabaseImageUpload.js';
import { useAuth } from '../../hooks/useAuth.js';

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
  const [confirmUnown, setConfirmUnown]       = useState(false);
  const [confirmDelete, setConfirmDelete]     = useState(false);
  const [isDetailsOpen, setIsDetailsOpen]     = useState(false);
  const [isEditingCard, setIsEditingCard]     = useState(false);
  const [isEditingAcquisition, setIsEditingAcquisition] = useState(false);

  const isOwned = inventoryItem !== null;
  const { user } = useAuth();

  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === card.collectionId)
    .sort((a, b) => a.order - b.order);

  // === Reused directly from CardDefinitionForm's own create/edit
  // logic — called unconditionally (Rules of Hooks: this can't be
  // called only while isEditingCard is true, since that would change
  // how many hooks this component calls between renders). Its values
  // are simply unused while not editing. mode is always 'edit' here —
  // CardDetailModal only ever shows a card that already exists. ===
  const cardForm = useCardDefinitionForm({
    collection: { id: card.collectionId },
    sortedFields,
    initialCard: card,
    mode: 'edit',
    onSubmit: onEdit,
  });

  const acquisitionForm = useAcquisitionForm({
    inventoryItem,
    onSubmit: (updated) => { onUpdateAcquisition(updated); setIsEditingAcquisition(false); },
  });

  const handleStartEditAcquisition = () => {
    acquisitionForm.reset();
    setIsEditingAcquisition(true);
  };

  const handleCancelEditAcquisition = () => {
    acquisitionForm.reset();
    setIsEditingAcquisition(false);
  };

  const handleStartEdit = () => {
    cardForm.reset(); // discard any stale draft from a previous cancelled edit
    setIsEditingCard(true);
  };

  const handleCancelEdit = () => {
    cardForm.reset();
    setIsEditingCard(false);
  };

  const handleSaveEdit = () => {
    cardForm.handleSubmit(); // calls onEdit(updatedCard) internally on success
    setIsEditingCard(false);
  };

  // While editing, the floating card shows the DRAFT holoType/image —
  // not the saved card's — so changes preview live before Save.
  const holoType = (isEditingCard ? cardForm.values.holoType : card.holoType) ?? 'none';
  const activeHolo = holoType !== 'off' ? holoType : null;
  const displayImageUrl = isEditingCard ? cardForm.values.image_url : card.image_url;
  const { holoRef, handlePointerMoveWithTilt, handlePointerLeaveWithTilt } = useCardHoloPointer();

  // === Image upload while editing — same compressImage + Storage
  // upload CardDefinitionForm.jsx already does, replicated here since
  // it's inline JSX there rather than an exportable sub-component. ===
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const publicUrl = await uploadImageToStorage(compressed, path);
      cardForm.set('image_url', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    cardForm.set('image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      <div className={`card-detail-group ${(isDetailsOpen || isEditingCard || isEditingAcquisition) ? 'card-detail-group-open' : ''}`} ref={firstFocusRef} tabIndex={-1}>

        {/* Card image — floats freely, no box or background behind
            it at all, just its own drop shadow. Shows the draft
            image/holoType while editing, the saved ones otherwise. */}
        {displayImageUrl && (
          <div
            ref={activeHolo ? holoRef : undefined}
            className="card-detail-image-wrapper card-rotate-wrapper"
            data-holo={activeHolo ?? undefined}
            onPointerMove={activeHolo ? handlePointerMoveWithTilt : undefined}
            onPointerLeave={activeHolo ? handlePointerLeaveWithTilt : undefined}
          >
            <div className="card-rotator">
              <img
                src={displayImageUrl}
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
            {isEditingCard && (
              <button className="image-remove-btn" onClick={handleRemoveImage} aria-label="Remove image">✕</button>
            )}
          </div>
        )}

        {/* Close button — always visible regardless of details/edit
            state, floating just above the card. */}
        <Button variant="icon" size="sm" onClick={onClose} title="Close" className="card-detail-close-btn">✕</Button>

        {/* "Show details" — sits to the card's LEFT while closed,
            same glass-pill style as the binder's Customize button. */}
        {!isDetailsOpen && !isEditingCard && !isEditingAcquisition && (
          <button
            className="card-detail-show-btn"
            onClick={() => setIsDetailsOpen(true)}
          >
            Show details
          </button>
        )}

        {/* Panel reveals on the card's RIGHT once open — the card
            group above slides left (via .card-detail-group-open) to
            make room, so this appears in the space that opens up.
            Edit mode is a SUB-PAGE of this same panel, not a separate
            modal — swaps its contents in place. */}
        {(isDetailsOpen || isEditingCard || isEditingAcquisition) && (
          <div className="card-detail-panel animate-slide-up-fade-in">

            {isEditingCard ? (
              <>
                <div className="card-detail-panel-header">
                  <button className="card-detail-back-btn" onClick={handleCancelEdit} aria-label="Back to details">
                    ← Editing {card.name}
                  </button>
                </div>

                {!cardForm.values.image_url && (
                  <div className="form-group">
                    <button
                      className="image-upload-placeholder"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                      disabled={isCompressing}
                    >
                      <span className="image-upload-icon">🖼</span>
                      <span className="image-upload-label">{isCompressing ? 'Compressing…' : 'Add card image'}</span>
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                  aria-label="Upload card image"
                />

                <div className="form-group">
                  <label>Holographic Effect</label>
                  <HolographicPicker value={cardForm.values.holoType} onChange={(v) => cardForm.set('holoType', v)} />
                </div>

                <div className="form-group">
                  <label htmlFor="card-detail-edit-name">Card Name *</label>
                  <input
                    id="card-detail-edit-name"
                    className={`form-input ${cardForm.errors.name ? 'input-error' : ''}`}
                    value={cardForm.values.name}
                    onChange={e => cardForm.set('name', e.target.value)}
                    autoFocus
                  />
                  {cardForm.errors.name && <span className="field-error-msg">{cardForm.errors.name}</span>}
                </div>

                {sortedFields.map(field => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    value={cardForm.values[field.field_name]}
                    error={cardForm.errors[field.field_name]}
                    onChange={(val) => cardForm.set(field.field_name, val)}
                  />
                ))}

                <hr className="modal-divider" />

                <div className="card-detail-actions">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={handleSaveEdit}>Save</Button>
                </div>
              </>
            ) : isEditingAcquisition ? (
              <>
                <div className="card-detail-panel-header">
                  <button className="card-detail-back-btn" onClick={handleCancelEditAcquisition} aria-label="Back to details">
                    ← Editing details for {card.name}
                  </button>
                </div>

                <AcquisitionFields fields={acquisitionForm.fields} set={acquisitionForm.set} />

                <hr className="modal-divider" />

                <div className="card-detail-actions">
                  <Button variant="ghost" size="sm" onClick={handleCancelEditAcquisition}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={acquisitionForm.handleSubmit}>Save Details</Button>
                </div>
              </>
            ) : (
              <>
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
                      <Button variant="ghost" size="sm" onClick={handleStartEditAcquisition}>
                        Edit Details
                      </Button>
                    )}
                  </div>
                  <div className="card-detail-actions-right">
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={handleStartEdit}>Edit Card</Button>
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
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}