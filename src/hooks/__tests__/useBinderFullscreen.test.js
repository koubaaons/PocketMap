// @vitest-environment jsdom
/**
 * @fileoverview Tests for useBinderFullscreen.js.
 *
 * jsdom does no real layout, so getBoundingClientRect/scrollHeight/
 * clientHeight are stubbed directly on the relevant elements per test
 * — these are the exact properties the hook actually reads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBinderFullscreen } from '../useBinderFullscreen.js';

// useBinderFullscreen internally calls useTheme(), which calls
// window.matchMedia — jsdom doesn't implement this at all.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, ...rect });
}

describe('useBinderFullscreen — bookAspectRatio (pure formula)', () => {
  it('computes width/height ratio from binder dimensions using the 2.5:3.5 slot ratio', () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));
    // pageWidthUnits=3, pageHeightUnits=3/(2.5/3.5)=4.2, bookWidthUnits=6
    // ratio = 6 / 4.2
    expect(result.current.effectiveBookAspectRatio).toBeCloseTo(6 / 4.2, 5);
  });

  it('a wider grid (more cols) produces a larger aspect ratio', () => {
    const { result: narrow } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 2 }));
    const { result: wide }   = renderHook(() => useBinderFullscreen({ rows: 3, cols: 4 }));
    expect(wide.current.effectiveBookAspectRatio).toBeGreaterThan(narrow.current.effectiveBookAspectRatio);
  });
});

describe('useBinderFullscreen — measured aspect ratio overrides the formula', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the DOM-measured ratio once available, instead of the formula estimate', () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));
    const formulaRatio = result.current.effectiveBookAspectRatio;

    // Build the DOM structure the hook actually queries for.
    const wrapper = document.createElement('div');
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'binder-page-wrapper';
    const grid = document.createElement('div');
    grid.className = 'binder-page-grid';
    pageWrapper.appendChild(grid);
    wrapper.appendChild(pageWrapper);

    stubRect(wrapper, { width: 800, height: 400 });
    Object.defineProperty(pageWrapper, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(pageWrapper, 'clientHeight', { value: 400, configurable: true }); // 100px overflow

    act(() => { result.current.bookFlipWrapperRef.current = wrapper; });
    act(() => { vi.advanceTimersToNextFrame(); });
    act(() => { vi.advanceTimersToNextFrame(); });

    // correctedHeight = 400 + 100 = 500; ratio = 800/500 = 1.6
    expect(result.current.effectiveBookAspectRatio).toBeCloseTo(1.6, 5);
    expect(result.current.effectiveBookAspectRatio).not.toBeCloseTo(formulaRatio, 5);
  });

  it('falls back to the formula when there is no DOM overflow to measure (rect not yet available)', () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));
    const formulaRatio = result.current.effectiveBookAspectRatio;

    act(() => { vi.advanceTimersToNextFrame(); });
    act(() => { vi.advanceTimersToNextFrame(); });

    // bookFlipWrapperRef.current was never set — recalc bails out early
    expect(result.current.effectiveBookAspectRatio).toBe(formulaRatio);
  });
});

describe('useBinderFullscreen — fullscreenMaxBookWidth', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });

  it('is null while not in fullscreen', () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));
    expect(result.current.fullscreenMaxBookWidth).toBe(null);
  });

  it('computes a shrunk width once fullscreen and the book is taller than the available space', async () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));

    const el = document.createElement('div');
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    act(() => { result.current.rootRef.current = el; });

    await act(async () => result.current.toggleFullscreen());
    Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
    act(() => document.dispatchEvent(new Event('fullscreenchange')));

    const wrapper = document.createElement('div');
    stubRect(wrapper, { width: 1000, height: 900 }); // taller than available (800 - 160 padding = 640)
    act(() => { result.current.bookFlipWrapperRef.current = wrapper; });

    act(() => { vi.advanceTimersToNextFrame(); });
    act(() => { vi.advanceTimersToNextFrame(); });

    // availableHeight = 800 - 160 = 640; shrinkFactor = 640/900
    const expectedWidth = 1000 * (640 / 900);
    expect(result.current.fullscreenMaxBookWidth).toBeCloseTo(expectedWidth, 1);
  });

  it('leaves fullscreenMaxBookWidth null (no cap needed) when the book already fits', async () => {
    const { result } = renderHook(() => useBinderFullscreen({ rows: 3, cols: 3 }));

    const el = document.createElement('div');
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    act(() => { result.current.rootRef.current = el; });
    await act(async () => result.current.toggleFullscreen());
    Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
    act(() => document.dispatchEvent(new Event('fullscreenchange')));

    const wrapper = document.createElement('div');
    stubRect(wrapper, { width: 1000, height: 500 }); // fits within 640 available
    act(() => { result.current.bookFlipWrapperRef.current = wrapper; });

    act(() => { vi.advanceTimersToNextFrame(); });
    act(() => { vi.advanceTimersToNextFrame(); });

    expect(result.current.fullscreenMaxBookWidth).toBe(null);
  });
});
