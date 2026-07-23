/**
 * @fileoverview useStore hook — connects a component to the global store.
 *
 * Components call this hook with an optional selector to avoid
 * unnecessary re-renders when unrelated parts of state change.
 *
 * Usage:
 *   // Full state (re-renders on any change):
 *   const state = useStore();
 *
 *   // Derived state (re-renders only when selected value changes):
 *   const cards = useStore(s => s.cards);
 *   const binder = useStore(s => s.binders.find(b => b.id === id));
 */

import { useState, useEffect, useRef } from 'react';
import { store } from '../store/index.js';

/**
 * @template T
 * @param {((state: object) => T) | null} [selector]
 * @returns {T}
 */
export function useStore(selector = null) {
  const selectorRef = useRef(selector);

  // Keep the ref current after every render (not during render itself
  // — see this file's own comment on the subscription effect below
  // for why that distinction matters).
  useEffect(() => {
    selectorRef.current = selector;
  });

  // Initial value computed directly from the selector argument, not
  // through the ref — a ref should only ever be read from an effect
  // or callback, never synchronously during render.
  const [value, setValue] = useState(() => {
    const state = store.getState();
    return selector ? selector(state) : state;
  });

  useEffect(() => {
    // This subscription is set up exactly once (empty dependency
    // array) rather than every time `selector` changes identity —
    // callers very often pass an inline arrow function
    // (`useStore(s => s.foo)`), which is a brand-new function on
    // every render, so depending on it directly would mean
    // unsubscribing and resubscribing on every single render of every
    // component using this hook. Reading `selectorRef.current` here
    // instead of `selector` directly gets the same "always use the
    // latest selector" behavior without that churn — and this read
    // happens inside a store-change callback, not during render, so
    // it's a legitimate place to read a ref's live value.
    return store.subscribe(() => {
      const state = store.getState();
      const next = selectorRef.current ? selectorRef.current(state) : state;
      setValue(prev => (prev === next ? prev : next));
    });
  }, []);

  return value;
}

/**
 * Returns the dispatch function (stable reference, never changes).
 *
 * === FIX (real bug): the implementation used to call
 * `store.dispatch.bind(store)` fresh on every single invocation of
 * this hook — a NEW function reference every time, despite this
 * comment's own claim that it's stable. Since `store` is a singleton
 * and its dispatch never actually needs re-binding, the bound
 * function is now computed once, at module load, genuinely matching
 * what this comment always said. This mattered in practice: any
 * effect that correctly listed `dispatch` as a dependency (as the
 * exhaustive-deps rule wants) would have re-run on every single
 * render, since the old dispatch was never actually the same
 * reference twice.
 * @returns {(action: object) => void}
 */
const stableDispatch = store.dispatch.bind(store);
export function useDispatch() {
  return stableDispatch;
}