// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCollectionActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useCollectionActions', () => {
  it('handleCreate dispatches COLLECTION_ADD, then template fields, then card definitions, in that order', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useCollectionActions } = await import('../useCollectionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCollectionActions(toast));

    const payload = {
      collection: { id: 'col-1', name: 'My Set' },
      templateFields: [{ id: 'tf-1' }],
      cardDefinitions: [{ id: 'card-1' }],
    };
    await act(async () => result.current.handleCreate(payload));

    expect(mockDispatch.mock.calls[0][0]).toEqual({ type: ACTIONS.COLLECTION_ADD, payload: payload.collection });
    expect(mockDispatch.mock.calls[1][0]).toEqual({ type: ACTIONS.TEMPLATE_FIELD_BULK_ADD, payload: payload.templateFields });
    expect(mockDispatch.mock.calls[2][0]).toEqual({ type: ACTIONS.CARD_DEFINITION_BULK_ADD, payload: payload.cardDefinitions });
  });

  it('handleCreate skips the template-fields and card-definitions dispatches entirely when none are given', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useCollectionActions } = await import('../useCollectionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCollectionActions(toast));

    await act(async () => result.current.handleCreate({ collection: { id: 'col-1', name: 'Empty Set' } }));

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.COLLECTION_ADD, payload: { id: 'col-1', name: 'Empty Set' } });
  });

  it('handleCreate toasts with the collection name and calls onCreateSuccess', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onCreateSuccess = vi.fn();
    const { useCollectionActions } = await import('../useCollectionActions.js');
    const { result } = renderHook(() => useCollectionActions(toast, { onCreateSuccess }));

    await act(async () => result.current.handleCreate({ collection: { id: 'col-1', name: 'My Set' } }));

    expect(toast).toHaveBeenCalledWith('Collection "My Set" created');
    expect(onCreateSuccess).toHaveBeenCalled();
  });

  it('handleEdit dispatches COLLECTION_UPDATE and toasts', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useCollectionActions } = await import('../useCollectionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCollectionActions(toast));

    act(() => result.current.handleEdit({ id: 'col-1', name: 'Renamed' }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.COLLECTION_UPDATE, payload: { id: 'col-1', name: 'Renamed' } });
    expect(toast).toHaveBeenCalledWith('Collection updated');
  });

  it('handleDelete dispatches COLLECTION_DELETE, toasts, and calls onDeleteSuccess', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onDeleteSuccess = vi.fn();
    const { useCollectionActions } = await import('../useCollectionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCollectionActions(toast, { onDeleteSuccess }));

    act(() => result.current.handleDelete('col-1'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.COLLECTION_DELETE, payload: { collectionId: 'col-1' } });
    expect(toast).toHaveBeenCalledWith('Collection deleted');
    expect(onDeleteSuccess).toHaveBeenCalled();
  });
});
