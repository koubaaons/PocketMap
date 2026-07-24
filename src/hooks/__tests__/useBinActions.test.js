// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useBinActions', () => {
  it('handleRestore dispatches BIN_RESTORE_BINDER for a binder item, and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinActions(toast));

    act(() => result.current.handleRestore({ id: 'binder-1', name: 'My Binder', _type: 'binder' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BIN_RESTORE_BINDER, payload: { itemId: 'binder-1' } });
    expect(toast).toHaveBeenCalledWith('"My Binder" restored');
  });

  it('handleRestore dispatches the correct action for each entity type', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinActions(toast));

    const cases = [
      ['collection', ACTIONS.BIN_RESTORE_COLLECTION],
      ['cardDef', ACTIONS.BIN_RESTORE_CARD],
      ['insert', ACTIONS.BIN_RESTORE_INSERT],
    ];
    for (const [type, expectedAction] of cases) {
      mockDispatch.mockClear();
      act(() => result.current.handleRestore({ id: 'x', name: 'X', _type: type }));
      expect(mockDispatch).toHaveBeenCalledWith({ type: expectedAction, payload: { itemId: 'x' } });
    }
  });

  it('handleRestore does nothing for an unrecognized _type', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { result } = renderHook(() => useBinActions(toast));

    act(() => result.current.handleRestore({ id: 'x', name: 'X', _type: 'something-unknown' }));

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('handleRestore calls the onRestoreSuccess callback when provided', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onRestoreSuccess = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { result } = renderHook(() => useBinActions(toast, { onRestoreSuccess }));

    act(() => result.current.handleRestore({ id: 'x', name: 'X', _type: 'binder' }));

    expect(onRestoreSuccess).toHaveBeenCalled();
  });

  it('handlePermDelete dispatches BIN_DELETE_ITEM and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinActions(toast));

    act(() => result.current.handlePermDelete({ id: 'x' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: 'x' } });
    expect(toast).toHaveBeenCalledWith('Deleted permanently');
  });

  it('handleEmptyAll dispatches BIN_EMPTY, toasts, and calls the onSuccess callback', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onSuccess = vi.fn();
    const { useBinActions } = await import('../useBinActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useBinActions(toast));

    act(() => result.current.handleEmptyAll(onSuccess));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.BIN_EMPTY });
    expect(toast).toHaveBeenCalledWith('Trash emptied');
    expect(onSuccess).toHaveBeenCalled();
  });
});
