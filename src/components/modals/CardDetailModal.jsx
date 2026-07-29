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
 * === Quantity tracking === inventoryItem (a single item) is now
 * inventoryItems (an array) — a card can be owned more than once, and
 * each physical copy has its own condition/notes/language, tracked as
 * its own separate inventory row (see inventorySelectors.js's
 * buildInventoryGroupMap). The view shows "X owned" plus a list of
 * every individual copy, each independently editable/removable, plus
 * an "Add Another Copy" action. Editing a specific copy's details
 * tracks WHICH one via editingItem — useAcquisitionForm's own reset()
 * re-syncs its draft fields to whichever copy editingItem currently
 * points at.
 *
 * Doesn't use the shared Modal component, since Modal wraps everything
 * in a single boxed panel with a header — this needs two independent
 * visual pieces instead. Replicates Modal's own overlay/escape-key/
 * focus-trap/click-outside behavior directly so it still behaves like
 * every other modal in the app.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { AcquisitionFields } from '../collections/AcquisitionForm.jsx';
import { AcquisitionSummary } from '../collections/AcquisitionSummary.jsx';
import { CardDefinitionFields } from '../collections/CardDefinitionFields.jsx';
import { useCardDefinitionForm } from '../../hooks/useCardDefinitionForm.js';
import { useAcquisitionForm } from '../../hooks/useAcquisitionForm.js';
import { useCardHoloPointer } from '../../hooks/useCardHoloPointer.js';
import { useCardImageUpload } from '../../hooks/useCardImageUpload.js';
import { getDisplayLabelForCopy } from '../../selectors/inventorySelectors.js';

