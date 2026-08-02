// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderView.js.
 *
 * First real hook test in this project — components/ and hooks/ had
 * zero test coverage before this, flagged during a full code audit as
 * a real gap, since several of this app's actual bugs (the page-skip
 * math this file's own header documents, the preview-mode swap
 * stale-reference bug) lived in exactly this untested half of the app.
 * Uses @testing-library/react's renderHook/act, added as a real
 * dependency for this — there was previously no way to test a stateful
 * React hook in isolation at all.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinderView } from '../useBinderView.js';

function makeBinder(pages) {
  return { id: 'binder-1', pages };
}

function makeSlot(overrides = {}) {
  return { id: 'slot-1', binderId: 'binder-1', pageNumber: 1, slotIndex: 0, cardDefId: 'card-1', inventoryItemId: null, ...overrides };
}

describe('useBinderView — totalSpreads / page math', () => {
  // Directly exercises the exact formula whose old, wrong version
  // caused the real page-skip bug: an even-page-count binder used to
  // skip its last two pages entirely. totalSpreads itself isn't
  // returned by the hook, but goToPage's clamping against it is
  // observable via `page`, which is what these assert against.

  it('a 9-page (odd) binder allows navigating up to spread 5 (cover + 4 content spreads + none left over)', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(9), []));
    act(() => result.current.goToPage(999)); // try to overshoot
    // Math.floor(9/2)+2 = 6 spreads total -> max valid page index is 5
    expect(result.current.page).toBe(5);
  });

  it('a 10-page (even) binder allows navigating up to spread 6 — the extra spread the original bug never granted', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.goToPage(999));
    // Math.floor(10/2)+2 = 7 spreads total -> max valid page index is 6
    // (the old Math.ceil(pages/2)+1 formula gave only 6 spreads here,
    // making page index 5 the max — one spread short, which is
    // exactly how the last two pages went missing)
    expect(result.current.page).toBe(6);
  });

  it('goToPage never goes below 0 regardless of how negative the request is', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.goToPage(-50));
    expect(result.current.page).toBe(0);
  });
});

