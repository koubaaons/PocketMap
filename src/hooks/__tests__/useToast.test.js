// @vitest-environment jsdom
/**
 * @fileoverview Tests for useToast.js.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast.js';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('toast() adds a new toast with the given message and type', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.toast('Saved!', 'success'));

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ message: 'Saved!', type: 'success' });
  });

  it('defaults type to "success" when not specified', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.toast('Hello'));
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('each toast gets a unique, incrementing id', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast('First');
      result.current.toast('Second');
    });
    const [first, second] = result.current.toasts;
    expect(first.id).not.toBe(second.id);
  });

  it('multiple toasts can be shown at once, in the order they were added', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast('First');
      result.current.toast('Second');
    });
    expect(result.current.toasts.map(t => t.message)).toEqual(['First', 'Second']);
  });

  it('dismiss() removes exactly the toast with the given id, leaving others', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast('First');
      result.current.toast('Second');
    });
    const idToRemove = result.current.toasts[0].id;

    act(() => result.current.dismiss(idToRemove));

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second');
  });

  it('auto-dismisses after the default duration (2500ms)', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.toast('Bye soon'));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(2500));

    expect(result.current.toasts).toHaveLength(0);
  });

  it('respects a custom duration instead of the default', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.toast('Lingers', 'success', 5000));

    act(() => vi.advanceTimersByTime(2500)); // default duration passed, custom hasn't
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(2500)); // now the full 5000ms has passed
    expect(result.current.toasts).toHaveLength(0);
  });
});
