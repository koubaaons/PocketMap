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
 * === ISSUE #93: Fullscreen mode (final approach) ===
 *   The entire binder-view-root — topbar, page indicator, book, arrows,
 *   thumbnails, everything, completely unchanged — is put into REAL
 *   OS-level fullscreen via useFullscreen(rootRef). No separate
 *   fullscreen-specific markup, no scale math, no portal.
 *
 *   Why this is simpler than every earlier attempt: normal mode already
 *   does all the layout work (centering the book, sizing it, positioning
 *   the arrows). Fullscreen just gives that same, unchanged layout a
 *   bigger box to render into — the browser's native fullscreen handles
 *   making the element fill the whole monitor; our existing CSS handles
 *   everything else, exactly as it already does today. Anything added to
 *   this view later works in fullscreen automatically, with no extra code.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useFullscreen } from '../../hooks/useFullscreen.js';
import { useTheme } from '../../hooks/useTheme.js';
import { useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { createBinderSlot } from '../../types/index.js';

// === ISSUE #93: breathing room reserved above/below the book in
// fullscreen (accounts for the topbar + page-nav row still being visible,
// since this implementation keeps them shown per the chosen approach). ===
const FULLSCREEN_VERTICAL_PADDING = 160;

export function BinderView({ binder, binderSlots, cardDefinitions, collections, templateFields, inventory, toast, onNavigate }) {
  const dispatch   = useDispatch();
  const view       = useBinderView(binder, binderSlots);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // === ISSUE #93: the whole root element goes fullscreen as-is ===
  const rootRef = useRef(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(rootRef);

  // FIX: theme switches (light/dark) while already inside a fullscreen
  // binder weren't triggering a recalculation, since the effect below
  // only depended on [isFullscreen, binder.rows, binder.cols] — none of
  // which change on a theme toggle. If the theme switch caused even a
  // small layout shift elsewhere (e.g. topbar height), the stale
  // fullscreenMaxBookWidth from before the switch stuck around, which is
  // why leaving and re-entering the binder (full remount) "fixed" it.
  // Calling useTheme() here too is safe — it reads the same localStorage
  // key/data-theme attribute as wherever else it's called, no duplicate
  // side effects beyond re-applying the same value.
  const { theme } = useTheme();

  // FIX: no-scroll in fullscreen, done by MEASURING instead of estimating.
  // The previous version estimated height from rows/cols + a fudge factor,
  // which over-corrected (shrunk the book more than necessary, leaving
  // visible unused space). Now we let the book render at its normal
  // fullscreen width cap first, measure its REAL rendered height with
  // getBoundingClientRect(), and only shrink — by the exact ratio needed,
  // no guessing — if it's actually too tall for the viewport.
  const bookRef = useRef(null);
  const [fullscreenMaxBookWidth, setFullscreenMaxBookWidth] = useState(null);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenMaxBookWidth(null);
      return;
    }

    const recalc = () => {
      // Reset to the normal (uncapped-beyond-1700px) width first, so we
      // measure the book's true natural height at that width — not a
      // height that's already been shrunk by a previous correction.
      setFullscreenMaxBookWidth(null);

      // Wait two frames rather than one — a theme switch can trigger CSS
      // transitions (color/background) that take a moment to settle, and
      // measuring mid-transition risks a slightly-off rect.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = bookRef.current;
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const availableHeight = window.innerHeight - FULLSCREEN_VERTICAL_PADDING;

          if (rect.height <= availableHeight || rect.height === 0) {
            // Fits already — leave it at its natural/default width cap.
            return;
          }

          // Shrink by the exact ratio needed, computed from real measured
          // height, not an estimate — width and height scale together
          // since height is purely a function of width here.
          const shrinkFactor = availableHeight / rect.height;
          setFullscreenMaxBookWidth(rect.width * shrinkFactor);
        });
      });
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [isFullscreen, binder.rows, binder.cols, theme]);

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

  // === ISSUE: editable page-number jump, replaces the thumbnails bar ===
  // Displayed page number is the lower page currently shown (1 on cover
  // spread, otherwise leftPageNum). Typing a number and committing jumps
  // to whichever spread contains that page.
  const currentDisplayPage = isCover ? 1 : leftPageNum;
  const [pageInputValue, setPageInputValue] = useState(String(currentDisplayPage));

  // Keep the input in sync when navigating via other means (arrows, etc.)
  // without fighting the user mid-edit — only resync when not focused.
  const [isEditingPageInput, setIsEditingPageInput] = useState(false);
  if (!isEditingPageInput && pageInputValue !== String(currentDisplayPage)) {
    setPageInputValue(String(currentDisplayPage));
  }

  const pageNumberToSpread = (pageNum) => {
    if (pageNum <= 1) return 0;
    return Math.ceil(pageNum / 2);
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

  return (
    <div ref={rootRef} className={`binder-view-root ${isFullscreen ? 'binder-view-root-fullscreen' : ''}`}>

      {/* Topbar — stays visible in fullscreen, exactly as requested */}
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

          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      {/* Page navigation — editable page number, replaces the old
          thumbnails bar entirely. Click the number, clear it, type a new
          page (1-binder.pages), press Enter or click away to jump. */}
      <div className="binder-page-nav">
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

      {/* Book — unchanged from normal mode. The existing centering CSS on
          binder-book-wrapper handles fullscreen automatically since it's
          just rendering into a bigger box now; nothing else changes. */}
      <div className="binder-book-wrapper">
        <button
          className="binder-nav-arrow binder-nav-arrow-side binder-nav-arrow-left"
          onClick={() => view.goToPage(spread - 1)}
          disabled={spread === 0}
          aria-label="Previous page"
        >
          ‹
        </button>

        <div
          ref={bookRef}
          className={`binder-book binder-pages-${binder.page_color ?? "dark"}`}
          style={{
            background: `linear-gradient(135deg, ${color}dd 0%, ${color} 50%, ${color}bb 100%)`,
            ...(fullscreenMaxBookWidth ? { maxWidth: `${fullscreenMaxBookWidth}px` } : {}),
          }}
        >

          {isCover ? (
            <div key="cover" className="binder-book-page binder-book-page-left binder-cover-page" style={{ background: `linear-gradient(135deg, ${color}dd 0%, ${color} 50%, ${color}bb 100%)` }}>
              <div className="binder-cover-content">
                <div className="binder-cover-name">{binder.name}</div>
                <div className="binder-cover-meta">{binder.pages} pages · {binder.rows}×{binder.cols}</div>
              </div>
            </div>
          ) : leftPageNum <= binder.pages ? (
            <div key={`left-${leftPageNum}`} className="binder-book-page binder-book-page-left">
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
            <div key={`left-empty-${leftPageNum}`} className="binder-book-page binder-book-page-left binder-page-empty-right" />
          )}

          <div className="binder-spine-center" style={{ background: `linear-gradient(135deg, ${color}dd 0%, ${color} 50%, ${color}bb 100%)` }}>
            <div className="binder-ring" />
            <div className="binder-ring" />
            <div className="binder-ring" />
          </div>

          {rightPageNum <= binder.pages ? (
            <div key={`right-${rightPageNum}`} className="binder-book-page binder-book-page-right">
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
            <div key={`right-empty-${rightPageNum}`} className="binder-book-page binder-book-page-right binder-page-empty-right" />
          )}

        </div>

        <button
          className="binder-nav-arrow binder-nav-arrow-side binder-nav-arrow-right"
          onClick={() => view.goToPage(spread + 1)}
          disabled={spread >= totalSpreads - 1}
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