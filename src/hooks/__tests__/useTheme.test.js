// @vitest-environment jsdom
/**
 * @fileoverview Tests for useTheme.js.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'bindervault-theme';

function mockMatchMedia(matchesDark) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(prefers-color-scheme: dark)' ? matchesDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false); // system preference: light, by default
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to the system preference (dark) when nothing is stored', async () => {
    mockMatchMedia(true);
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('defaults to light when the system prefers light and nothing is stored', async () => {
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('uses whatever was already stored, ignoring system preference', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    mockMatchMedia(false); // system says light, stored says dark
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('sets the data-theme attribute on the document root immediately on mount', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { useTheme } = await import('../useTheme.js');
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme flips between dark and light', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('persists the theme to localStorage whenever it changes', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setDark and setLight set the theme explicitly regardless of current value', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { useTheme } = await import('../useTheme.js');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setDark());
    expect(result.current.theme).toBe('dark');

    act(() => result.current.setLight());
    expect(result.current.theme).toBe('light');
  });
});
