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
import { ConfirmModal, Button } from '../ui/index.jsx';
import { BinderTopbar } from './BinderTopbar.jsx';
import { BinderPageNav } from './BinderPageNav.jsx';
import { BinderBookFlip } from './BinderBookFlip.jsx';
import { BinderDataProvider } from '../../contexts/BinderDataContext.jsx';
import { AddCardsPanel } from '../collections/AddCardsPanel.jsx';
import { InsertLibraryPanel } from '../collections/InsertLibraryPanel.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { SwapPagesModal } from '../modals/BinderModals.jsx';
import { ExportBinderModal } from '../modals/ExportBinderModal.jsx';
import { useCardDefinitionActions } from '../../hooks/useCardDefinitionActions.js';
import { useBinderCoverEditor } from '../../hooks/useBinderCoverEditor.js';
import { BinderCoverStickers } from './BinderCover.jsx';
import { BinderCustomizePanel } from './BinderCustomizePanel.jsx';
import { getOwnedFilledSlotCount } from '../../selectors/binderSelectors.js';
import { binderCapacity } from '../../utils/index.js';
import { buildOwnershipMap, buildInventoryGroupMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useBinderView } from '../../hooks/useBinderView.js';
import { useBinderFullscreen } from '../../hooks/useBinderFullscreen.js';
import { useCardInfoToggle } from '../../hooks/useCardInfoToggle.js';
import { useStore, useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { createBinderSlot, createBinderPanel } from '../../types/index.js';

export function BinderView({ toast, onNavigate, initialPage = null }) {
  const nav             = useStore(s => s.nav);
  const binders         = useStore(s => s.binders);
  const allBinderSlots  = useStore(s => s.binderSlots ?? []);
  const allBinderPanels = useStore(s => s.binderPanels ?? []);
  const binderInserts   = useStore(s => s.binderInserts ?? []);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const collections     = useStore(s => s.collections);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  const binder          = binders.find(b => b.id === nav.currentBinderId) ?? null;
  const binderSlots     = allBinderSlots.filter(s => s.binderId === binder?.id);
  const binderPanels    = allBinderPanels.filter(p => p.binderId === binder?.id);
  const dispatch   = useDispatch();
  const view       = useBinderView(binder, binderSlots);

  // If navigated here from search with a specific page, open to that page.
  // pageNumber from slot is 1-based. BinderBookFlip pairs content pages
  // as spread n = {front: page 2n-1, back: page 2n} (spread 0 is the
  // cover, on its own). So the page-number -> spread mapping is
  // floor(pageNumber / 2) + 1 for every pageNumber >= 1 — page 1 lands
  // on spread 1, pages 2-3 on spread 2, pages 4-5 on spread 3, etc.
  // NOTE: Math.ceil(pageNumber / 2) here was wrong for EVEN page
  // numbers. Page 4 is the back half of pair {3, 4}, which is spread
  // 3 — floor(4/2)+1 = 3 gives that correctly, but ceil(4/2) = 2 lands
  // one spread too early. That's why opening a search result on an
  // even page (e.g. "Cornelia" on page 4) always landed on the spread
  // before the card's actual page.
  // Run only once on mount (empty deps) — user controls page after that.
  useEffect(() => {
    if (initialPage && initialPage > 0) {
      const spread = Math.floor(initialPage / 2) + 1;
      view.goToPage(spread);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSwapPagesOpen, setIsSwapPagesOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  // === Michi Method support: combine mode — holds the computed
  // rectangle {pageNumber, startSlotIndex, spanCols, spanRows} once
  // "Combine" is clicked, until the confirmation modal resolves it
  // into an actual panel (or is cancelled). ===
  const [isLibraryPanelOpen, setIsLibraryPanelOpen] = useState(false);

  // === CHANGED: the library used to close automatically whenever
  // combine mode ended, on the theory that it only made sense while
  // combining. Per explicit design decision, that's backwards —
  // Combine Mode is purely for combining slots; adding an image to an
  // already-blank combined panel is a normal action available from
  // any mode (view, preview, whatever), same as clicking any other
  // empty thing in the binder. The panel now only ever closes via its
  // own "Done" button.

  // === MIGRATION: "closed" is now purely spread === 0. BinderBookFlip's
  // cover pair flips off `spread` directly (isFlipped(0) = 0 < spread),
  // so there's no separate isOpen/isAnimatingOpen boolean to track on
  // this side anymore — view.page IS the open/closed state. ===
  const isClosed = view.page === 0;

  const coverEditor = useBinderCoverEditor({ binder, toast });
  const { showCardInfo, toggle: toggleCardInfo } = useCardInfoToggle();

  // === Home's "Customize" shortcut sets nav.autoOpenCustomize so the
  // binder opens straight into customize mode instead of requiring a
  // separate click once there. Only meant to fire once, right after
  // that specific navigation — cleared immediately after use so
  // navigating here normally afterward (sidebar, back button, etc.)
  // doesn't keep re-triggering it. ===
  useEffect(() => {
    if (nav.autoOpenCustomize) {
      coverEditor.handleEnterCoverEdit();
      dispatch({ type: ACTIONS.NAV_SET, payload: { ...nav, autoOpenCustomize: false } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.autoOpenCustomize]);

  // === Card editing from within a binder now happens inline inside
  // CardDetailModal itself (see that file) — this just needs the
  // save function to pass through as its onEdit prop, no separate
  // edit-state tracking needed here anymore. ===
  const { handleUpdate: handleUpdateCard } = useCardDefinitionActions(toast, {});

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
  // === Pre-open slide: when clicking the closed cover to open it, the
  // binder first slides right (same direction/distance as opening the
  // Customize panel), THEN the actual open animation (unchanged, still
  // just view.goToPage(1) triggering BinderBookFlip's own flip) fires
  // once the slide has visually finished. isPreOpenSliding only
  // controls this pre-step; it has no effect on the flip itself. ===
  const PRE_OPEN_SLIDE_MS = 400;
  const [isPreOpenSliding, setIsPreOpenSliding] = useState(false);

  const handleOpenBinder = () => {
    if (view.page !== 0 || isPreOpenSliding) return;
    setIsPreOpenSliding(true);
    setTimeout(() => {
      view.goToPage(1);
      setIsPreOpenSliding(false);
    }, PRE_OPEN_SLIDE_MS);
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
  const inventoryGroupMap = useMemo(() => buildInventoryGroupMap(inventory), [inventory]);

  const cardDefMap = useMemo(() => {
    const map = {};
    cardDefinitions.forEach(cd => { map[cd.id] = cd; });
    return map;
  }, [cardDefinitions]);

  const binderInsertMap = useMemo(() => {
    const map = {};
    binderInserts.forEach(i => { map[i.id] = i; });
    return map;
  }, [binderInserts]);

  // Use preview slots when in preview mode, real slots otherwise.
  // === MIGRATION: leftSlotMap/rightSlotMap are gone — BinderBookFlip
  // builds its own per-page slot maps internally from the full
  // displaySlots array, so BinderView no longer needs to slice them
  // per-spread itself. ===
  const displaySlots = view.activeSlots;

  const spread       = view.page;
  // Keep in sync with useBinderView.js / BinderBookFlip.jsx — see the
  // "FIX: last-2-pages-skipped bug" comment in BinderBookFlip.jsx.
  const totalSpreads = Math.floor(binder.pages / 2) + 2;

  const filled   = getOwnedFilledSlotCount(binderSlots, binder.id, inventory, binderPanels);
  const capacity = binderCapacity(binder, binderPanels);

  const { handleAddToSlot, handleRemoveFromSlot, handleAddPage, handleSwapPages } =
    useBinderSlotActions(toast, {
      onRemoveSuccess: view.closeSlotAction,
    });

  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess:   view.closeSlotAction,
      // === CHANGED (quantity tracking): this used to always close
      // CardDetailModal on any successful unown. With multiple copies
      // now real, removing ONE copy shouldn't close the whole modal
      // if others remain — CardDetailModal's own confirm handler
      // already decides whether to close itself based on remaining
      // quantity, so this callback would just fight that decision.
    });

  // ── Edit mode handlers ──────────────────────────────────────────────────

  const handleDropCardOnSlot = (pageNumber, slotIndex, dragPayload) => {
    const cardDef = cardDefMap[dragPayload?.cardDefId];
    if (!cardDef) return; // malformed or stale drag payload — nothing to place

    if (view.isPreviewMode) {
      const { slot } = createBinderSlot({
        binderId:     binder.id,
        cardDefId:    cardDef.id,
        collectionId: cardDef.collectionId,
        pageNumber,
        slotIndex,
        inventoryItemId: null, // reducer/preview both auto-pick an unplaced copy
      });
      if (slot) {
        view.previewAddSlot(slot);
        toast('Card added to preview');
      }
    } else {
      handleAddToSlot({
        binderId:     binder.id,
        cardDefId:    cardDef.id,
        collectionId: cardDef.collectionId,
        pageNumber,
        slotIndex,
        chosenCopyId: null, // reducer auto-picks an unplaced copy
      });
    }
  };

  // === New: hover-triggered ✓/○ toggle directly on a filled slot,
  // mirroring CardGridItem.jsx's own toggle circle in the Collection
  // grid — same underlying handleOwn/handleUnown, just reachable
  // without opening the full SlotActionModal first.
  //
  // === FIX (real bug reported directly by the user): copies are
  // supposed to act independently — unowning the copy in one slot
  // shouldn't affect a different copy of the same card placed
  // elsewhere (e.g. an English copy and a Chinese copy of the same
  // card). This used to look up ownershipMap[cardDef.id] — the
  // generic "earliest acquired" REPRESENTATIVE copy for the card
  // overall, not necessarily the one actually sitting in this slot.
  // Now uses slot.inventoryItemId (the specific copy THIS slot is
  // linked to) when available, falling back to the representative
  // only for pre-migration slots that never got a specific link.
  // Symmetrically, when OWNING from an unowned placeholder slot, the
  // newly-created copy is now linked to this exact slot
  // (linkToSlotId), so it doesn't end up unlinked either. ===
  const handleToggleOwnedInSlot = (cardDef, slot = null) => {
    const specificItem = slot?.inventoryItemId
      ? (inventoryGroupMap[cardDef.id] ?? []).find(inv => inv.id === slot.inventoryItemId)
      : null;
    const inventoryItem = specificItem ?? ownershipMap[cardDef.id];
    if (inventoryItem) {
      handleUnown(inventoryItem.id);
    } else {
      handleOwn({ cardDefId: cardDef.id, collectionId: cardDef.collectionId, linkToSlotId: slot?.id });
    }
  };

  const handleDeleteBinder = () => {
    dispatch({ type: ACTIONS.BINDER_DELETE, payload: { binderId: binder.id } });
    toast(`"${binder.name}" moved to trash`);
    setConfirmDelete(false);
    onNavigate('home'); // navigate away immediately, don't wait for App.jsx guard
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
  const isCover = spread === 0;
  // The last navigable spread — must match totalSpreads - 1 above (and
  // useBinderView.js / BinderBookFlip.jsx). For an even page count the
  // last page has no partner and gets its own final spread; for an odd
  // count it shares a spread with the page before it.
  const lastPairSpreadIndex = Math.floor(binder.pages / 2) + 1;
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

  // Exact inverse of currentDisplayPage's mapping — see the search-jump
  // useEffect above for the same floor(pageNumber / 2) + 1 formula and
  // why it's correct for every page number, even and odd alike. No
  // special case needed: e.g. binder.pages = 10 -> floor(10/2)+1 = 6,
  // which already equals lastPairSpreadIndex above.
  const pageNumberToSpread = (pageNum) => Math.floor(pageNum / 2) + 1;

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

  // === Michi Method support: combine mode ===
  const handleUncombinePanel = (panel) => {
    dispatch({ type: ACTIONS.BINDER_PANEL_REMOVE, payload: { panelId: panel.id } });
    toast('Slots uncombined');
  };

  const handleUpdatePanel = (panelId, patch) => {
    dispatch({ type: ACTIONS.BINDER_PANEL_UPDATE, payload: { id: panelId, ...patch } });
  };

  // === CHANGED: combining slots used to open a modal asking "real
  // card or decorative image?" — jumbo/oversized real cards aren't an
  // actual use case here, so that choice was just an extra click for
  // something that was always going to be "decorative image" anyway.
  // Confirming a combine now goes straight to creating the panel
  // blank and opening the library panel to fill it, no modal at all.
  const handleConfirmCombine = (rect) => {
    const { panel, errors } = createBinderPanel({
      binderId: binder.id,
      pageNumber: rect.pageNumber,
      startSlotIndex: rect.startSlotIndex,
      spanCols: rect.spanCols,
      spanRows: rect.spanRows,
      panelType: 'insert',
      insertId: null,
      userId: binder.userId,
    });
    if (!panel) { console.error('Panel creation failed:', errors); return; }

    dispatch({ type: ACTIONS.BINDER_PANEL_ADD, payload: panel });
    toast('Slots combined');
    view.clearCombineSelection();
    // Stay in combine mode (so the user can combine another group
    // right away without re-entering — see clearCombineSelection
    // above) and open the library so there's a fresh blank panel
    // ready for an image immediately. The library itself no longer
    // cares whether combine mode is active or not — see this
    // component's isLibraryPanelOpen comment for why.
    setIsLibraryPanelOpen(true);
  };

  const handleClickPanel = (panel) => {
    if (panel.panelType === 'card') {
      const cardDef = cardDefMap[panel.cardDefId];
      if (cardDef) view.openCardDetail(cardDef);
      return;
    }
    // A blank insert-type panel ("Click to add an image") opens the
    // library so the user can drag something onto it right away —
    // one already has an image, editing/replacing it happens via the
    // panel's own uncombine + re-add flow for now, not this.
    if (panel.panelType === 'insert' && !panel.insertId) {
      setIsLibraryPanelOpen(true);
    }
  };

  const makePageHandlers = (pageNumber) => ({
    onClickEmpty: (slotIndex) => {
      if (view.isCombineMode) { view.toggleSlotForCombine(pageNumber, slotIndex); return; }
      return view.isPreviewMode
        ? handleEmptyClickInPreview(slotIndex, pageNumber)
        : view.openAddToSlot(slotIndex, pageNumber);
    },
    // === Clicking a card in a binder now goes straight to the same
    // card-detail experience Collections uses (card floats, details
    // slide out beside it) instead of first opening SlotActionModal
    // and requiring an extra "View Card Details" click. Preview mode
    // keeps its own separate click behavior — that's for selecting
    // slots to move cards between, a different workflow entirely. ===
    onClickSlot: (slot, cardDef) => {
      if (view.isCombineMode) {
        toast('Please select empty slots — a slot with a card in it can\'t be combined', 'error');
        return;
      }
      return view.isPreviewMode
        ? handleSlotClickInPreview(slot, cardDef)
        : view.openCardDetail(cardDef);
    },
    onToggleOwned: handleToggleOwnedInSlot,
    onRemove: (slot) => handleRemoveFromSlot(slot.id),
    onDropEmpty: (view.addingToSlot && !view.isCombineMode)
      ? (slotIndex, payload) => handleDropCardOnSlot(pageNumber, slotIndex, payload)
      : undefined,
    pagePanels: binderPanels.filter(p => p.pageNumber === pageNumber),
    binderInsertMap,
    onClickPanel: handleClickPanel,
    onUncombinePanel: handleUncombinePanel,
    onUpdatePanel: handleUpdatePanel,
    onDropInsert: (panelId, insertId) => handleUpdatePanel(panelId, { insertId }),
    isCombineMode: view.isCombineMode,
    combineSelection: view.combineSelection.filter(s => s.pageNumber === pageNumber).map(s => s.slotIndex),
    getCombineRectangle: view.getCombineRectangle,
    onClearCombineSelection: view.clearCombineSelection,
    onConfirmCombine: (rect) => {
      const stillAllEmpty = view.combineSelection.every(({ pageNumber: pn, slotIndex: si }) =>
        !allBinderSlots.some(s => s.binderId === binder.id && s.pageNumber === pn && s.slotIndex === si && s.cardDefId)
      );
      if (!stillAllEmpty) {
        toast('One of the selected slots now has a card in it — please reselect empty slots', 'error');
        view.exitCombineMode();
        return;
      }
      handleConfirmCombine(rect);
    },
  });

  // Cover content passed into BinderBookFlip's cover pair. "Not yet
  // opened" is spread === 0 (isCover).
  return (
    <div ref={rootRef} className={`binder-view-root ${isFullscreen ? 'binder-view-root-fullscreen' : ''}`}>

      {/* Topbar — always visible now, greyed out while closed except the
          fullscreen toggle, so fullscreen works even on the closed
          cover. Opens fully interactive once the binder opens. */}
      <BinderTopbar
        binder={binder}
        color={color}
        isClosed={isClosed}
        filled={filled}
        capacity={capacity}
        isPreviewMode={view.isPreviewMode}
        onExitPreviewMode={view.exitPreviewMode}
        onEnterPreviewMode={view.enterPreviewMode}
        onSaveLayout={handleSaveLayout}
        onAddPage={() => handleAddPage(binder.id)}
        onSwapPages={() => setIsSwapPagesOpen(true)}
        onExportBinder={() => setIsExportOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onCloseBinder={handleCloseBinder}
        onDeleteRequest={() => setConfirmDelete(true)}
        isCombineMode={view.isCombineMode}
        onEnterCombineMode={view.enterCombineMode}
        onExitCombineMode={view.exitCombineMode}
        isLibraryPanelOpen={isLibraryPanelOpen}
        onToggleLibraryPanel={() => setIsLibraryPanelOpen(v => !v)}
        showCardInfo={showCardInfo}
        onToggleCardInfo={toggleCardInfo}
      />

      {/* Page navigation — greyed out while closed, same as topbar. */}
      <BinderPageNav
        isClosed={isClosed}
        pageInputValue={pageInputValue}
        totalPages={binder.pages}
        currentDisplayPage={currentDisplayPage}
        onFocusInput={() => setIsEditingPageInput(true)}
        onChangeInput={setPageInputValue}
        onCommitInput={commitPageInput}
        onResetInput={setPageInputValue}
      />

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
          className={`binder-book ${(isCover || isAnimatingCoverFlip) ? 'binder-book-closed' : ''} ${(isCover && !coverEditor.isEditingCover && !isPreOpenSliding) ? 'binder-book-centered' : ''}`}
          style={{
            position: 'relative',
            aspectRatio: effectiveBookAspectRatio,
            padding: 0,
            // Transparent — BinderBookFlip's own cover/back-cover
            // placeholder provide their own coverColor background now,
            // so this wrapper doesn't need to paint anything itself.
            background: 'transparent',
            boxShadow: 'none',
            // Set here (not just inside BinderBookFlip) so
            // BinderCustomizePanel — a sibling of BinderBookFlip, not
            // a descendant of it — can also read this custom property
            // for its own gradient/glow.
            '--cover-color': coverEditor.isEditingCover ? coverEditor.draftColor : color,
            ...(fullscreenMaxBookWidth ? { maxWidth: `${fullscreenMaxBookWidth}px` } : {}),
          }}
        >
          {/* Pulsing glow behind the binder — a separate element, not
              on .binder-book itself, since that element has
              boxShadow:'none' set inline above and inline styles
              always beat a stylesheet animation targeting the same
              property on the same element. Colored from --cover-color
              (set above). Matches the cover's own extended footprint
              (right half) while closed, or the full book width while
              open — see the two size variants in animations.css. */}
          {isCover && <div className="binder-cover-glow-pulse" />}

          {/* Customize button/panel — absolutely positioned within the
              binder's OWN box (which is already sized for a full
              two-page spread, even while closed, since it uses the
              same aspect-ratio math). The left half is already empty
              here while closed; this overlays it directly instead of
              reserving separate flex space outside the binder, which
              was forcing the whole row wider and shrinking the binder
              itself to compensate. */}
          {isCover && !isAnimatingCoverFlip && !isPreOpenSliding && <BinderCustomizePanel isCover={isCover} {...coverEditor} />}
          <BinderDataProvider value={{ cardDefMap, ownershipMap, inventoryGroupMap, allBinderSlots, allBinderPanels }}>
            <BinderBookFlip
              binder={binder}
              binderSlots={displaySlots}
              spread={spread}
              isPreviewMode={view.isPreviewMode}
              selectedSlot={view.selectedSlot}
              makePageHandlers={makePageHandlers}
              coverColor={coverEditor.isEditingCover ? coverEditor.draftColor : color}
              pageColor={coverEditor.isEditingCover ? coverEditor.draftPageColor : (binder.page_color ?? '#1e1e1e')}
              isFrontCoverTransparent={coverEditor.isPreviewingPageColor}
              coverFrontContent={<BinderCoverStickers binder={binder} {...coverEditor} />}
              onCoverClick={handleOpenBinder}
              isClickable={isCover && !coverEditor.isEditingCover}
            />
          </BinderDataProvider>
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
        <AddCardsPanel
          binder={binder}
          cardDefinitions={cardDefinitions}
          collections={collections}
          inventory={inventory}
          allBinderSlots={allBinderSlots}
          allBinderPanels={allBinderPanels}
          onClose={view.closeAddToSlot}
        />
      )}

      {isLibraryPanelOpen && (
        <InsertLibraryPanel
          binderInserts={binderInserts}
          toast={toast}
          onClose={() => setIsLibraryPanelOpen(false)}
        />
      )}

      {view.viewingCardDef && (
        <CardDetailModal
          card={view.viewingCardDef}
          inventoryItems={inventoryGroupMap[view.viewingCardDef.id] ?? []}
          templateFields={cardTemplateFields}
          onOwn={() => handleOwn({ cardDefId: view.viewingCardDef.id, collectionId: view.viewingCardDef.collectionId })}
          onUnown={(inventoryId) => handleUnown(inventoryId)}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={handleUpdateCard}
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

      {isSwapPagesOpen && (
        <SwapPagesModal
          binder={binder}
          onSubmit={(pageA, pageB) => handleSwapPages(binder.id, pageA, pageB)}
          onClose={() => setIsSwapPagesOpen(false)}
        />
      )}

      {isExportOpen && (
        <ExportBinderModal
          binder={binder}
          allBinderSlots={allBinderSlots}
          allBinderPanels={allBinderPanels}
          cardDefMap={cardDefMap}
          binderInsertMap={binderInsertMap}
          inventoryGroupMap={inventoryGroupMap}
          toast={toast}
          onClose={() => setIsExportOpen(false)}
        />
      )}

    </div>
  );
}