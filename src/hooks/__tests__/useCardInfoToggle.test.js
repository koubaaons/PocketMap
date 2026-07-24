// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardInfoToggle.js.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardInfoToggle } from '../useCardInfoToggle.js';

const STORAGE_KEY = 'pinder-show-card-info';

describe('useCardInfoToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-show-card-info');
  });

  it('defaults to shown (true) when nothing is stored', () => {
    const { result } = renderHook(() => useCardInfoToggle());
    expect(result.current.showCardInfo).toBe(true);
  });

  it('respects a previously stored "false" value', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    const { result } = renderHook(() => useCardInfoToggle());
    expect(result.current.showCardInfo).toBe(false);
  });

  it('toggle() flips the current value', () => {
    const { result } = renderHook(() => useCardInfoToggle());
    act(() => result.current.toggle());
    expect(result.current.showCardInfo).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.showCardInfo).toBe(true);
  });

  it('persists the value to localStorage whenever it changes', () => {
    const { result } = renderHook(() => useCardInfoToggle());
    act(() => result.current.toggle());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('sets data-show-card-info on the document root — the mechanism that avoids prop-drilling this value everywhere', () => {
    const { result } = renderHook(() => useCardInfoToggle());
    act(() => result.current.toggle());
    expect(document.documentElement.getAttribute('data-show-card-info')).toBe('false');
  });
});
