// @vitest-environment jsdom
/**
 * @fileoverview Tests for useMultiSelect.js.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '../useMultiSelect.js';

describe('useMultiSelect', () => {
  it('starts with select mode off and an empty selection', () => {
    const { result } = renderHook(() => useMultiSelect());
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggleSelectMode turns select mode on', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggleSelectMode());
    expect(result.current.isSelectMode).toBe(true);
  });

  it('toggleSelectMode turns select mode back off when called again', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggleSelectMode());
    act(() => result.current.toggleSelectMode());
    expect(result.current.isSelectMode).toBe(false);
  });

  it('toggleSelectMode always clears any existing selection, both entering and exiting', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggleSelectMode()); // enter
    act(() => result.current.toggle('card-1'));
    expect(result.current.selectedIds.has('card-1')).toBe(true);

    act(() => result.current.toggleSelectMode()); // exit — should clear
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggle adds an id not yet selected', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggle('card-1'));
    expect(result.current.selectedIds.has('card-1')).toBe(true);
  });

  it('toggle removes an id that was already selected', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggle('card-1'));
    act(() => result.current.toggle('card-1'));
    expect(result.current.selectedIds.has('card-1')).toBe(false);
  });

  it('toggle only affects the given id, leaving other selected ids alone', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggle('card-1'));
    act(() => result.current.toggle('card-2'));
    act(() => result.current.toggle('card-1')); // deselect just card-1

    expect(result.current.selectedIds.has('card-1')).toBe(false);
    expect(result.current.selectedIds.has('card-2')).toBe(true);
  });

  it('selectAll replaces the whole selection with exactly the given ids', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggle('stale-id')); // pre-existing selection
    act(() => result.current.selectAll(['card-1', 'card-2', 'card-3']));

    expect(result.current.selectedIds.has('stale-id')).toBe(false); // replaced, not merged
    expect([...result.current.selectedIds].sort()).toEqual(['card-1', 'card-2', 'card-3']);
  });

  it('clearSelection empties the selection without leaving select mode', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggleSelectMode());
    act(() => result.current.toggle('card-1'));

    act(() => result.current.clearSelection());

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.isSelectMode).toBe(true); // still in select mode
  });

  it('exitSelectMode turns select mode off AND clears the selection in one call', () => {
    const { result } = renderHook(() => useMultiSelect());
    act(() => result.current.toggleSelectMode());
    act(() => result.current.toggle('card-1'));

    act(() => result.current.exitSelectMode());

    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedIds.size).toBe(0);
  });
});
