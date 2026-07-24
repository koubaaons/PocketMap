// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardEditor.js.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardEditor } from '../useCardEditor.js';

describe('useCardEditor', () => {
  it('starts with sensible defaults — no query, newest sort, no filters, everything closed', () => {
    const { result } = renderHook(() => useCardEditor());
    expect(result.current.query).toBe('');
    expect(result.current.sortBy).toBe('newest');
    expect(result.current.filters).toEqual({});
    expect(result.current.showCreate).toBe(false);
    expect(result.current.editingCard).toBe(null);
    expect(result.current.confirmDelete).toBe(null);
  });

  it('clearQuery resets the query to empty regardless of what it was', () => {
    const { result } = renderHook(() => useCardEditor());
    act(() => result.current.setQuery('pikachu'));
    act(() => result.current.clearQuery());
    expect(result.current.query).toBe('');
  });

  it('openCreate/closeCreate toggle showCreate', () => {
    const { result } = renderHook(() => useCardEditor());
    act(() => result.current.openCreate());
    expect(result.current.showCreate).toBe(true);
    act(() => result.current.closeCreate());
    expect(result.current.showCreate).toBe(false);
  });

  it('openEdit sets the editing card, closeEdit clears it', () => {
    const { result } = renderHook(() => useCardEditor());
    const card = { id: 'card-1' };
    act(() => result.current.openEdit(card));
    expect(result.current.editingCard).toBe(card);
    act(() => result.current.closeEdit());
    expect(result.current.editingCard).toBe(null);
  });

  it('openDelete sets the pending-delete card, closeDelete clears it', () => {
    const { result } = renderHook(() => useCardEditor());
    const card = { id: 'card-1' };
    act(() => result.current.openDelete(card));
    expect(result.current.confirmDelete).toBe(card);
    act(() => result.current.closeDelete());
    expect(result.current.confirmDelete).toBe(null);
  });

  it('setFilters replaces the filters object', () => {
    const { result } = renderHook(() => useCardEditor());
    act(() => result.current.setFilters({ rarity: 'Rare' }));
    expect(result.current.filters).toEqual({ rarity: 'Rare' });
  });
});
