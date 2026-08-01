// @vitest-environment jsdom
/**
 * @fileoverview Tests for useFirstTimeHint.js.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirstTimeHint } from '../useFirstTimeHint.js';

let mockUserId = 'user-1';
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null, loading: false }),
}));

function keyFor(userId, hintKey) {
  return `pinder:hint-seen:${hintKey}:${userId ?? 'anonymous'}`;
}

describe('useFirstTimeHint', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUserId = 'user-1';
  });

  it('shows the hint by default when nothing has been dismissed yet', () => {
    const { result } = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    expect(result.current.showHint).toBe(true);
  });

  it('dismiss() hides the hint immediately', () => {
    const { result } = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    act(() => result.current.dismiss());
    expect(result.current.showHint).toBe(false);
  });

  it('dismiss() persists to localStorage, scoped to the specific hintKey and the current user', () => {
    const { result } = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    act(() => result.current.dismiss());
    expect(localStorage.getItem(keyFor('user-1', 'fullscreen-tip'))).toBe('true');
  });

  it('a dismissed hint stays hidden across a fresh mount for the same user', () => {
    const first = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    act(() => first.result.current.dismiss());
    first.unmount();

    const second = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    expect(second.result.current.showHint).toBe(false);
  });

  it('two different hints are tracked completely independently — dismissing one does not affect the other', () => {
    const fullscreenHint = renderHook(() => useFirstTimeHint('fullscreen-tip'));
    act(() => fullscreenHint.result.current.dismiss());

    const planModeHint = renderHook(() => useFirstTimeHint('plan-mode-tip'));
    expect(planModeHint.result.current.showHint).toBe(true);
  });

  describe('real bug already learned from useDeclutteredSets.js: useAuth resolving asynchronously after mount', () => {
    it('re-checks the correct account\'s dismissed state once a real userId arrives after starting as null', () => {
      localStorage.setItem(keyFor('user-1', 'fullscreen-tip'), 'true');

      mockUserId = null; // auth not resolved yet at mount time
      const { result, rerender } = renderHook(() => useFirstTimeHint('fullscreen-tip'));
      expect(result.current.showHint).toBe(true); // correct so far -- doesn't know who's logged in yet

      mockUserId = 'user-1'; // auth resolves moments later
      rerender();

      expect(result.current.showHint).toBe(false);
    });

    it('two different accounts on the same browser do NOT share dismissed-hint state', () => {
      mockUserId = 'user-1';
      const { result: user1 } = renderHook(() => useFirstTimeHint('fullscreen-tip'));
      act(() => user1.current.dismiss());

      mockUserId = 'user-2';
      const { result: user2 } = renderHook(() => useFirstTimeHint('fullscreen-tip'));

      expect(user2.current.showHint).toBe(true);
    });
  });
});
