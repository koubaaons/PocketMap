/**
 * @fileoverview useSeedLoader — Issue #135, Seed Loader on First Launch.
 *
 * A brand-new account (zero collections) gets the most-recently-
 * released set auto-imported as a starter collection, right after
 * the initial hydration finishes — so there's something to actually
 * explore (binders, holo effects, favoriting, checking cards off)
 * within the first few seconds, instead of staring at an empty app
 * and needing to figure out "go import a set" before experiencing
 * anything the product actually does.
 *
 * Runs exactly once per account, ever — gated by
 * user_preferences.seeded_starter_collection, checked server-side
 * (not a localStorage flag) so switching devices, or clearing browser
 * storage, can't accidentally trigger it again.
 *
 * === Self-healing for pre-existing accounts ===
 * An account that already has real collections, but whose
 * user_preferences row doesn't exist yet (anyone who signed up before
 * this feature existed), is NOT a blank slate — it must never get a
 * surprise starter collection just because its row happens to be
 * missing. Rather than requiring a one-time data backfill migration
 * for every existing account, this hook self-heals instead: the first
 * time it runs for such an account, it silently marks
 * seeded_starter_collection true (no import happens) rather than
 * treating "no row yet" as "definitely brand new". This also covers
 * the case where an account genuinely started blank, got seeded, and
 * later deleted every collection — the flag, once set, stops this
 * from ever re-triggering regardless of collections.length at any
 * later point in time.
 *
 * Reuses useCollectionActions.handleCreate for the actual dispatch —
 * that hook already fixed a real bug around dispatch ordering
 * (collections.collection_id has a foreign key constraint on
 * collections(id); dispatching card definitions before the
 * collection's own write had committed caused an intermittent lost
 * card). Duplicating that sequencing here would risk reintroducing
 * exactly that bug.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { useCollectionActions } from './useCollectionActions.js';
import { getUserPreferences, markStarterCollectionSeeded } from '../services/userPreferences.js';
import { fetchAllSets } from '../services/activeProvider.js';
import { buildCollectionFromSet } from '../services/tcgImport.js';

/**
 * @param {{ syncing: boolean, collections: object[], toast: (msg: string, type?: string) => void }} params
 *   `syncing` should be useSupabaseSync's own syncing flag — this
 *   must wait for the initial hydration to finish before it can trust
 *   collections.length as "this account's real current state" rather
 *   than a stale pre-hydration snapshot.
 */
export function useSeedLoader({ syncing, collections, toast }) {
  const { user } = useAuth();
  // Suppress handleCreate's own generic "Collection X created" toast —
  // this moment gets a warmer, welcome-specific message instead, fired
  // separately below once the import actually succeeds.
  const { handleCreate } = useCollectionActions(() => {});
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (syncing || !user || hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      const prefs = await getUserPreferences(user.id);
      if (prefs.seededStarterCollection) return; // already handled, either way

      if (collections.length > 0) {
        // Pre-existing account whose preferences row predates this
        // feature — not a blank slate. Record it as handled without
        // importing anything.
        await markStarterCollectionSeeded(user.id);
        return;
      }

      // Genuinely brand new, empty account — seed it for real.
      try {
        const sets = await fetchAllSets();
        if (sets.length === 0) return;

        const newestSet = [...sets].sort(
          (a, b) => new Date(b.releaseDate) - new Date(a.releaseDate)
        )[0];

        // Fired before the work starts, not just after — a full set
        // import against a free, open card database can take a
        // minute or two, and with no visible progress indicator here
        // (unlike the manual import modal, which has one), a
        // brand-new user would otherwise get zero feedback for that
        // whole stretch, easily reading as "broken" rather than
        // "working".
        toast(`Setting up your first collection ("${newestSet.name}") — this may take a minute since we use a free, open card database.`, 'success', 6000);

        const { collection, templateFields, cardDefinitions } = await buildCollectionFromSet(newestSet);
        await handleCreate({ collection, templateFields, cardDefinitions });
        await markStarterCollectionSeeded(user.id);

        toast(`Welcome! We've added "${collection.name}" to get you started — take a look around.`);
      } catch (err) {
        console.error('[useSeedLoader] failed to seed starter collection:', err);
        // Deliberately NOT marking as seeded on failure — worth
        // trying again next time the account opens the app, rather
        // than silently giving up forever because of one network
        // hiccup on this specific attempt.
      }
    })();
  }, [syncing, user, collections.length, handleCreate, toast]);
}
