// @vitest-environment jsdom
/**
 * @fileoverview Tests for useDeclutteredSets.js.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeclutteredSets } from '../useDeclutteredSets.js';

const STORAGE_KEY = 'pinder:decluttered-set-ids';

describe('useDeclutteredSets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.size).toBe(0);
  });

  it('loads previously stored ids on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['set-a', 'set-b']));
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.has('set-a')).toBe(true);
    expect(result.current.declutteredIds.has('set-b')).toBe(true);
  });

  it('falls back to empty if the stored value is corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json{{{');
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.size).toBe(0);
  });

  it('declutter() adds the given ids to the set', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a', 'set-b']));
    expect(result.current.declutteredIds.has('set-a')).toBe(true);
    expect(result.current.declutteredIds.has('set-b')).toBe(true);
  });

  it('declutter() persists to localStorage', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a']));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['set-a']);
  });

  it('restore() removes only the given ids, leaving the rest decluttered', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a', 'set-b']));
    act(() => result.current.restore(['set-a']));

    expect(result.current.declutteredIds.has('set-a')).toBe(false);
    expect(result.current.declutteredIds.has('set-b')).toBe(true);
  });

  it('restoreAll() clears everything', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a', 'set-b']));
    act(() => result.current.restoreAll());

    expect(result.current.declutteredIds.size).toBe(0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([]);
  });
});
