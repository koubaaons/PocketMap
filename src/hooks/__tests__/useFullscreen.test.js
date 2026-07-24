// @vitest-environment jsdom
/**
 * @fileoverview Tests for useFullscreen.js.
 *
 * jsdom doesn't implement the real Fullscreen API at all, so
 * requestFullscreen/exitFullscreen are mocked directly per test.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from '../useFullscreen.js';

describe('useFullscreen', () => {
  afterEach(() => {
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });

  it('starts not fullscreen', () => {
    const ref = { current: document.createElement('div') };
    const { result } = renderHook(() => useFullscreen(ref));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('toggleFullscreen calls requestFullscreen and sets isFullscreen true on success', async () => {
    const el = document.createElement('div');
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => result.current.toggleFullscreen());

    expect(el.requestFullscreen).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(true);
  });

  it('still sets isFullscreen true even if requestFullscreen is rejected — a usable fallback rather than silently doing nothing', async () => {
    const el = document.createElement('div');
    el.requestFullscreen = vi.fn().mockRejectedValue(new Error('not a user gesture'));
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => result.current.toggleFullscreen());

    expect(result.current.isFullscreen).toBe(true);
  });

  it('toggling again while already fullscreen calls exitFullscreen instead', async () => {
    const el = document.createElement('div');
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = vi.fn().mockImplementation(() => {
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      return Promise.resolve();
    });
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    await act(async () => result.current.toggleFullscreen()); // enter
    Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });

    await act(async () => result.current.toggleFullscreen()); // exit

    expect(document.exitFullscreen).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(false);
  });

  it('does nothing if the ref has no current element', async () => {
    const ref = { current: null };
    const { result } = renderHook(() => useFullscreen(ref));
    await act(async () => result.current.toggleFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('stays in sync with native fullscreenchange events (e.g. user presses ESC, browser exits fullscreen on its own)', () => {
    const el = document.createElement('div');
    const ref = { current: el };
    const { result } = renderHook(() => useFullscreen(ref));

    Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true });
    act(() => document.dispatchEvent(new Event('fullscreenchange')));
    expect(result.current.isFullscreen).toBe(true);

    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    act(() => document.dispatchEvent(new Event('fullscreenchange')));
    expect(result.current.isFullscreen).toBe(false);
  });
});
