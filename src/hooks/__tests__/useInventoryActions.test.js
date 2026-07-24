// @vitest-environment jsdom
/**
 * @fileoverview Tests for useInventoryActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useInventoryActions', () => {
  it('handleOwn dispatches INVENTORY_ADD with a validly-created item, and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    act(() => result.current.handleOwn({ cardDefId: 'card-1', collectionId: 'col-1' }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe(ACTIONS.INVENTORY_ADD);
    expect(call.payload.cardDefId).toBe('card-1');
    expect(toast).toHaveBeenCalledWith('Card marked as owned');
  });

  it('handleOwn ALSO dispatches BINDER_SLOT_UPDATE to link the new copy when linkToSlotId is given', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    act(() => result.current.handleOwn({ cardDefId: 'card-1', collectionId: 'col-1', linkToSlotId: 'slot-1' }));

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    const secondCall = mockDispatch.mock.calls[1][0];
    expect(secondCall.type).toBe(ACTIONS.BINDER_SLOT_UPDATE);
    expect(secondCall.payload.slotId).toBe('slot-1');
    expect(secondCall.payload.inventoryItemId).toBe(mockDispatch.mock.calls[0][0].payload.id);
  });

  it('handleOwn does NOT dispatch BINDER_SLOT_UPDATE when linkToSlotId is not given', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    act(() => result.current.handleOwn({ cardDefId: 'card-1', collectionId: 'col-1' }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('handleOwn calls onOwnSuccess when provided', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onOwnSuccess = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { result } = renderHook(() => useInventoryActions(toast, { onOwnSuccess }));

    act(() => result.current.handleOwn({ cardDefId: 'card-1', collectionId: 'col-1' }));

    expect(onOwnSuccess).toHaveBeenCalled();
  });

  it('handleOwn reports an error and does not dispatch when required fields are missing', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    // Missing collectionId entirely — createInventoryItem should fail validation
    act(() => result.current.handleOwn({ cardDefId: 'card-1' }));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Failed to mark card as owned', 'error');
  });

  it('handleUnown dispatches INVENTORY_DELETE and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onUnownSuccess = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast, { onUnownSuccess }));

    act(() => result.current.handleUnown('inv-1'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } });
    expect(toast).toHaveBeenCalledWith('Ownership removed');
    expect(onUnownSuccess).toHaveBeenCalled();
  });

  it('handleUpdateAcquisition dispatches INVENTORY_UPDATE with the given item', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    const updated = { id: 'inv-1', condition: 'Near Mint' };
    act(() => result.current.handleUpdateAcquisition(updated));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_UPDATE, payload: updated });
    expect(toast).toHaveBeenCalledWith('Card details updated');
  });

  it('handleToggleFavorite flips is_favorite and toasts "Added" when it was false', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    act(() => result.current.handleToggleFavorite({ id: 'inv-1', is_favorite: false }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_UPDATE, payload: { id: 'inv-1', is_favorite: true } });
    expect(toast).toHaveBeenCalledWith('Added to favorites');
  });

  it('handleToggleFavorite flips is_favorite and toasts "Removed" when it was true', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useInventoryActions } = await import('../useInventoryActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useInventoryActions(toast));

    act(() => result.current.handleToggleFavorite({ id: 'inv-1', is_favorite: true }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_UPDATE, payload: { id: 'inv-1', is_favorite: false } });
    expect(toast).toHaveBeenCalledWith('Removed from favorites');
  });
});
