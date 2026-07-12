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
 *
 * === MIGRATION: BinderBookFlip is now THE book ===
 *   The old stacked-left/right-page book (with its own isOpen/
 *   isAnimatingOpen state, transitionend listener, and inline-duplicated
 *   cover markup) has been removed. BinderBookFlip — previously mounted
 *   underneath as a side-by-side test harness — is now the only book
 *   rendered here. It's a self-contained component: it builds its own
 *   slot maps from the full binderSlots array and mounts every page-pair
 *   itself, so BinderView no longer needs per-spread left/right slot maps
 *   at all (leftSlotMap/rightSlotMap are gone).
 *
 *   Everything else — topbar, page-nav, nav arrows, fullscreen toggle,
 *   in-place cover editing, preview mode, modals — is unchanged in
 *   behavior. The only state that had to change is "is the binder
 *   open/closed": BinderBookFlip has no concept of this separate from
 *   `view.page` (its cover pair flips purely off `spread`), so isOpen/
 *   isAnimatingOpen are gone and isClosed is now derived directly from
 *   spread === 0. handleOpenBinder/handleCloseBinder now just move
 *   `view.page`; BinderBookFlip's own transition handles the visual
 *   animation, with no transitionend bookkeeping needed on this side.
 *
 *   The fullscreen width-cap measurement (item from ISSUE #93) still
 *   needs a real element to measure. BinderBookFlip itself takes no
 *   ref/maxWidth prop and is left untouched, so the wrapper div
 *   (bookFlipWrapperRef) carries the actual `binder-book`/
 *   `binder-book-closed` classes themselves — giving it the original
 *   leather-edge styling, box-shadow, and width caps from binder.css
 *   for free — and is what gets measured/capped instead of the old
 *   book's own root div.
 *
 *   === Height: why an explicit aspect-ratio is needed now ===
 *   .binder-book never had its own height rule — it got its height
 *   implicitly, pushed up from content: BinderPage's .binder-page-grid
 *   sizes each row from the column width via each slot's
 *   `aspect-ratio: 2.5/3.5`, and that intrinsic grid height flows up
 *   through flex (.binder-book-page flex:1, .binder-book align-items:
 *   stretch) to become .binder-book's own height. BinderBookFlip's
 *   page faces are `position: absolute` (required for the flip
 *   transform), which contributes ZERO intrinsic height to any
 *   ancestor — so with BinderBookFlip as .binder-book's only child,
 *   nothing pushes .binder-book's height anymore; it would collapse to
 *   ~0 since .book-flip-container's height:100% resolves against
 *   nothing.
 *
 *   Fix: give .binder-book an explicit aspect-ratio, computed in JS
 *   from the SAME math the page grid already uses internally (slot
 *   aspect-ratio 2.5/3.5, binder.cols columns, binder.rows rows) —
 *   not an estimate. See bookAspectRatio below.
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

  // If navigated here from search with a specific page, open to that page.
  // pageNumber from slot is 1-based; spread = Math.ceil(pageNumber / 2).
  // Run only once on mount (empty deps) — user controls page after that.
  useEffect(() => {
    if (initialPage && initialPage > 0) {
      const spread = Math.ceil(initialPage / 2);
      view.goToPage(spread);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmDelete, setConfirmDelete] = useState(false);

  // === MIGRATION: "closed" is now purely spread === 0. BinderBookFlip's
  // cover pair flips off `spread` directly (isFlipped(0) = 0 < spread),
  // so there's no separate isOpen/isAnimatingOpen boolean to track on
  // this side anymore — view.page IS the open/closed state. ===
  const isClosed = view.page === 0;

  const coverEditor = useBinderCoverEditor({ binder, toast });

  // === FIX: this was a useEffect, which runs AFTER the browser has
  // already painted the render that triggered it — leaving a real,
  // not just theoretical, one-paint gap where isCover has already
  // flipped to false but isAnimatingCoverFlip hasn't caught up to
  // true yet. .binder-book's background (below) snapped to the solid
  // gradient during exactly that gap, for one frame, before the cover
  // had even started rotating — confirmed via screenshot showing solid
  // color filling the whole book the instant after clicking, cover
  // still flat/unrotated on top. useLayoutEffect runs synchronously
  // after DOM mutations but BEFORE paint, so the flag is already true
  // in the SAME paint where spread changes — no gap. The cleanup timer
  // that flips it back to false 700ms later stays on the normal async
  // path since "transition just finished" has no before-paint urgency
  // the way "transition just started" does.
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

  // === MIGRATION: open/close now just moves view.page. BinderBookFlip's
  // cover pair animates off spread on its own (CSS transition on
  // .book-page-pair), so there's no isAnimatingOpen flag and no
  // transitionend listener needed here anymore — the previous version's
  // whole reason for being (keeping a second book's cosmetic state in
  // sync with this one) no longer applies now that there's only one
  // book. ===
  const handleOpenBinder = () => {
    if (view.page === 0) {
      view.goToPage(1);
    }
  };

  const handleCloseBinder = () => {
    view.goToPage(0);
  };

  // === ISSUE #93 + aspect-ratio measurement extracted to useBinderFullscreen ===
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

  // Use preview slots when in preview mode, real slots otherwise.
  // === MIGRATION: leftSlotMap/rightSlotMap are gone — BinderBookFlip
  // builds its own per-page slot maps internally from the full
  // displaySlots array, so BinderView no longer needs to slice them
  // per-spread itself. ===
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

  // === ISSUE: editable page-number jump, replaces the thumbnails bar ===
  // === FIX (typing "1" landed on the cover, and the displayed page
  // number didn't match what was actually on screen): per
  // BinderBookFlip's own numbering (spread N: left=page(2N-2),
  // right=page(2N-1) for N>=1), page 1 belongs to spread 1 — it's a
  // normal right-hand page, not the cover. This used to special-case
  // pageNum<=1 to spread 0, which is the CLOSED cover, a different
  // thing entirely (reaching the cover is already handleCloseBinder's
  // job, not the page-number input's). Separately, the displayed page
  // number used `spread * 2`, which is 2 pages ahead of the real right-
  // hand page at that spread (2*spread - 1) — e.g. spread 1 (page 1
  // showing) displayed "2".
  //
  // ONE MORE EDGE CASE: when binder.pages is even, BinderBookFlip's own
  // last-pair special case (see its big header comment) flips the
  // final pair as soon as ITS OWN spread is reached rather than
  // strictly past it — so the final page (an even, back-face page)
  // actually appears one spread EARLIER than `spread * 2 - 1` would
  // predict, and that final spread's right side is empty (there's no
  // next pair to hand off to). lastPairSpreadIndex below mirrors
  // BinderBookFlip's own pagePairs.length exactly (same generating
  // condition), so both the displayed number and its inverse agree
  // with what's actually rendered at that spread instead of pointing
  // at a right-hand page that no longer exists there. ===
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

  // Exact inverse of currentDisplayPage's mapping. Works for every page
  // number with a single special case: binder.pages itself, when even,
  // maps to lastPairSpreadIndex (see comment above) rather than one
  // spread further, matching BinderBookFlip's own early-flip rule for
  // the final pair.
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

  // === Cover content passed into BinderBookFlip's cover pair. This is
  // now the ONLY copy of this markup — previously duplicated once for
  // the old book and once for the BinderBookFlip test harness. "Not yet
  // opened" is now spread === 0 (isCover) rather than the old
  // !isAnimatingOpen && !isOpen check, since there's no separate
  // animating-state to distinguish from "closed" anymore. ===
  // === FIX: .binder-cover-customize-btn's only visibility rule is
  // `.binder-cover-flip:hover .binder-cover-customize-btn` (see
  // cover-customizer.css) — that class lived on the OLD book's cover
  // wrapper, which no longer exists now that BinderBookFlip owns the
  // cover face. Restoring `binder-cover-flip` here, alongside
  // `binder-cover-frame`, gives that pre-existing hover rule something
  // to match again — no new CSS needed, just keeping the same class
  // name the rule already depends on. ===
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

        {/* === FIX (book position shifts slightly between open/closed):
            this used to be conditionally rendered ({isCover && ...}),
            which meant it was completely removed from the DOM once
            opened — removing a flex sibling reflows the whole row,
            shifting the book's centered position by however much
            space this label used to occupy. Always mounted now, with
            visibility toggled instead of the element itself, so its
            space in the flex row is permanently reserved and the book
            never moves regardless of open/closed state. === */}
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
            // Transparent — BinderBookFlip's own cover/back-cover
            // placeholder provide their own coverColor background now,
            // so this wrapper doesn't need to paint anything itself.
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