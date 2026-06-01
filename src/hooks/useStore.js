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

import { useState, useEffect, useRef, useCallback } from 'react';
import { store } from '../store/index.js';

/**
 * @template T
 * @param {((state: object) => T) | null} [selector]
 * @returns {T}
 */
export function useStore(selector = null) {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSelected = useCallback(() => {
    const state = store.getState();
    return selectorRef.current ? selectorRef.current(state) : state;
  }, []);

  const [value, setValue] = useState(getSelected);

  useEffect(() => {
    // Check if value actually changed before triggering re-render
    return store.subscribe(() => {
      const next = getSelected();
      setValue(prev => {
        if (prev === next) return prev;
        return next;
      });
    });
  }, [getSelected]);

  return value;
}

/**
 * Returns the dispatch function (stable reference, never changes).
 * @returns {(action: object) => void}
 */
export function useDispatch() {
  return store.dispatch.bind(store);
}