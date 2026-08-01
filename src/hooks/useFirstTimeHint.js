/**
 * @fileoverview useFirstTimeHint — tracks whether a specific,
 * dismissible onboarding hint has already been seen by the current
 * account, so it only ever shows once.
 *
 * Generic and reusable by design: any hint (this one for fullscreen
 * while customizing a cover, a future one for discovering Plan mode,
 * etc.) is identified by its own hintKey, each tracked completely
 * independently.
 *
 * Deliberately local-only (browser localStorage), matching the exact
 * same reasoning as useDeclutteredSets.js — this is a low-stakes UI
 * preference (has this specific hint been dismissed), not real
 * account data, so it doesn't need to be synced through the app's
 * normal Supabase-backed store. It won't follow the user to a new
 * browser/device, which is an acceptable tradeoff for something this
 * low-stakes — worst case, they just see a helpful tip again once.
 *
 * === Applies the exact fix already learned from a real bug in
 * useDeclutteredSets.js: useAuth resolves asynchronously and isn't a
 * singleton, so userId is reliably undefined at the moment any
 * useState initializer here first runs. Re-checks during render once
 * the real userId actually arrives (React's own recommended pattern
 * for this, not a useEffect that calls setState), rather than
 * repeating that same timing mistake in a second hook. ===
 */

import { useRef, useState } from 'react';
import { useAuth } from './useAuth.js';

function storageKeyFor(userId, hintKey) {
  return `pinder:hint-seen:${hintKey}:${userId ?? 'anonymous'}`;
}

function loadSeen(userId, hintKey) {
  try {
    return localStorage.getItem(storageKeyFor(userId, hintKey)) === 'true';
  } catch {
    return false;
  }
}

/**
 * @param {string} hintKey - a short, unique identifier for this specific hint
 * @returns {{ showHint: boolean, dismiss: () => void }}
 */
export function useFirstTimeHint(hintKey) {
  const { user } = useAuth();
  const userId = user?.id;
  const [seen, setSeen] = useState(() => loadSeen(userId, hintKey));

  const loadedForUserId = useRef(userId);
  if (loadedForUserId.current !== userId) {
    loadedForUserId.current = userId;
    setSeen(loadSeen(userId, hintKey));
  }

  const dismiss = () => {
    setSeen(true);
    try {
      localStorage.setItem(storageKeyFor(userId, hintKey), 'true');
    } catch {
      // Storage full/unavailable — the hint just won't persist as
      // dismissed for next time; not worth surfacing an error for
      // something this low-stakes.
    }
  };

  return { showHint: !seen, dismiss };
}