export function CardDetailModal({
  card,
  inventoryItems,
  templateFields,
  onOwn,
  onUnown,
  onUpdateAcquisition,
  onToggleFavorite,
  onEdit,
  onDelete,
  onClose,
  toast,
}) {
  const [confirmUnownId, setConfirmUnownId] = useState(null); // which copy's removal is being confirmed, or null
  const [confirmDelete, setConfirmDelete]     = useState(false);
  const [isDetailsOpen, setIsDetailsOpen]     = useState(false);
  const [isEditingCard, setIsEditingCard]     = useState(false);
  const [isEditingAcquisition, setIsEditingAcquisition] = useState(false);
  // Which specific copy "Edit Details" is currently open for — null
  // while not editing any copy's acquisition info.
  const [editingItem, setEditingItem] = useState(null);

  const quantityOwned = inventoryItems.length;
  const isOwned = quantityOwned > 0;

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
    inventoryItem: editingItem,
    onSubmit: (updated) => { onUpdateAcquisition(updated); setIsEditingAcquisition(false); setEditingItem(null); },
  });

  // Re-syncs the acquisition form's draft fields whenever WHICH copy
  // is being edited changes — useAcquisitionForm's own values only
  // build once on mount (see that file), so switching from editing
  // copy A to copy B needs an explicit reset to pick up copy B's
  // actual values instead of still showing copy A's.
  useEffect(() => {
    if (editingItem) acquisitionForm.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem?.id]);

  const handleStartEditAcquisition = (item) => {
    setEditingItem(item);
    setIsEditingAcquisition(true);
  };

  const handleCancelEditAcquisition = () => {
    setIsEditingAcquisition(false);
    setEditingItem(null);
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

  // === Image upload while editing — now genuinely shared with
  // CardDefinitionForm.jsx via useCardImageUpload, not just similar
  // code duplicated in two places. ===
  const { isCompressing, fileInputRef, handleImageChange, handleRemoveImage } = useCardImageUpload({ set: cardForm.set, toast });

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

  const confirmUnownItem = confirmUnownId ? inventoryItems.find(i => i.id === confirmUnownId) : null;

  // === Keep the (portaled, position:fixed) detail panel visually
  // anchored beside the actual floating card, instead of a flat
  // corner offset with no relation to where the card really is.
  //
  // Deliberately does NOT read the group's position directly off
  // getBoundingClientRect() — .card-detail-group is still 0.4s into
  // its own translateX transition at the exact moment it first opens
  // (see .card-detail-group's transition), so its rect at that instant
  // reflects wherever the CSS transition happens to be, not where it's
  // settling to. That's exactly what made the panel appear in the
  // wrong place for a moment and then jump into its real position a
  // beat later. Computing the settled position analytically —
  // viewport center, minus the known -160px .card-detail-group-open
  // shift, plus half the group's own width (which the shift doesn't
  // affect, safe to read at any point) — gives the right answer
  // immediately, with no dependency on the transition's timing at all.
  // Still re-measures via ResizeObserver/resize for cases where the
  // group's WIDTH itself changes later (a window resize, mainly).
  const isOpen = isDetailsOpen || isEditingCard || isEditingAcquisition;
  const [panelLeft, setPanelLeft] = useState(null);

  // Matches .card-detail-group-open's transform: translateX(-160px) —
  // see the comment above for why this has to be a known constant
  // rather than read off the group's own (possibly still-animating)
  // bounding rect.
  const GROUP_OPEN_SHIFT_X = 160;

  useLayoutEffect(() => {
    // Resetting here is tied to the real DOM measurement/observer
    // work below, not a pure "derive state from a prop" case — this
    // whole effect exists specifically to interact with the DOM
    // (ResizeObserver, window resize), which can't happen during
    // render. Left as an effect deliberately rather than restructured,
    // since this positioning logic already went through several
    // rounds of real, hard-won debugging (see this file's own
    // comments above) and isn't worth risking further without the
    // ability to verify visually against a live browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isOpen) { setPanelLeft(null); return; }
    const el = firstFocusRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const width = el.getBoundingClientRect().width; // shift doesn't affect width, safe to read anytime
      const shiftedCenterX = window.innerWidth / 2 - GROUP_OPEN_SHIFT_X;
      setPanelLeft(shiftedCenterX + width / 2 + 20);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isOpen]);


  if (confirmUnownItem) {
    return (
      <ConfirmModal
        title="Remove This Copy?"
        message={`Remove this copy of "${card.name}"? Its acquisition details will be lost. ${quantityOwned > 1 ? `You'll still have ${quantityOwned - 1} other cop${quantityOwned - 1 === 1 ? 'y' : 'ies'}.` : ''}`}
        confirmLabel="Remove"
        onConfirm={() => { onUnown(confirmUnownItem.id); setConfirmUnownId(null); if (quantityOwned <= 1) onClose(); }}
        onClose={() => setConfirmUnownId(null)}
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
      <div className={`card-detail-group ${isOpen ? 'card-detail-group-open' : ''}`} ref={firstFocusRef} tabIndex={-1}>

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
        {isOpen && createPortal(
          <div
            className="card-detail-panel animate-fade-in"
            style={panelLeft != null ? { left: panelLeft, right: 'auto' } : undefined}
          >

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

                <CardDefinitionFields
                  values={cardForm.values}
                  errors={cardForm.errors}
                  set={cardForm.set}
                  sortedFields={sortedFields}
                  nameFieldId="card-detail-edit-name"
                  rarityFieldId="card-detail-edit-rarity"
                />

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
                    ← Editing a copy of {card.name}
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
                      className={`fav-toggle ${inventoryItems[0].is_favorite ? 'fav-active' : ''}`}
                      onClick={() => onToggleFavorite(inventoryItems[0])}
                      aria-label={inventoryItems[0].is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      title={quantityOwned > 1 ? 'Favorites the first copy' : undefined}
                    >
                      {inventoryItems[0].is_favorite ? '★' : '☆'}
                    </button>
                  )}
                </div>

                <div className="card-detail-status">
                  {isOwned ? (
                    <span className="status-badge status-owned">✓ Owned{quantityOwned > 1 ? ` ×${quantityOwned}` : ''}</span>
                  ) : (
                    <span className="status-badge status-not-owned">Not owned</span>
                  )}
                  {card.rarity && <span className="status-badge status-rarity">{card.rarity}</span>}
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

                {/* === Quantity tracking: list every individual copy,
                    each independently editable/removable — was a
                    single AcquisitionSummary for the one inventory
                    item before. === */}
                {isOwned && (
                  <div className="card-detail-copies">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="card-detail-copy-row">
                        <div className="card-detail-copy-summary">
                          <span className="card-detail-copy-label">{getDisplayLabelForCopy(item, inventoryItems)}</span>
                          <AcquisitionSummary inventoryItem={item} compact />
                        </div>
                        <div className="card-detail-copy-actions">
                          <button className="card-detail-copy-edit-btn" onClick={() => handleStartEditAcquisition(item)}>Edit</button>
                          <button className="card-detail-copy-remove-btn" onClick={() => setConfirmUnownId(item.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <hr className="modal-divider" />

                <div className="card-detail-actions">
                  <div className="card-detail-actions-left">
                    <Button variant={isOwned ? 'ghost' : 'primary'} size="sm" onClick={onOwn}>
                      {isOwned ? '+ Add Another Copy' : '✓ I own it'}
                    </Button>
                  </div>
                  <div className="card-detail-actions-right">
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={handleStartEdit}>Edit Card</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>,
          document.body
        )}

      </div>
    </div>
  );
}