describe('useBinderView — preview mode', () => {
  it('entering preview mode copies the current real slots into local state', () => {
    const slots = [makeSlot({ id: 'a' }), makeSlot({ id: 'b', slotIndex: 1 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));

    act(() => result.current.enterPreviewMode());

    expect(result.current.isPreviewMode).toBe(true);
    expect(result.current.previewSlots).toHaveLength(2);
    expect(result.current.activeSlots).toBe(result.current.previewSlots);
  });

  it('exiting preview mode discards the local copy — real slots are used again', () => {
    const slots = [makeSlot({ id: 'a' })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));

    act(() => result.current.enterPreviewMode());
    act(() => result.current.exitPreviewMode());

    expect(result.current.isPreviewMode).toBe(false);
    expect(result.current.previewSlots).toBe(null);
    expect(result.current.activeSlots).toBe(slots);
  });

  it('previewMoveSlot swaps two slots by id — moving slot takes the target position and vice versa', () => {
    const slots = [
      makeSlot({ id: 'a', pageNumber: 1, slotIndex: 0 }),
      makeSlot({ id: 'b', pageNumber: 1, slotIndex: 5 }),
    ];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());

    // Move 'a' into where 'b' currently sits (pageNumber/slotIndex of
    // the target), swapping the two.
    act(() => result.current.previewMoveSlot('a', 'b', 1, 5));

    const a = result.current.previewSlots.find(s => s.id === 'a');
    const b = result.current.previewSlots.find(s => s.id === 'b');
    expect(a.pageNumber).toBe(1);
    expect(a.slotIndex).toBe(5);
    expect(b.pageNumber).toBe(1);
    expect(b.slotIndex).toBe(0); // took over 'a's original position
  });

  it('previewMoveSlot resolves both sides by id, not by re-deriving position after the fact — a second swap right after the first still targets the correct, current slot', () => {
    // Regression test for the exact bug documented in this file's own
    // header: multiple swaps in quick succession used to be able to
    // silently move the wrong card if anything re-derived "what's at
    // this position" using stale coordinates instead of the id
    // passed at click time. Doing two swaps back to back here and
    // checking the final state is correct is the most direct way to
    // confirm that can't happen anymore.
    const slots = [
      makeSlot({ id: 'a', pageNumber: 1, slotIndex: 0 }),
      makeSlot({ id: 'b', pageNumber: 1, slotIndex: 1 }),
      makeSlot({ id: 'c', pageNumber: 1, slotIndex: 2 }),
    ];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewMoveSlot('a', 'b', 1, 1)); // a <-> b
    act(() => result.current.previewMoveSlot('a', 'c', 1, 2)); // a (now at slot 1) <-> c

    const byId = id => result.current.previewSlots.find(s => s.id === id);
    expect(byId('a').slotIndex).toBe(2); // a ended up where c was
    expect(byId('b').slotIndex).toBe(0); // b took a's original spot from the first swap
    expect(byId('c').slotIndex).toBe(1); // c took over a's post-first-swap position
  });

  it('previewMoveSlot moving to an empty destination (no targetSlotId) relocates without touching any other slot', () => {
    const slots = [makeSlot({ id: 'a', pageNumber: 1, slotIndex: 0 }), makeSlot({ id: 'b', pageNumber: 1, slotIndex: 1 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewMoveSlot('a', null, 1, 8));

    expect(result.current.previewSlots.find(s => s.id === 'a').slotIndex).toBe(8);
    expect(result.current.previewSlots.find(s => s.id === 'b').slotIndex).toBe(1); // untouched
  });

  it('previewAddSlot appends a new slot to the preview-local copy without touching the real slots passed in', () => {
    const slots = [makeSlot({ id: 'a' })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewAddSlot(makeSlot({ id: 'new', slotIndex: 3 })));

    expect(result.current.previewSlots).toHaveLength(2);
    expect(slots).toHaveLength(1); // the real array passed in is untouched
  });

  it('previewRemoveSlot removes a slot from the preview-local draft only, without touching the real slots passed in — requested directly, since Plan mode previously had no way to remove a card at all', () => {
    const slots = [makeSlot({ id: 'a' }), makeSlot({ id: 'b', slotIndex: 1 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewRemoveSlot('a'));

    expect(result.current.previewSlots.map(s => s.id)).toEqual(['b']);
    expect(slots).toHaveLength(2); // the real array passed in is untouched
  });

  it('previewRemoveSlot clears selectedSlot if the removed slot was the one currently selected for a move', () => {
    const slots = [makeSlot({ id: 'a' })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());
    act(() => result.current.selectSlotForMove(slots[0]));

    act(() => result.current.previewRemoveSlot('a'));

    expect(result.current.selectedSlot).toBe(null);
  });

  it('previewRemoveSlot leaves selectedSlot untouched if a DIFFERENT slot is removed', () => {
    const slots = [makeSlot({ id: 'a' }), makeSlot({ id: 'b', slotIndex: 1 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots));
    act(() => result.current.enterPreviewMode());
    act(() => result.current.selectSlotForMove(slots[0])); // selects 'a'

    act(() => result.current.previewRemoveSlot('b'));

    expect(result.current.selectedSlot?.id).toBe('a');
  });
});

describe('useBinderView — combine mode selection', () => {
  it('toggleSlotForCombine accumulates multiple selections on the same page', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());

    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(1, 1));

    expect(result.current.combineSelection).toEqual([
      { pageNumber: 1, slotIndex: 0 },
      { pageNumber: 1, slotIndex: 1 },
    ]);
  });

  it('toggling an already-selected slot removes it from the selection', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());

    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(1, 0)); // toggle off

    expect(result.current.combineSelection).toEqual([]);
  });

  it('selecting a slot on a DIFFERENT page resets the selection to just that slot, rather than mixing pages', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());

    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(2, 3)); // different page

    expect(result.current.combineSelection).toEqual([{ pageNumber: 2, slotIndex: 3 }]);
  });

  it('clearCombineSelection empties the selection without exiting combine mode', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    act(() => result.current.toggleSlotForCombine(1, 0));

    act(() => result.current.clearCombineSelection());

    expect(result.current.combineSelection).toEqual([]);
    expect(result.current.isCombineMode).toBe(true); // still in combine mode
  });

  it('exitCombineMode also clears the selection', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    act(() => result.current.toggleSlotForCombine(1, 0));

    act(() => result.current.exitCombineMode());

    expect(result.current.isCombineMode).toBe(false);
    expect(result.current.combineSelection).toEqual([]);
  });
});

