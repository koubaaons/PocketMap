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

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { BinderBookFlip } from './BinderBookFlip.jsx';
import { AddCardToBinderModal } from '../modals/AddCardToBinderModal.jsx';
import { SlotActionModal } from '../modals/SlotActionModal.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { CustomizerSticker } from '../modals/CustomizerSticker.jsx';
import { getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useBinderView } from '../../hooks/useBinderView.js';
import { useBinderFullscreen } from '../../hooks/useBinderFullscreen.js';
import { useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { createBinderSlot } from '../../types/index.js';
import { createSticker } from '../../types/index.js';
import { compressImage, compressStickerImage } from '../../utils/index.js';

export function BinderView({ binder, binderSlots, cardDefinitions, collections, templateFields, inventory, toast, onNavigate }) {
  const dispatch   = useDispatch();
  const view       = useBinderView(binder, binderSlots);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // === MIGRATION: "closed" is now purely spread === 0. BinderBookFlip's
  // cover pair flips off `spread` directly (isFlipped(0) = 0 < spread),
  // so there's no separate isOpen/isAnimatingOpen boolean to track on
  // this side anymore — view.page IS the open/closed state. ===
  const isClosed = view.page === 0;

  // === IN-PLACE COVER EDITING: replaces the old CustomizeCoverModal
  // popup. The cover already on screen becomes editable directly — the
  // upload/state logic below is moved VERBATIM from the modal, only the
  // container it renders into changed (the real cover's own slot,
  // referenced via coverRef, instead of a separate modal canvas). ===
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [draftStickers, setDraftStickers] = useState(binder.stickers ?? []);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [stickerUploadError, setStickerUploadError] = useState('');
  // BinderBookFlip's cover pair's own front face is what coverRef now
  // measures against (passed down as coverFrontContent below) — there's
  // only ever one cover face rendered now, so only one ref is needed.
  const coverRef = useRef(null);
  const stickerFileInputRef = useRef(null);
  const isUploadingStickerRef = useRef(false);

  const STICKER_MAX_WIDTH = 400;
  const MAX_STICKERS = 10;

  const handleEnterCoverEdit = () => {
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setIsEditingCover(true);
  };

  const handleCancelCoverEdit = () => {
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setIsEditingCover(false);
  };

  const handleSaveCoverEdit = () => {
    dispatch({ type: ACTIONS.BINDER_UPDATE, payload: { ...binder, stickers: draftStickers, updatedAt: Date.now() } });
    toast?.('Cover updated');
    setSelectedStickerId(null);
    setIsEditingCover(false);
  };

  const handleAddStickerClick = () => {
    if (draftStickers.length >= MAX_STICKERS) {
      setStickerUploadError(`Maximum ${MAX_STICKERS} stickers per cover.`);
      return;
    }
    stickerFileInputRef.current?.click();
  };

  const handleStickerFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (isUploadingStickerRef.current) return;
    isUploadingStickerRef.current = true;

    setIsUploadingSticker(true);
    setStickerUploadError('');
    try {
      const image_url = await compressStickerImage(file, STICKER_MAX_WIDTH);
      // Slight random offset around center so multiple stickers don't
      // land exactly on top of each other — still fully draggable
      // anywhere on the cover afterward.
      const offsetX = 50 + (Math.random() * 20 - 10);
      const offsetY = 50 + (Math.random() * 20 - 10);
      const { sticker, errors } = createSticker({ image_url, x: offsetX, y: offsetY, rotation: 0 });
      if (!sticker) {
        setStickerUploadError('Could not add that image — ' + errors.join(', '));
        return;
      }
      setDraftStickers(prev => [...prev, sticker]);
      setSelectedStickerId(sticker.id);
    } catch (err) {
      setStickerUploadError('Could not read that image. Try a different file.');
    } finally {
      setIsUploadingSticker(false);
      isUploadingStickerRef.current = false;
    }
  };

  const handleRemoveDraftSticker = (id) => {
    setDraftStickers(prev => prev.filter(s => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  const handleChangeDraftSticker = useCallback((id, patch) => {
    setDraftStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

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
  const isCover = spread === 0;
  const leftPageNum = isCover ? null : spread * 2;
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
  const coverFrontContent = (
    <div
      ref={coverRef}
      className={`binder-cover-flip binder-cover-frame ${isCover && !isEditingCover ? 'binder-cover-resting-tilt' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        // binder-cover-flip's stylesheet rule sets inset:-12px (it used
        // to be a 12px-oversized absolute hit-target around the old
        // book's cover). That class is reused here ONLY for its hover
        // selector — explicitly zeroing inset prevents that leftover
        // rule from shifting this box outward on every edge.
        inset: 0,
        backgroundColor: color,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
      }}
      onClick={isEditingCover ? (e) => e.stopPropagation() : undefined}
      onMouseDown={isEditingCover ? () => setSelectedStickerId(null) : undefined}
    >
      <div className="binder-cover-content">
        <div className="binder-cover-name">{binder.name}</div>
        <div className="binder-cover-meta">{binder.pages} pages · {binder.rows}×{binder.cols}</div>
      </div>

      {(isEditingCover ? draftStickers : (binder.stickers ?? [])).map(sticker => (
        <CustomizerSticker
          key={sticker.id}
          sticker={sticker}
          containerRef={coverRef}
          editable={isEditingCover}
          isSelected={isEditingCover && selectedStickerId === sticker.id}
          onSelect={isEditingCover ? () => setSelectedStickerId(sticker.id) : undefined}
          onChange={isEditingCover ? (patch) => handleChangeDraftSticker(sticker.id, patch) : undefined}
          onRemove={isEditingCover ? () => handleRemoveDraftSticker(sticker.id) : undefined}
        />
      ))}

      {isCover && !isEditingCover && (
        <button
          className="binder-cover-customize-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleEnterCoverEdit();
          }}
          aria-label="Customize cover"
        >
          ✎ Customize
        </button>
      )}

      {isEditingCover && (
        <div className="binder-cover-edit-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="binder-cover-edit-btn"
            onClick={handleAddStickerClick}
            disabled={isUploadingSticker || draftStickers.length >= MAX_STICKERS}
          >
            {isUploadingSticker ? 'Adding…' : `+ Sticker (${draftStickers.length}/${MAX_STICKERS})`}
          </button>
          <button type="button" className="binder-cover-edit-btn" onClick={handleCancelCoverEdit}>
            Cancel
          </button>
          <button type="button" className="binder-cover-edit-btn binder-cover-edit-btn-primary" onClick={handleSaveCoverEdit}>
            Save Cover
          </button>
        </div>
      )}

      {stickerUploadError && isEditingCover && (
        <p className="binder-cover-edit-error">{stickerUploadError}</p>
      )}

      <input
        ref={stickerFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleStickerFileSelected}
      />
    </div>
  );

  // Inside-of-cover (back face) — plain surface in the binder's color
  // family. Solid binder color with a soft inset gradient for depth,
  // echoing the cover front's own treatment.
  const coverBackContent = (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: color,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%)`,
      }}
    />
  );

  return (
    <div ref={rootRef} className={`binder-view-root ${isFullscreen ? 'binder-view-root-fullscreen' : ''}`}>

      {/* Topbar — hidden while closed, stays visible in fullscreen otherwise */}
      {!isClosed && (
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

          {/* === ISSUE #92: close binder — returns to the closed cover === */}
          <Button variant="ghost" size="sm" onClick={handleCloseBinder}>
            Close Binder
          </Button>

          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>
      )}

      {/* Page navigation — hidden while closed, same as topbar. Editable
          page number, replaces the old thumbnails bar entirely. Click
          the number, clear it, type a new page (1-binder.pages), press
          Enter or click away to jump. */}
      {!isClosed && (
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
      )}

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

        <div
          ref={bookFlipWrapperRef}
          className={`binder-book ${(isCover || isAnimatingCoverFlip) ? 'binder-book-closed' : ''}`}
          style={{
            aspectRatio: effectiveBookAspectRatio,
            // === FIX: .binder-book's 10px padding (binder.css) used to
            // be invisible because the OLD book's page divs filled that
            // padded interior edge-to-edge with their own matching
            // background + shadow — the padding gap and the page's own
            // edge were the same visual surface. BinderBookFlip supplies
            // its own complete framing (frame-halves, page-face border-
            // radii) independently, so that 10px gap is no longer
            // covered by anything matching — it showed up as a visible
            // second border ring between .binder-book's own rounded
            // pink edge and BinderBookFlip's inner content edge, 10px
            // further in. Zeroing it here lets BinderBookFlip's content
            // run flush to .binder-book's own edge, same as the single
            // border the original design intended.
            padding: 0,
            background: (isCover || isAnimatingCoverFlip)
              ? 'transparent'
              : `linear-gradient(135deg, ${color}dd 0%, ${color} 50%, ${color}bb 100%)`,
            ...((isCover || isAnimatingCoverFlip) ? { boxShadow: 'none' } : {}),
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
            coverFrontContent={coverFrontContent}
            coverBackContent={coverBackContent}
            onCoverClick={handleOpenBinder}
            isClickable={isCover && !isEditingCover}
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