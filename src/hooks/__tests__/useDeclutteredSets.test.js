// @vitest-environment jsdom
/**
 * @fileoverview Tests for useDeclutteredSets.js.
 *
 * Includes dedicated coverage for the real bug this fix addresses:
 * the storage key used to be completely global, with no user id in
 * it at all, meaning every account signed into the same browser
 * shared the exact same decluttered-sets list.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeclutteredSets } from '../useDeclutteredSets.js';

let mockUserId = 'user-1';
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null, loading: false }),
}));

function keyFor(userId) {
  return `pinder:decluttered-set-ids:${userId ?? 'anonymous'}`;
}

describe('useDeclutteredSets', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUserId = 'user-1';
  });

  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.size).toBe(0);
  });

  it('loads previously stored ids on mount, scoped to the current user', () => {
    localStorage.setItem(keyFor('user-1'), JSON.stringify(['set-a', 'set-b']));
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.has('set-a')).toBe(true);
    expect(result.current.declutteredIds.has('set-b')).toBe(true);
  });

  it('falls back to empty if the stored value is corrupted JSON', () => {
    localStorage.setItem(keyFor('user-1'), 'not valid json{{{');
    const { result } = renderHook(() => useDeclutteredSets());
    expect(result.current.declutteredIds.size).toBe(0);
  });

  it('declutter() adds the given ids to the set', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a', 'set-b']));
    expect(result.current.declutteredIds.has('set-a')).toBe(true);
    expect(result.current.declutteredIds.has('set-b')).toBe(true);
  });

  it('declutter() persists to localStorage under the current user\'s own scoped key', () => {
    const { result } = renderHook(() => useDeclutteredSets());
    act(() => result.current.declutter(['set-a']));
    expect(JSON.parse(localStorage.getItem(keyFor('user-1')))).toEqual(['set-a']);
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
    expect(JSON.parse(localStorage.getItem(keyFor('user-1')))).toEqual([]);
  });

  describe('real bug fixed: cross-account isolation', () => {
    it('two different accounts on the same browser do NOT share decluttered sets', () => {
      mockUserId = 'user-1';
      const { result: user1 } = renderHook(() => useDeclutteredSets());
      act(() => user1.current.declutter(['set-a']));

      mockUserId = 'user-2';
      const { result: user2 } = renderHook(() => useDeclutteredSets());

      expect(user2.current.declutteredIds.has('set-a')).toBe(false);
    });

    it('each account writes to its own distinct localStorage key, not a shared global one', () => {
      mockUserId = 'user-1';
      const { result: user1 } = renderHook(() => useDeclutteredSets());
      act(() => user1.current.declutter(['set-a']));

      mockUserId = 'user-2';
      const { result: user2 } = renderHook(() => useDeclutteredSets());
      act(() => user2.current.declutter(['set-b']));

      expect(JSON.parse(localStorage.getItem(keyFor('user-1')))).toEqual(['set-a']);
      expect(JSON.parse(localStorage.getItem(keyFor('user-2')))).toEqual(['set-b']);
      // Confirms there's no old-style unscoped key being written at all
      expect(localStorage.getItem('pinder:decluttered-set-ids')).toBe(null);
    });
  });

  describe('real bug fixed: useAuth resolving asynchronously after mount', () => {
    it('re-loads the correct account\'s saved data once a real userId arrives after starting as null — matching how useAuth genuinely behaves in practice (starts unresolved on every fresh mount, resolves moments later), not just the instant-userId case every other test here uses for simplicity', () => {
      // Simulates the exact real-world sequence: account already has
      // decluttered sets saved from an earlier session, then the
      // consuming component mounts fresh (e.g. navigating back to
      // this page) while auth hasn't resolved yet.
      localStorage.setItem(keyFor('user-1'), JSON.stringify(['set-a', 'set-b']));

      mockUserId = null; // auth not resolved yet at mount time
      const { result, rerender } = renderHook(() => useDeclutteredSets());
      expect(result.current.declutteredIds.size).toBe(0); // correct so far -- genuinely doesn't know who's logged in yet

      mockUserId = 'user-1'; // auth resolves moments later
      rerender();

      expect(result.current.declutteredIds.has('set-a')).toBe(true);
      expect(result.current.declutteredIds.has('set-b')).toBe(true);
    });

    it('does NOT reload (and does not lose in-progress changes) on a re-render where userId hasn\'t actually changed', () => {
      mockUserId = 'user-1';
      const { result, rerender } = renderHook(() => useDeclutteredSets());
      act(() => result.current.declutter(['set-a']));

      rerender(); // same userId as before

      expect(result.current.declutteredIds.has('set-a')).toBe(true);
    });
  });
});
