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
