// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardDefinitionActions.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

describe('useCardDefinitionActions', () => {
  it('handleCreate dispatches CARD_DEFINITION_ADD, toasts with the card name, and calls onCreateSuccess', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onCreateSuccess = vi.fn();
    const { useCardDefinitionActions } = await import('../useCardDefinitionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCardDefinitionActions(toast, { onCreateSuccess }));

    const cardDef = { id: 'card-1', name: 'Pikachu' };
    act(() => result.current.handleCreate(cardDef));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.CARD_DEFINITION_ADD, payload: cardDef });
    expect(toast).toHaveBeenCalledWith('"Pikachu" added');
    expect(onCreateSuccess).toHaveBeenCalled();
  });

  it('handleUpdate dispatches CARD_DEFINITION_UPDATE and toasts with the updated name', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const { useCardDefinitionActions } = await import('../useCardDefinitionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCardDefinitionActions(toast));

    const updated = { id: 'card-1', name: 'Raichu' };
    act(() => result.current.handleUpdate(updated));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.CARD_DEFINITION_UPDATE, payload: updated });
    expect(toast).toHaveBeenCalledWith('"Raichu" updated');
  });

  it('handleDelete dispatches CARD_DEFINITION_DELETE with just the id, and toasts with the given name', async () => {
    mockDispatch.mockClear();
    const toast = vi.fn();
    const onDeleteSuccess = vi.fn();
    const { useCardDefinitionActions } = await import('../useCardDefinitionActions.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useCardDefinitionActions(toast, { onDeleteSuccess }));

    act(() => result.current.handleDelete('card-1', 'Raichu'));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId: 'card-1' } });
    expect(toast).toHaveBeenCalledWith('"Raichu" deleted');
    expect(onDeleteSuccess).toHaveBeenCalled();
  });
});
