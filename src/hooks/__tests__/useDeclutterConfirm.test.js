// @vitest-environment jsdom
/**
 * @fileoverview Tests for useDeclutterConfirm.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeclutterConfirm } from '../useDeclutterConfirm.js';

function makeSlot(overrides = {}) {
  return { id: 'slot-1', binderId: 'binder-1', pageNumber: 1, slotIndex: 0, cardDefId: 'card-1', inventoryItemId: null, ...overrides };
}

describe('useDeclutterConfirm', () => {
  it('declutters immediately, with no confirmation, when none of the selected cards are placed anywhere', () => {
    const onDeclutter = vi.fn();
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: [], binderPanels: [], onDeclutter }));

    act(() => result.current.requestDeclutter(['card-1', 'card-2']));

    expect(onDeclutter).toHaveBeenCalledWith(['card-1', 'card-2']);
    expect(result.current.pendingIds).toBe(null);
  });

  it('does nothing at all for an empty selection', () => {
    const onDeclutter = vi.fn();
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: [], binderPanels: [], onDeclutter }));

    act(() => result.current.requestDeclutter([]));

    expect(onDeclutter).not.toHaveBeenCalled();
    expect(result.current.pendingIds).toBe(null);
  });

  it('holds for confirmation, without decluttering yet, when at least one selected card is placed in a binder', () => {
    const onDeclutter = vi.fn();
    const slots = [makeSlot({ cardDefId: 'card-1' })];
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: slots, binderPanels: [], onDeclutter }));

    act(() => result.current.requestDeclutter(['card-1', 'card-2']));

    expect(onDeclutter).not.toHaveBeenCalled();
    expect(result.current.pendingIds).toEqual(['card-1', 'card-2']);
  });

  it('confirmDeclutter proceeds with the pending ids and clears the pending state', () => {
    const onDeclutter = vi.fn();
    const slots = [makeSlot({ cardDefId: 'card-1' })];
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: slots, binderPanels: [], onDeclutter }));

    act(() => result.current.requestDeclutter(['card-1']));
    act(() => result.current.confirmDeclutter());

    expect(onDeclutter).toHaveBeenCalledWith(['card-1']);
    expect(result.current.pendingIds).toBe(null);
  });

  it('cancelDeclutter clears the pending state WITHOUT ever calling onDeclutter', () => {
    const onDeclutter = vi.fn();
    const slots = [makeSlot({ cardDefId: 'card-1' })];
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: slots, binderPanels: [], onDeclutter }));

    act(() => result.current.requestDeclutter(['card-1']));
    act(() => result.current.cancelDeclutter());

    expect(onDeclutter).not.toHaveBeenCalled();
    expect(result.current.pendingIds).toBe(null);
  });

  it('a card placed via a combined panel (not a plain slot) also triggers the confirmation', () => {
    const onDeclutter = vi.fn();
    const panels = [{ id: 'panel-1', binderId: 'binder-1', panelType: 'card', cardDefId: 'card-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1 }];
    const { result } = renderHook(() => useDeclutterConfirm({ binderSlots: [], binderPanels: panels, onDeclutter }));

    act(() => result.current.requestDeclutter(['card-1']));

    expect(onDeclutter).not.toHaveBeenCalled();
    expect(result.current.pendingIds).toEqual(['card-1']);
  });
});
