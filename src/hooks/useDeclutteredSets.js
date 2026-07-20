/**
 * @fileoverview useDeclutteredSets — remembers which Pokémon TCG sets
 * a user has hidden from the sets browser (PokemonSetsBrowser.jsx).
 *
 * Deliberately local-only (browser localStorage), not synced through
 * the app's normal Supabase-backed store: this is a display
 * preference about browsing the API's set catalog, not collection
 * data — nothing here is a card, a binder, or anything the person
 * actually owns. It won't follow them to a new browser/device, which
 * is an acceptable tradeoff for something this low-stakes.
 */

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'pinder:decluttered-set-ids';

function loadStoredIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredIds(idSet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...idSet]));
  } catch {
    // Storage full/unavailable — the preference just won't persist
    // this session; not worth surfacing an error for something this
    // low-stakes.
  }
}

export function useDeclutteredSets() {
  const [declutteredIds, setDeclutteredIds] = useState(loadStoredIds);

  const declutter = useCallback((ids) => {
    setDeclutteredIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      saveStoredIds(next);
      return next;
    });
  }, []);

  const restore = useCallback((ids) => {
    setDeclutteredIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      saveStoredIds(next);
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setDeclutteredIds(new Set());
    saveStoredIds(new Set());
  }, []);

  return { declutteredIds, declutter, restore, restoreAll };
}