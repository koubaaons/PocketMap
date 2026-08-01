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
 *
 * === Real bug fixed: the storage key used to be completely global
 * (no user id in it at all), meaning every account signed into the
 * same browser shared the exact same decluttered-sets list —
 * decluttering sets in one account silently bled into every other
 * account tested on that same device. Scoped by userId now, so
 * different accounts genuinely stay independent. ===
 */

import { useCallback, useRef, useState } from 'react';
import { useAuth } from './useAuth.js';

function storageKeyFor(userId) {
  return `pinder:decluttered-set-ids:${userId ?? 'anonymous'}`;
}

function loadStoredIds(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredIds(userId, idSet) {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify([...idSet]));
  } catch {
    // Storage full/unavailable — the preference just won't persist
    // this session; not worth surfacing an error for something this
    // low-stakes.
  }
}

export function useDeclutteredSets() {
  const { user } = useAuth();
  const userId = user?.id;
  const [declutteredIds, setDeclutteredIds] = useState(() => loadStoredIds(userId));

  // === Real bug fixed: useAuth resolves asynchronously, and every
  // fresh mount of whatever calls this hook starts with a fresh,
  // unresolved auth check (user:null) — meaning userId was reliably
  // undefined at the exact moment the useState initializer above ran,
  // on every single mount. It always loaded from the wrong, empty
  // 'anonymous' key, even though the real user's own key genuinely
  // had the correct, previously-saved data sitting there the whole
  // time — it just never got loaded.
  //
  // Re-syncs from storage during render once the real userId actually
  // becomes available, using React's own recommended pattern for
  // "adjust state when a prop changes" (a ref comparison during
  // render) rather than a useEffect that calls setState — the latter
  // works too, but costs an extra, avoidable render cycle every time.
  const loadedForUserId = useRef(userId);
  if (loadedForUserId.current !== userId) {
    loadedForUserId.current = userId;
    if (userId) setDeclutteredIds(loadStoredIds(userId));
  }

  const declutter = useCallback((ids) => {
    setDeclutteredIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      saveStoredIds(userId, next);
      return next;
    });
  }, [userId]);

  const restore = useCallback((ids) => {
    setDeclutteredIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      saveStoredIds(userId, next);
      return next;
    });
  }, [userId]);

  const restoreAll = useCallback(() => {
    setDeclutteredIds(new Set());
    saveStoredIds(userId, new Set());
  }, [userId]);

  return { declutteredIds, declutter, restore, restoreAll };
}
