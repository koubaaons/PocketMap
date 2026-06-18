/**
 * @fileoverview BinderView — physical book layout.
 *
 * Spread layout:
 *   Spread 0: [Binder Cover] | [Page 1]
 *   Spread 1: [Page 2]       | [Page 3]
 *   Spread 2: [Page 4]       | [Page 5]
 *
 * Preview Mode:
 *   - All cards show in full color (owned and unowned)
 *   - Click filled slot to select, click another to swap
 *   - Click empty slot to move selected card there
 *   - Add cards to empty slots same as edit mode
 *   - "Save Layout" commits all changes to store
 *   - "Cancel" discards all preview changes
 */

import { useMemo, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { BinderPage } from '../collections/BinderPage.jsx';
import { AddCardToBinderModal } from '../modals/AddCardToBinderModal.jsx';
import { SlotActionModal } from '../modals/SlotActionModal.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { buildPageSlotMap, getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useBinderView } from '../../hooks/useBinderView.js';
import { useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { createBinderSlot } from '../../types/index.js';

export function BinderView({ binder, binderSlots, cardDefinitions, collections, templateFields, inventory, toast, onNavigate }) {
  const dispatch   = useDispatch();
  const view       = useBinderView(binder, binderSlots);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const color = binder.cover_color ?? DEFAULT_BINDER_COLOR;

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const cardDefMap = useMemo(() => {
    const map = {};
    cardDefinitions.forEach(cd => { map[cd.id] = cd; });
    return map;
  }, [cardDefinitions]);

  // Use preview slots when in preview mode, real slots otherwise
  const displaySlots = view.activeSlots;

  const spread       = view.page;
  const isCover      = spread === 0;
  const leftPageNum  = isCover ? null : spread * 2;
  const rightPageNum = isCover ? 1    : spread * 2 + 1;
  const totalSpreads = Math.ceil(binder.pages / 2) + 1;

  // Build slot maps from display slots (preview or real)
  const leftSlotMap = useMemo(() => {
    if (!leftPageNum) return {};
    const map = {};
    displaySlots
      .filter(s => s.binderId === binder.id && s.pageNumber === leftPageNum)
      .forEach(s => { map[s.slotIndex] = s; });
    return map;
  }, [displaySlots, binder.id, leftPageNum]);

  const rightSlotMap = useMemo(() => {
    if (!rightPageNum) return {};
    const map = {};
    displaySlots
      .filter(s => s.binderId === binder.id && s.pageNumber === rightPageNum)
      .forEach(s => { map[s.slotIndex] = s; });
    return map;
  }, [displaySlots, binder.id, rightPageNum]);

  const filled   = getFilledSlotCount(binderSlots, binder.id);
  const capacity = binder.rows * binder.cols * binder.pages;

  const { handleAddToSlot, handleRemoveFromSlot, handleAddPage } =
    useBinderSlotActions(toast, {
      onAddSuccess:    view.closeAddToSlot,
      onRemoveSuccess: view.closeSlotAction,
    });

  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess:   view.closeSlotAction,
      onUnownSuccess: view.closeCardDetail,
    });

  // ── Edit mode handlers ──────────────────────────────────────────────────

  const handlePlaceCard = (cardDef, collectionId) => {
    if (view.isPreviewMode) {
      // Add to preview local state only
      const { slot } = createBinderSlot({
        binderId:     binder.id,
        cardDefId:    cardDef.id,
        collectionId,
        pageNumber:   view.addingToSlot.pageNumber,
        slotIndex:    view.addingToSlot.slotIndex,
      });
      if (slot) {
        view.previewAddSlot(slot);
        view.closeAddToSlot();
        toast('Card added to preview');
      }
    } else {
      handleAddToSlot({
        binderId:     binder.id,
        cardDefId:    cardDef.id,
        collectionId,
        pageNumber:   view.addingToSlot.pageNumber,
        slotIndex:    view.addingToSlot.slotIndex,
      });
    }
  };

  const handleOwnFromSlot = () => {
    if (!view.activeSlot) return;
    handleOwn({ cardDefId: view.activeSlot.cardDef.id, collectionId: view.activeSlot.slot.collectionId });
  };

  const handleDeleteBinder = () => {
    dispatch({ type: ACTIONS.BINDER_DELETE, payload: { binderId: binder.id } });
    toast(`"${binder.name}" moved to trash`);
    setConfirmDelete(false);
  };

  const handleEditCardFromBinder = (cardDef) => {
    view.closeCardDetail();
    if (onNavigate && cardDef?.collectionId) {
      onNavigate('collection', cardDef.collectionId);
      toast(`Navigated to ${cardDef.name}'s collection to edit`);
    }
  };

  // ── Preview mode handlers ───────────────────────────────────────────────

  const handleSlotClickInPreview = (slot, cardDef) => {
    if (!view.selectedSlot) {
      // Select this slot
      view.selectSlotForMove(slot);
    } else if (view.selectedSlot.id === slot.id) {
      // Deselect
      view.clearSelectedSlot();
    } else {
      // Swap with selected slot
      view.previewMoveSlot(view.selectedSlot.id, slot.pageNumber, slot.slotIndex);
    }
  };

  const handleEmptyClickInPreview = (slotIndex, pageNumber) => {
    if (view.selectedSlot) {
      // Move selected card to empty slot
      view.previewMoveSlot(view.selectedSlot.id, pageNumber, slotIndex);
    } else {
      // Add a new card to this slot
      view.openAddToSlot(slotIndex, pageNumber);
    }
  };

  // ── Save layout — commit preview slots to store ─────────────────────────

  const handleSaveLayout = () => {
    if (!view.previewSlots) return;

    // Find slots that moved — compare preview vs original
    view.previewSlots.forEach(previewSlot => {
      const original = binderSlots.find(s => s.id === previewSlot.id);
      if (!original) {
        // New slot added in preview — dispatch add
        dispatch({ type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: previewSlot } });
      } else if (
        original.pageNumber !== previewSlot.pageNumber ||
        original.slotIndex  !== previewSlot.slotIndex
      ) {
        // Slot moved — dispatch move
        dispatch({
          type: ACTIONS.BINDER_SLOT_MOVE,
          payload: { slotId: previewSlot.id, pageNumber: previewSlot.pageNumber, slotIndex: previewSlot.slotIndex },
        });
      }
    });

    view.exitPreviewMode();
    toast('Layout saved');
  };

  // ── Rendering helpers ───────────────────────────────────────────────────

  const cardTemplateFields = view.viewingCardDef
    ? templateFields.filter(f => f.collectionId === view.viewingCardDef.collectionId)
    : [];

  const spreadLabel = isCover
    ? 'Cover + Page 1'
    : `Pages ${leftPageNum}–${Math.min(rightPageNum, binder.pages)}`;

  const spreadList = useMemo(() => {
    const list = [{ label: 'Cover', spread: 0 }];
    for (let s = 1; s < totalSpreads; s++) {
      const l = s * 2;
      const r = s * 2 + 1;
      list.push({ label: r <= binder.pages ? `${l}-${r}` : `${l}`, spread: s });
    }
    return list;
  }, [totalSpreads, binder.pages]);

  const makePageHandlers = (pageNumber) => ({
    onClickEmpty: (slotIndex) =>
      view.isPreviewMode
        ? handleEmptyClickInPreview(slotIndex, pageNumber)
        : view.openAddToSlot(slotIndex, pageNumber),
    onClickSlot: (slot, cardDef) =>
      view.isPreviewMode
        ? handleSlotClickInPreview(slot, cardDef)
        : view.openSlotAction(slot, cardDef),
  });

  return (
    <div className="binder-view-root">

      {/* Topbar */}
      <div className="binder-topbar">
        <div className="binder-topbar-left">
          <span className="binder-title" style={{ color }}>{binder.name}</span>
          <span className="binder-fill-count">{filled}/{capacity} cards</span>
        </div>
        <div className="binder-topbar-right">
          <div className="binder-mode-toggle">
            <button
              className={`mode-btn ${!view.isPreviewMode ? 'mode-btn-active' : ''}`}
              onClick={view.exitPreviewMode}
            >
              Edit Mode
            </button>
            <button
              className={`mode-btn ${view.isPreviewMode ? 'mode-btn-active' : ''}`}
              onClick={view.enterPreviewMode}
            >
              Preview Mode
            </button>
          </div>

          {/* Save Layout button — only in preview mode */}
          {view.isPreviewMode && (
            <Button variant="primary" size="sm" onClick={handleSaveLayout}>
              Save Layout
            </Button>
          )}

          {!view.isPreviewMode && (
            <Button variant="ghost" size="sm" onClick={() => handleAddPage(binder.id)}>+ Page</Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {/* Page navigation */}
      <div className="binder-page-nav">
        <button className="binder-nav-arrow" onClick={() => view.goToPage(spread - 1)} disabled={spread === 0}>‹</button>
        <span className="binder-page-indicator">{spreadLabel} / {binder.pages} pages</span>
        <button className="binder-nav-arrow" onClick={() => view.goToPage(spread + 1)} disabled={spread >= totalSpreads - 1}>›</button>
      </div>

      {/* Book */}
      <div className="binder-book-wrapper">
        <div className={`binder-book binder-pages-${binder.page_color ?? "dark"}`}>

          {/* LEFT — cover or left page */}
          {isCover ? (
            <div className="binder-book-page binder-book-page-left binder-cover-page" style={{ background: color }}>
              <div className="binder-cover-content">
                <div className="binder-cover-name">{binder.name}</div>
                <div className="binder-cover-meta">{binder.pages} pages · {binder.rows}×{binder.cols}</div>
              </div>
            </div>
          ) : leftPageNum <= binder.pages ? (
            <div className="binder-book-page binder-book-page-left">
              <BinderPage
                binder={binder}
                pageNumber={leftPageNum}
                pageSlotMap={leftSlotMap}
                cardDefMap={cardDefMap}
                ownershipMap={ownershipMap}
                isPreviewMode={view.isPreviewMode}
                selectedSlot={view.selectedSlot}
                {...makePageHandlers(leftPageNum)}
              />
            </div>
          ) : (
            <div className="binder-book-page binder-book-page-left binder-page-empty-right" />
          )}

          {/* Spine */}
          <div className="binder-spine-center" style={{ background: color }}>
            <div className="binder-ring" />
            <div className="binder-ring" />
            <div className="binder-ring" />
          </div>

          {/* RIGHT — page 1 on cover spread, right page otherwise */}
          {rightPageNum <= binder.pages ? (
            <div className="binder-book-page binder-book-page-right">
              <BinderPage
                binder={binder}
                pageNumber={rightPageNum}
                pageSlotMap={rightSlotMap}
                cardDefMap={cardDefMap}
                ownershipMap={ownershipMap}
                isPreviewMode={view.isPreviewMode}
                selectedSlot={view.selectedSlot}
                {...makePageHandlers(rightPageNum)}
              />
            </div>
          ) : (
            <div className="binder-book-page binder-book-page-right binder-page-empty-right" />
          )}

        </div>
      </div>

      {/* Thumbnails */}
      <div className="binder-thumbnails-bar">
        {spreadList.map(({ label, spread: s }) => (
          <button
            key={s}
            className={`binder-thumb ${spread === s ? 'binder-thumb-active' : ''}`}
            style={spread === s ? { borderColor: color, color } : {}}
            onClick={() => view.goToPage(s)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preview hint */}
      {view.isPreviewMode && (
        <div className="binder-preview-hint">
          {view.selectedSlot
            ? 'Click an empty slot to move · Click another card to swap · Click same card to deselect'
            : 'Preview Mode — all cards in full color · Click a card to select for moving · Click empty slot to add'}
        </div>
      )}

      {/* Modals */}
      {view.addingToSlot && (
        <AddCardToBinderModal
          binder={binder}
          pageNumber={view.addingToSlot.pageNumber}
          slotIndex={view.addingToSlot.slotIndex}
          cardDefinitions={cardDefinitions}
          collections={collections}
          templateFields={templateFields}
          inventory={inventory}
          binderSlots={view.isPreviewMode ? (view.previewSlots ?? binderSlots) : binderSlots}
          onSubmit={handlePlaceCard}
          onClose={view.closeAddToSlot}
        />
      )}

      {view.activeSlot && (
        <SlotActionModal
          slot={view.activeSlot.slot}
          cardDef={view.activeSlot.cardDef}
          inventoryItem={ownershipMap[view.activeSlot.cardDef.id] ?? null}
          onOwn={handleOwnFromSlot}
          onRemove={() => handleRemoveFromSlot(view.activeSlot.slot.id)}
          onViewDetail={() => view.openCardDetail(view.activeSlot.cardDef)}
          onClose={view.closeSlotAction}
        />
      )}

      {view.viewingCardDef && (
        <CardDetailModal
          card={view.viewingCardDef}
          inventoryItem={ownershipMap[view.viewingCardDef.id] ?? null}
          templateFields={cardTemplateFields}
          onOwn={() => handleOwn({ cardDefId: view.viewingCardDef.id, collectionId: view.viewingCardDef.collectionId })}
          onUnown={(inventoryId) => handleUnown(inventoryId)}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={() => handleEditCardFromBinder(view.viewingCardDef)}
          onDelete={() => view.closeCardDetail()}
          onClose={view.closeCardDetail}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${binder.name}"?`}
          message="This binder will be moved to the trash bin. All slot placements will be removed."
          confirmLabel="Delete Binder"
          onConfirm={handleDeleteBinder}
          onClose={() => setConfirmDelete(false)}
        />
      )}

    </div>
  );
}