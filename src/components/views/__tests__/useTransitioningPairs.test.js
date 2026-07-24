// @vitest-environment jsdom
/**
 * @fileoverview Tests for useTransitioningPairs.js.
 *
 * Uses fake timers throughout, since the hook's real behavior is
 * driven by setTimeout (FLIP_TRANSITION_MS) and a double
 * requestAnimationFrame — without controlling time deterministically,
 * these tests would either be flaky or unable to observe the
 * mid-transition state at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransitioningPairs, getEffectiveZIndex, FLIP_TRANSITION_MS } from '../useTransitioningPairs.js';

describe('getEffectiveZIndex', () => {
  it('a settled (non-transitioning) flipped pair gets its plain pairSpreadIndex as z-index', () => {
    expect(getEffectiveZIndex(3, 10, true, false)).toBe(3);
  });

  it('a settled unflipped pair gets totalSpreads - pairSpreadIndex', () => {
    expect(getEffectiveZIndex(3, 10, false, false)).toBe(7);
  });

  it('a transitioning pair always gets boosted above every settled pair, regardless of flip direction', () => {
    const flippedBoosted = getEffectiveZIndex(3, 10, true, true);
    const unflippedBoosted = getEffectiveZIndex(3, 10, false, true);
    const highestPossibleSettled = getEffectiveZIndex(9999, 10, false, false); // an implausibly high settled value
    expect(flippedBoosted).toBeGreaterThan(highestPossibleSettled);
    expect(unflippedBoosted).toBeGreaterThan(highestPossibleSettled);
  });
});

describe('useTransitioningPairs', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a pair whose isFlipped value changes becomes transitioning immediately', () => {
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    expect(result.current.transitioning.has(0)).toBe(false);

    act(() => rerender({ spread: 1 })); // pair 0 flips from false -> true

    expect(result.current.transitioning.has(0)).toBe(true);
  });

  it('a transitioning pair stops transitioning after FLIP_TRANSITION_MS', () => {
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    act(() => rerender({ spread: 1 }));
    expect(result.current.transitioning.has(0)).toBe(true);

    act(() => vi.advanceTimersByTime(FLIP_TRANSITION_MS));
    expect(result.current.transitioning.has(0)).toBe(false);
  });

  it('a pair whose isFlipped value does NOT change is never marked transitioning', () => {
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2], (i) => i < spread, spread),
      { initialProps: { spread: 5 } }
    );

    act(() => rerender({ spread: 6 })); // pair 2 (i < 5 already true, i < 6 still true) doesn't change
    expect(result.current.transitioning.has(2)).toBe(false);
  });

  it('a single-step change (adjacent spread) animates normally, not instantly', () => {
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2, 3, 4], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    act(() => rerender({ spread: 1 })); // single step: 0 -> 1

    expect(result.current.transitioning.has(0)).toBe(true);
    expect(result.current.snapInstantly.has(0)).toBe(false);
  });

  it('a big jump snaps pairs far from both endpoints instead of animating them', () => {
    // Pairs 0..4 all flip when jumping straight from spread 0 to
    // spread 5 in one go (e.g. typing a page number, or closing the
    // binder from deep inside). Only pairs within JUMP_ADJACENCY (1)
    // of either endpoint (0 or 5) should actually animate; the ones
    // buried in the middle should snap instantly instead.
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2, 3, 4, 5], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    act(() => rerender({ spread: 5 })); // a jump, not a single step

    // near old spread (0) or new spread (5): pairs 1 (near 0) — wait,
    // pair 0 itself is the old spread's own index and pair 4/5 are
    // near the new one. Confirm the buried middle (pair 2) snaps.
    expect(result.current.snapInstantly.has(2)).toBe(true);
    expect(result.current.transitioning.has(2)).toBe(false);
  });

  it('snapInstantly clears itself on the next animation frame after a jump', () => {
    const { result, rerender } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2, 3, 4, 5], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    act(() => rerender({ spread: 5 }));
    expect(result.current.snapInstantly.size).toBeGreaterThan(0);

    // Double rAF, matching the hook's own "disable, apply, re-enable
    // next frame" pattern.
    act(() => { vi.advanceTimersToNextFrame(); });
    act(() => { vi.advanceTimersToNextFrame(); });

    expect(result.current.snapInstantly.size).toBe(0);
  });

  it('unmounting clears every pending transition timeout — no state update after unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ spread }) => useTransitioningPairs([0, 1, 2], (i) => i < spread, spread),
      { initialProps: { spread: 0 } }
    );

    act(() => rerender({ spread: 1 })); // starts a pending timeout for pair 0
    expect(result.current.transitioning.has(0)).toBe(true);

    unmount();

    // Advancing timers after unmount must not throw (React would warn
    // about a state update on an unmounted component if the timeout
    // fired and still tried to call setTransitioning).
    expect(() => act(() => vi.advanceTimersByTime(FLIP_TRANSITION_MS))).not.toThrow();
  });
});
