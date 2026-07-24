// @vitest-environment jsdom
/**
 * @fileoverview Tests for useStore.js (useStore + useDispatch).
 *
 * Uses the real store singleton rather than mocking it, dispatching
 * only ACTIONS.NAV_SET — the one action guaranteed not to trigger
 * localStorage persistence or a Supabase sync attempt (it's not in
 * PERSISTED_ACTIONS), so these tests can safely exercise the real
 * subscribe/notify plumbing without needing to mock the entire
 * storage/sync layer.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore, useDispatch } from '../useStore.js';
import { store, ACTIONS } from '../../store/index.js';

describe('useStore', () => {
  it('with no selector, returns the full store state', () => {
    const { result } = renderHook(() => useStore());
    expect(result.current).toBe(store.getState());
  });

  it('with a selector, returns just the selected slice', () => {
    const { result } = renderHook(() => useStore(s => s.nav));
    expect(result.current).toEqual(store.getState().nav);
  });

  it('updates when the selected value actually changes', () => {
    const { result } = renderHook(() => useStore(s => s.nav.currentView));

    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentView: 'test-view-a' } }); });
    expect(result.current).toBe('test-view-a');

    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentView: 'test-view-b' } }); });
    expect(result.current).toBe('test-view-b');
  });

  it('does not re-render when the selected value did not actually change', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useStore(s => s.nav.currentView);
    });
    const countAfterMount = renderCount;

    // Dispatch a NAV_SET that sets currentView to its OWN current value
    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentView: result.current } }); });

    expect(renderCount).toBe(countAfterMount); // no re-render triggered
  });

  it('a component using a narrow selector does not re-render when an unrelated part of state changes', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount++;
      return useStore(s => s.nav.currentView);
    });
    const countAfterMount = renderCount;

    // Change something the selector doesn't care about
    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentBinderId: 'some-other-binder' } }); });

    expect(renderCount).toBe(countAfterMount);
  });

  it('always uses the latest selector, even though the internal subscription is only set up once', () => {
    // This directly exercises the "keep a ref updated after render,
    // read it inside the store-change callback" pattern useStore.js
    // uses instead of resubscribing whenever an inline selector's
    // reference changes every render.
    const { result, rerender } = renderHook(
      ({ field }) => useStore(s => s.nav[field]),
      { initialProps: { field: 'currentView' } }
    );

    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentView: 'view-x', currentBinderId: 'binder-x' } }); });
    expect(result.current).toBe('view-x');

    rerender({ field: 'currentBinderId' }); // a brand-new inline selector function
    act(() => { store.dispatch({ type: ACTIONS.NAV_SET, payload: { currentBinderId: 'binder-y' } }); });

    expect(result.current).toBe('binder-y'); // reflects the NEW selector, not the old one
  });
});

describe('useDispatch', () => {
  it('returns a function that dispatches to the real store', () => {
    const { result } = renderHook(() => useDispatch());
    act(() => { result.current({ type: ACTIONS.NAV_SET, payload: { currentView: 'dispatch-test' } }); });

    expect(store.getState().nav.currentView).toBe('dispatch-test');
  });

  it('returns the exact same function reference across multiple renders — regression test for the real bug where .bind() was called fresh every invocation', () => {
    const { result, rerender } = renderHook(() => useDispatch());
    const first = result.current;

    rerender();
    const second = result.current;

    expect(first).toBe(second);
  });

  it('returns the same reference across two entirely separate hook instances too', () => {
    const { result: a } = renderHook(() => useDispatch());
    const { result: b } = renderHook(() => useDispatch());

    expect(a.current).toBe(b.current);
  });
});
