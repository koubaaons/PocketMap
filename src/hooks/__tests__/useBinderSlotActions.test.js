// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderSlotActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useBinderSlotActions', () => {
  it('handleAddToSlot dispatches BINDER_SLOT_ADD with a validly-created slot, and toasts with the page/slot number', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleAddToSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'col-1', pageNumber: 2, slotIndex: 3,
    }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe(ACTIONS.BINDER_SLOT_ADD);
    expect(call.payload.slot.pageNumber).toBe(2);
    expect(toast).toHaveBeenCalledWith('Added to page 2, slot 4'); // slotIndex is 0-based, message is 1-based
  });

  it('handleAddToSlot links the slot to a specifically chosen copy when chosenCopyId is given', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleAddToSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'col-1', pageNumber: 1, slotIndex: 0, chosenCopyId: 'inv-42',
    }));

    expect(mockDispatch.mock.calls[0][0].payload.slot.inventoryItemId).toBe('inv-42');
  });

  it('handleAddToSlot reports an error and does not dispatch when required fields are missing', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleAddToSlot({ binderId: 'binder-1' })); // missing cardDefId etc

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Failed to add card to binder', 'error');
  });

  it('handleRemoveFromSlot dispatches BINDER_SLOT_REMOVE and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onRemoveSuccess = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast, { onRemoveSuccess }));

    act(() => result.current.handleRemoveFromSlot('slot-1'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_SLOT_REMOVE, payload: { slotId: 'slot-1' } });
    expect(toast).toHaveBeenCalledWith('Card removed from binder');
    expect(onRemoveSuccess).toHaveBeenCalled();
  });

  it('handleMoveSlot dispatches BINDER_SLOT_MOVE with the new position', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleMoveSlot({ slotId: 'slot-1', pageNumber: 3, slotIndex: 2 }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_SLOT_MOVE, payload: { slotId: 'slot-1', pageNumber: 3, slotIndex: 2 } });
    expect(toast).toHaveBeenCalledWith('Card moved');
  });

  it('handleAddPage dispatches BINDER_ADD_PAGE when under the page cap', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleAddPage('binder-1', 20));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_ADD_PAGE, payload: { binderId: 'binder-1' } });
    expect(toast).toHaveBeenCalledWith('Page added');
  });

  it('handleAddPage refuses and toasts an error instead, without dispatching, once already at the page cap', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { MAX_BINDER_PAGES } = await import('../../types/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleAddPage('binder-1', MAX_BINDER_PAGES));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining(`${MAX_BINDER_PAGES} pages`), 'error');
  });

  it('handleSwapPages dispatches BINDER_SWAP_PAGES for two different pages', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleSwapPages('binder-1', 2, 5));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BINDER_SWAP_PAGES, payload: { binderId: 'binder-1', pageA: 2, pageB: 5 } });
    expect(toast).toHaveBeenCalledWith('Swapped page 2 and page 5');
  });

  it('handleSwapPages rejects swapping a page with itself, without dispatching', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinderSlotActions } = await import('../useBinderSlotActions.js');
    const { result } = renderHook(() => useBinderSlotActions(toast));

    act(() => result.current.handleSwapPages('binder-1', 3, 3));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Choose two different pages to swap', 'error');
  });
});
