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
 *
 * Fullscreen: the whole binder-view-root goes into real OS-level
 * fullscreen via useFullscreen(rootRef) — no portal, no scale math.
 * Existing layout just gets a bigger box to render into.
 *
 * BinderBookFlip is the only book renderer; it builds its own slot
 * maps and handles the cover/page flip animation internally off
 * `spread` (isClosed = spread === 0).
 *
 * .binder-book needs an explicit aspect-ratio because BinderBookFlip's
 * faces are all position:absolute (required for the flip transform)
 * and contribute zero intrinsic height — without it the book would
 * collapse to ~0 height. bookAspectRatio computes this from the same
 * slot math (2.5/3.5 ratio × binder.rows/cols) the page grid uses.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { BinderBookFlip } from './BinderBookFlip.jsx';
import { AddCardToBinderModal } from '../modals/AddCardToBinderModal.jsx';
import { SlotActionModal } from '../modals/SlotActionModal.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { useBinderCoverEditor } from '../../hooks/useBinderCoverEditor.js';
import { BinderCoverStickers } from './BinderCover.jsx';
import { getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useBinderView } from '../../hooks/useBinderView.js';
import { useBinderFullscreen } from '../../hooks/useBinderFullscreen.js';
import { useStore, useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { createBinderSlot } from '../../types/index.js';

export function BinderView({ toast, onNavigate, initialPage = null }) {
  const nav             = useStore(s => s.nav);
  const binders         = useStore(s => s.binders);
  const allBinderSlots  = useStore(s => s.binderSlots ?? []);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const collections     = useStore(s => s.collections);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  const binder          = binders.find(b => b.id === nav.currentBinderId) ?? null;
  const binderSlots     = allBinderSlots.filter(s => s.binderId === binder?.id);
  const dispatch   = useDispatch();
  const view       = useBinderView(binder, binderSlots);

  useEffect(() => {
    if (initialPage && initialPage > 0) {
      const spread = Math.ceil(initialPage / 2);
      view.goToPage(spread);
    }
  }, []); 
  const [confirmDelete, setConfirmDelete] = useState(false);

 
  const isClosed = view.page === 0;

  const coverEditor = useBinderCoverEditor({ binder, toast });

  
  const COVER_FLIP_DURATION_MS = 700;
  const [isAnimatingCoverFlip, setIsAnimatingCoverFlip] = useState(false);
  const prevIsCoverRef = useRef(view.page === 0);
  useLayoutEffect(() => {
    const nowIsCover = view.page === 0;
    if (prevIsCoverRef.current !== nowIsCover) {
      setIsAnimatingCoverFlip(true);
      const timeout = setTimeout(() => setIsAnimatingCoverFlip(false), COVER_FLIP_DURATION_MS);
      prevIsCoverRef.current = nowIsCover;
      return () => clearTimeout(timeout);
    }
  }, [view.page]);

 
  const handleOpenBinder = () => {
    if (view.page === 0) {
      view.goToPage(1);
    }
  };

  const handleCloseBinder = () => {
    view.goToPage(0);
  };

  const {
    rootRef,
    bookFlipWrapperRef,
    isFullscreen,
    toggleFullscreen,
    fullscreenMaxBookWidth,
    effectiveBookAspectRatio,
  } = useBinderFullscreen({ rows: binder.rows, cols: binder.cols });

  const color = binder.cover_color ?? DEFAULT_BINDER_COLOR;

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const cardDefMap = useMemo(() => {
    const map = {};
    cardDefinitions.forEach(cd => { map[cd.id] = cd; });
    return map;
  }, [cardDefinitions]);

  const displaySlots = view.activeSlots;

  const spread       = view.page;
  const totalSpreads = Math.ceil(binder.pages / 2) + 1;

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
    onNavigate('home'); // navigate away immediately, don't wait for App.jsx guard
  };

  const handleEditCardFromBinder = (cardDef) => {
    view.closeCardDetail();
    if (onNavigate && cardDef?.collectionId) {
      onNavigate('collection', cardDef.collectionId);
      toast(`Opening ${cardDef.name}`);
    }
  };

  // ── Keyboard navigation ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture keys when user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Don't capture if a modal is open
      if (document.querySelector('.modal-overlay')) return;

      if (e.key === 'Enter' && isClosed && !coverEditor.isEditingCover) {
        e.preventDefault();
        handleOpenBinder();
        return;
      }
      if (e.key === 'ArrowRight' && !isClosed) {
        e.preventDefault();
        view.goToPage(spread + 1);
        return;
      }
      if (e.key === 'ArrowLeft' && !isClosed) {
        e.preventDefault();
        view.goToPage(spread - 1);
        return;
      }
      if (e.key === 'Escape' && !isClosed) {
        e.preventDefault();
        handleCloseBinder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClosed, spread, view, handleOpenBinder, handleCloseBinder, coverEditor.isEditingCover]);

  // ── Preview mode handlers ───────────────────────────────────────────────

  const handleSlotClickInPreview = (slot, cardDef) => {
    if (!view.selectedSlot) {
      view.selectSlotForMove(slot);
    } else if (view.selectedSlot.id === slot.id) {
      view.clearSelectedSlot();
    } else {
      // FIX: pass the clicked slot's own id as the swap target directly —
      // previewMoveSlot no longer re-derives "what's at this position"
      // after the fact, which is what went stale on rapid clicks.
      view.previewMoveSlot(view.selectedSlot.id, slot.id, slot.pageNumber, slot.slotIndex);
    }
  };

  const handleEmptyClickInPreview = (slotIndex, pageNumber) => {
    if (view.selectedSlot) {
      // Empty destination — no swap partner, pass null explicitly.
      view.previewMoveSlot(view.selectedSlot.id, null, pageNumber, slotIndex);
    } else {
      view.openAddToSlot(slotIndex, pageNumber);
    }
  };

  // ── Save layout — commit preview slots to store ─────────────────────────

  const handleSaveLayout = () => {
    if (!view.previewSlots) return;

    view.previewSlots.forEach(previewSlot => {
      const original = binderSlots.find(s => s.id === previewSlot.id);
      if (!original) {
        dispatch({ type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: previewSlot } });
      } else if (
        original.pageNumber !== previewSlot.pageNumber ||
        original.slotIndex  !== previewSlot.slotIndex
      ) {
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

  const isCover = spread === 0;
  const lastPairSpreadIndex = Math.ceil(binder.pages / 2);
  const isFinalEvenSpread = binder.pages % 2 === 0 && spread === lastPairSpreadIndex;
  const currentDisplayPage = isCover
    ? 1
    : isFinalEvenSpread
      ? binder.pages
      : spread * 2 - 1;
  const [pageInputValue, setPageInputValue] = useState(String(currentDisplayPage));

  // Keep the input in sync when navigating via other means (arrows, etc.)
  // without fighting the user mid-edit — only resync when not focused.
  const [isEditingPageInput, setIsEditingPageInput] = useState(false);
  if (!isEditingPageInput && pageInputValue !== String(currentDisplayPage)) {
    setPageInputValue(String(currentDisplayPage));
  }

  const pageNumberToSpread = (pageNum) => {
    if (binder.pages % 2 === 0 && pageNum === binder.pages) return lastPairSpreadIndex;
    return Math.ceil((pageNum + 1) / 2);
  };

  const commitPageInput = () => {
    setIsEditingPageInput(false);
    const parsed = parseInt(pageInputValue, 10);
    if (Number.isNaN(parsed)) {
      setPageInputValue(String(currentDisplayPage));
      return;
    }
    const clamped = Math.max(1, Math.min(binder.pages, parsed));
    view.goToPage(pageNumberToSpread(clamped));
    setPageInputValue(String(clamped));
  };

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

  // Cover content passed into BinderBookFlip's cover pair. "Not yet
  // opened" is spread === 0 (isCover).
  return (
    <div ref={rootRef} className={`binder-view-root ${isFullscreen ? 'binder-view-root-fullscreen' : ''}`}>

      {/* Topbar — always rendered so it occupies space and prevents layout shift
          when the binder opens. Invisible and non-interactive while closed. */}
      <div className="binder-topbar" style={isClosed ? { visibility: 'hidden', pointerEvents: 'none' } : {}}>
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

          {view.isPreviewMode && (
            <Button variant="primary" size="sm" onClick={handleSaveLayout}>
              Save Layout
            </Button>
          )}

          {!view.isPreviewMode && (
            <Button variant="ghost" size="sm" onClick={() => handleAddPage(binder.id)}>+ Page</Button>
          )}

          {/* === ISSUE #93: fullscreen toggle. Same button enters/exits —
              no separate exit button or markup needed elsewhere. === */}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? '✕' : '⛶'}
          </Button>

          {/* === ISSUE #92: close binder — returns to the closed cover === */}
          <Button variant="ghost" size="sm" onClick={handleCloseBinder}>
            Close Binder
          </Button>

          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {/* Page navigation — hidden while closed, same as topbar. Editable
          page number, replaces the old thumbnails bar entirely. Click
          the number, clear it, type a new page (1-binder.pages), press
          Enter or click away to jump. */}
      <div className="binder-page-nav" style={isClosed ? { visibility: 'hidden', pointerEvents: 'none' } : {}}>
        <input
          type="number"
          className="binder-page-input"
          value={pageInputValue}
          min={1}
          max={binder.pages}
          onFocus={() => setIsEditingPageInput(true)}
          onChange={(e) => setPageInputValue(e.target.value)}
          onBlur={commitPageInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setPageInputValue(String(currentDisplayPage));
              e.currentTarget.blur();
            }
          }}
          aria-label="Jump to page"
        />
        <span className="binder-page-indicator-suffix">/ {binder.pages} pages</span>
      </div>

      {/* Book — BinderBookFlip is now the only book. The wrapper div is
          what fullscreen's width-cap measurement targets (see
          bookFlipWrapperRef above), since BinderBookFlip itself takes no
          ref/maxWidth prop. */}
      <div className="binder-book-wrapper">
        <button
          className="binder-nav-arrow binder-nav-arrow-side binder-nav-arrow-left"
          onClick={() => view.goToPage(spread - 1)}
          disabled={spread === 0}
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Always mounted (visibility toggled, not conditionally rendered) —
      removing a flex sibling reflows the centered book's position. */}
        <div className="binder-cover-label" style={{ visibility: isCover ? 'visible' : 'hidden' }}>
          <div className="binder-cover-label-name">{binder.name}</div>
          <div className="binder-cover-label-meta">{binder.pages} pages · {binder.rows}×{binder.cols}</div>
        </div>

        <div
          ref={bookFlipWrapperRef}
          className={`binder-book ${(isCover || isAnimatingCoverFlip) ? 'binder-book-closed' : ''}`}
          style={{
            aspectRatio: effectiveBookAspectRatio,
            padding: 0,
            background: 'transparent',
            boxShadow: 'none',
            ...(fullscreenMaxBookWidth ? { maxWidth: `${fullscreenMaxBookWidth}px` } : {}),
          }}
        >
          <BinderBookFlip
            binder={binder}
            binderSlots={displaySlots}
            cardDefMap={cardDefMap}
            ownershipMap={ownershipMap}
            spread={spread}
            isPreviewMode={view.isPreviewMode}
            selectedSlot={view.selectedSlot}
            makePageHandlers={makePageHandlers}
            coverColor={color}
            pageColor={binder.page_color ?? 'dark'}
            coverFrontContent={<BinderCoverStickers binder={binder} isCover={isCover} {...coverEditor} />}
            onCoverClick={handleOpenBinder}
            isClickable={isCover && !coverEditor.isEditingCover}
          />
        </div>

        <button
          className="binder-nav-arrow binder-nav-arrow-side binder-nav-arrow-right"
          onClick={() => view.goToPage(spread + 1)}
          disabled={spread >= totalSpreads - 1 || isClosed}
          aria-label="Next page"
        >
          ›
        </button>
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