describe('useBinderView — getCombineRectangle', () => {
  const COLS = 3; // a 3-wide grid for all cases below

  it('returns null when fewer than 2 slots are selected', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    act(() => result.current.toggleSlotForCombine(1, 0));

    expect(result.current.getCombineRectangle(COLS)).toBe(null);
  });

  it('returns null when the selection has a gap (not a solid rectangle)', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    // indices 0 and 2 in a 3-wide grid — same row, but index 1 between them isn't selected
    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(1, 2));

    expect(result.current.getCombineRectangle(COLS)).toBe(null);
  });

  it('returns the correct rectangle for a valid 2x2 selection', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    // 3-wide grid, indices 0,1 (row 0) and 3,4 (row 1) form a solid 2x2 block
    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(1, 1));
    act(() => result.current.toggleSlotForCombine(1, 3));
    act(() => result.current.toggleSlotForCombine(1, 4));

    expect(result.current.getCombineRectangle(COLS)).toEqual({
      pageNumber: 1,
      startSlotIndex: 0,
      spanCols: 2,
      spanRows: 2,
    });
  });

  it('returns the correct rectangle for a 1x3 horizontal strip', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.enterCombineMode());
    act(() => result.current.toggleSlotForCombine(1, 0));
    act(() => result.current.toggleSlotForCombine(1, 1));
    act(() => result.current.toggleSlotForCombine(1, 2));

    expect(result.current.getCombineRectangle(COLS)).toEqual({
      pageNumber: 1,
      startSlotIndex: 0,
      spanCols: 3,
      spanRows: 1,
    });
  });
});

describe('useBinderView — panel draft (Combine/Uncombine/Swap Pages staged in Plan mode)', () => {
  function makePanel(overrides = {}) {
    return { id: 'panel-1', binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, panelType: 'insert', ...overrides };
  }

  it('enterPreviewMode clones binderPanels into the local draft, without touching the real array passed in', () => {
    const panels = [makePanel()];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());

    expect(result.current.previewPanels).toEqual(panels);
    expect(result.current.previewPanels).not.toBe(panels); // a real clone, not the same array reference
  });

  it('activePanels reflects the real binderPanels when not in preview mode', () => {
    const panels = [makePanel()];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));

    expect(result.current.activePanels).toBe(panels);
  });

  it('previewAddPanel appends a new panel to the draft only, leaving the real array passed in untouched', () => {
    const panels = [makePanel({ id: 'a' })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewAddPanel(makePanel({ id: 'new', startSlotIndex: 4 })));

    expect(result.current.previewPanels).toHaveLength(2);
    expect(panels).toHaveLength(1);
  });

  it('previewRemovePanel (uncombine) removes a panel from the draft only, leaving the real array passed in untouched', () => {
    const panels = [makePanel({ id: 'a' }), makePanel({ id: 'b', startSlotIndex: 2 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewRemovePanel('a'));

    expect(result.current.previewPanels.map(p => p.id)).toEqual(['b']);
    expect(panels).toHaveLength(2);
  });

  it('previewUpdatePanel patches a panel in the draft only — the actual fix for a real bug where assigning an image to a combine-created panel silently did nothing, since that panel only existed in the draft, not yet the real store BINDER_PANEL_UPDATE was dispatching against', () => {
    const panels = [makePanel({ id: 'a', insertId: null })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());
    act(() => result.current.previewAddPanel(makePanel({ id: 'new-combine', insertId: null })));

    act(() => result.current.previewUpdatePanel('new-combine', { insertId: 'insert-1' }));

    expect(result.current.previewPanels.find(p => p.id === 'new-combine').insertId).toBe('insert-1');
    expect(result.current.previewPanels.find(p => p.id === 'a').insertId).toBe(null); // untouched
    expect(panels[0].insertId).toBe(null); // the real array passed in is untouched
  });

  it('previewUpdatePanel also works for repositioning an image on an already-existing panel, not just a newly-combined one', () => {
    const panels = [makePanel({ id: 'a', imageX: 50, imageY: 50, imageScale: 1 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewUpdatePanel('a', { imageX: 30, imageY: 70 }));

    const updated = result.current.previewPanels.find(p => p.id === 'a');
    expect(updated.imageX).toBe(30);
    expect(updated.imageY).toBe(70);
    expect(updated.imageScale).toBe(1); // untouched field preserved
  });

  it('previewSwapPages swaps pageNumber for both slots AND panels on the two given pages, in the draft only', () => {
    const slots = [makeSlot({ id: 's1', pageNumber: 1 }), makeSlot({ id: 's2', pageNumber: 2, slotIndex: 1 })];
    const panels = [makePanel({ id: 'p1', pageNumber: 1 }), makePanel({ id: 'p2', pageNumber: 2 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), slots, panels));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewSwapPages(1, 2));

    expect(result.current.previewSlots.find(s => s.id === 's1').pageNumber).toBe(2);
    expect(result.current.previewSlots.find(s => s.id === 's2').pageNumber).toBe(1);
    expect(result.current.previewPanels.find(p => p.id === 'p1').pageNumber).toBe(2);
    expect(result.current.previewPanels.find(p => p.id === 'p2').pageNumber).toBe(1);

    // The real arrays passed in are untouched
    expect(slots[0].pageNumber).toBe(1);
    expect(panels[0].pageNumber).toBe(1);
  });

  it('previewSwapPages leaves anything on an unrelated page completely untouched', () => {
    const panels = [makePanel({ id: 'p1', pageNumber: 5 })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));
    act(() => result.current.enterPreviewMode());

    act(() => result.current.previewSwapPages(1, 2));

    expect(result.current.previewPanels.find(p => p.id === 'p1').pageNumber).toBe(5);
  });

  it('enterPreviewMode followed immediately by previewRemovePanel in the same synchronous call correctly removes the panel — the exact sequence BinderView.jsx uses to auto-enter Plan mode when uncombining from outside it, worth confirming directly rather than trusting React\'s batching by reasoning alone', () => {
    const panels = [makePanel({ id: 'a' })];
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], panels));

    act(() => {
      result.current.enterPreviewMode();
      result.current.previewRemovePanel('a');
    });

    expect(result.current.previewPanels).toEqual([]);
  });

  it('enterPreviewMode followed immediately by previewAddPanel in the same synchronous call correctly adds the panel — the same sequence used when auto-entering Plan mode to fill a blank combined slot', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), [], []));

    act(() => {
      result.current.enterPreviewMode();
      result.current.previewAddPanel(makePanel({ id: 'new' }));
    });

    expect(result.current.previewPanels.map(p => p.id)).toEqual(['new']);
  });
});

