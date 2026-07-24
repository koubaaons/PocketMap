// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBulkCardActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useBulkCardActions', () => {
  it('handleBulkOwn dispatches INVENTORY_BULK_ADD with one created item per given card, and toasts the count', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkOwn([{ id: 'card-1' }, { id: 'card-2' }], 'col-1'));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe(ACTIONS.INVENTORY_BULK_ADD);
    expect(call.payload.items).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith('Marked 2 cards as owned');
  });

  it('handleBulkOwn uses singular wording for exactly one card', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkOwn([{ id: 'card-1' }], 'col-1'));

    expect(toast).toHaveBeenCalledWith('Marked 1 card as owned');
  });

  it('handleBulkOwn does not dispatch at all if every item fails to create', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    // Missing collectionId entirely at the call site (empty string) — createInventoryItem should fail validation for every card
    act(() => result.current.handleBulkOwn([{ id: 'card-1' }], ''));

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('handleBulkUnown dispatches INVENTORY_BULK_DELETE with the given ids and toasts (plural "copies")', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkUnown(['inv-1', 'inv-2']));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_BULK_DELETE, payload: { inventoryIds: ['inv-1', 'inv-2'] } });
    expect(toast).toHaveBeenCalledWith('Removed ownership from 2 copies');
  });

  it('handleBulkUnown uses singular "copy" for exactly one', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkUnown(['inv-1']));

    expect(toast).toHaveBeenCalledWith('Removed ownership from 1 copy');
  });

  it('handleBulkUnown does nothing for an empty array', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkUnown([]));

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('handleBulkSetFavorite dispatches with isFavorite:true and toasts "Added"', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkSetFavorite(['inv-1', 'inv-2'], true));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.INVENTORY_BULK_SET_FAVORITE, payload: { ids: ['inv-1', 'inv-2'], isFavorite: true } });
    expect(toast).toHaveBeenCalledWith('Added 2 cards to favorites');
  });

  it('handleBulkSetFavorite dispatches with isFavorite:false and toasts "Removed"', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkSetFavorite(['inv-1'], false));

    expect(toast).toHaveBeenCalledWith('Removed 1 card from favorites');
  });

  it('handleBulkSetDecluttered toasts "Decluttered" when isDecluttered is true', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkSetDecluttered(['card-1', 'card-2'], true));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED, payload: { ids: ['card-1', 'card-2'], isDecluttered: true } });
    expect(toast).toHaveBeenCalledWith('Decluttered 2 cards');
  });

  it('handleBulkSetDecluttered toasts "Restored" when isDecluttered is false', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBulkCardActions } = await import('../useBulkCardActions.js');
    const { result } = renderHook(() => useBulkCardActions(toast));

    act(() => result.current.handleBulkSetDecluttered(['card-1'], false));

    expect(toast).toHaveBeenCalledWith('Restored 1 card');
  });
});
