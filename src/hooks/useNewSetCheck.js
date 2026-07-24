/**
 * @fileoverview useNewSetCheck — Issue #134, new-set detection.
 *
 * Deliberately check-on-open, not a real server-side scheduled job —
 * there's no push notification or email this feature needs to
 * deliver, only an in-app banner the next time someone opens the app,
 * so a background cron job would add real infrastructure (a
 * scheduled Edge Function, its own failure monitoring) for a result
 * nobody would see any sooner than a check-on-open already provides.
 *
 * Diffs the full current set list against known_set_ids (every set
 * id this account has ever been shown), rather than assuming "new"
 * always means "released after the last known release date" — a
 * reprint or historical set added to the API later wouldn't be
 * chronologically newest, but would still be new to this account.
 *
 * Capped to once per day via last_new_set_check_at, not every single
 * page load — re-fetching and re-diffing the whole set list on every
 * render would be pure waste for data that only actually changes a
 * handful of times a year.
 *
 * The very first check for any account (known_set_ids still empty)
 * never reports anything as "new" — every set would look new against
 * an empty baseline, which would mean a brand-new account seeing a
 * "47 new sets!" banner on literally its first visit. That first
 * check just silently records the full baseline instead.
 */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { getUserPreferences, recordNewSetCheck } from '../services/userPreferences.js';
import { fetchAllSets } from '../services/activeProvider.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

/**
 * @returns {{ newSets: object[], dismiss: () => void }}
 *   `newSets` is empty until a check actually finds something. `dismiss`
 *   clears it from local state for the rest of this session (it won't
 *   reappear on its own — the next real check only happens after the
 *   daily interval, and won't re-report the same sets since they're
 *   now part of known_set_ids).
 */
export function useNewSetCheck() {
  const { user } = useAuth();
  const [newSets, setNewSets] = useState([]);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!user || hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        const lastChecked = prefs.lastNewSetCheckAt ? new Date(prefs.lastNewSetCheckAt).getTime() : null;
        const dueForCheck = !lastChecked || (Date.now() - lastChecked) >= CHECK_INTERVAL_MS;
        if (!dueForCheck) return;

        const sets = await fetchAllSets();
        const currentIds = sets.map(s => s.id);

        const isFirstEverCheck = prefs.knownSetIds.length === 0;
        if (!isFirstEverCheck) {
          const knownIdSet = new Set(prefs.knownSetIds);
          const freshlySeen = sets.filter(s => !knownIdSet.has(s.id));
          if (freshlySeen.length > 0) setNewSets(freshlySeen);
        }

        await recordNewSetCheck(user.id, currentIds);
      } catch (err) {
        console.error('[useNewSetCheck] check failed:', err);
      }
    })();
  }, [user]);

  return { newSets, dismiss: () => setNewSets([]) };
}