describe('useBinderView — isAddPanelOpen / addingToSlot (real feature: the add-cards panel staying open across multiple click-to-place placements)', () => {
  it('openAddToSlot sets both isAddPanelOpen and addingToSlot together', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));

    act(() => result.current.openAddToSlot(3, 1));

    expect(result.current.isAddPanelOpen).toBe(true);
    expect(result.current.addingToSlot).toEqual({ slotIndex: 3, pageNumber: 1 });
  });

  it('clearAddingToSlotTarget clears ONLY the targeted slot, leaving isAddPanelOpen true — the actual behavior requested: after placing a card, the panel stays open with nothing selected, rather than closing or guessing a next slot', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.openAddToSlot(3, 1));

    act(() => result.current.clearAddingToSlotTarget());

    expect(result.current.isAddPanelOpen).toBe(true);
    expect(result.current.addingToSlot).toBeNull();
  });

  it('closeAddToSlot (the explicit close, e.g. the ✕ button) clears both — a full close, not just clearing the target', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.openAddToSlot(3, 1));

    act(() => result.current.closeAddToSlot());

    expect(result.current.isAddPanelOpen).toBe(false);
    expect(result.current.addingToSlot).toBeNull();
  });

  it('after clearing the target, clicking a new empty slot re-targets it while the panel stays open the whole time — the actual multi-placement workflow requested, never needing to reopen the panel between cards', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.openAddToSlot(3, 1));
    act(() => result.current.clearAddingToSlotTarget());

    act(() => result.current.openAddToSlot(7, 1));

    expect(result.current.isAddPanelOpen).toBe(true);
    expect(result.current.addingToSlot).toEqual({ slotIndex: 7, pageNumber: 1 });
  });

  it('closeAddToSlot also clears any pending card selection — otherwise a much-later slot click could unexpectedly place a card the user probably forgot they\'d selected', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.selectCardForPlacement({ id: 'card-1' }));

    act(() => result.current.closeAddToSlot());

    expect(result.current.selectedCardForPlacement).toBeNull();
  });
});

describe('useBinderView — selectedCardForPlacement (real feature: the actual card-first workflow requested — click a card, then click a slot)', () => {
  it('selectCardForPlacement sets the selected card', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    const card = { id: 'card-1', name: 'Pikachu' };

    act(() => result.current.selectCardForPlacement(card));

    expect(result.current.selectedCardForPlacement).toEqual(card);
  });

  it('clearSelectedCardForPlacement clears it', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.selectCardForPlacement({ id: 'card-1' }));

    act(() => result.current.clearSelectedCardForPlacement());

    expect(result.current.selectedCardForPlacement).toBeNull();
  });

  it('selecting a different card while one is already selected simply switches which one is selected, without needing an explicit deselect first', () => {
    const { result } = renderHook(() => useBinderView(makeBinder(10), []));
    act(() => result.current.selectCardForPlacement({ id: 'card-1' }));

    act(() => result.current.selectCardForPlacement({ id: 'card-2' }));

    expect(result.current.selectedCardForPlacement).toEqual({ id: 'card-2' });
  });
});