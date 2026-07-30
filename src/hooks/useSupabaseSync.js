/**
 * @fileoverview useSupabaseSync — loads user data from Supabase on mount
 * and keeps it in sync across devices via Supabase Realtime.
 *
 * Two effects:
 *   1. Initial load — fetches all tables, hydrates store
 *   2. Realtime subscription — re-fetches on any change from another device
 *
 * Last-write-wins conflict resolution — always takes server data.
 * Debounced re-fetch (300ms) so rapid changes don't hammer Supabase.
 *
 * Returns { syncing, lastSynced } for App.jsx and AccountView.
 */

import { useEffect, useState } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS, waitForPendingSyncs } from '../store/index.js';
import { loadStateFromSupabase } from '../store/supabaseStorage.js';
import { loadState } from '../store/storage.js';
import { useAuth } from './useAuth.js';
import { supabase } from '../services/supabase.js';

const DEBUG = import.meta.env.DEV;

export function useSupabaseSync() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [syncing, setSyncing]       = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  // ── Effect 1: Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to sync without a user; this is the terminal state for this effect, not derivable during render
      setSyncing(false);
      return;
    }

    let cancelled = false;

    async function sync() {
      setSyncing(true);

      // === Real bug fixed: records which account is now logged in,
      // and — critically — the reducer's AUTH_SET case atomically
      // clears any previous account's data if this is a genuine
      // switch, so nothing from a different account can be shown,
      // edited, or persisted under this one's identity even for a
      // moment, regardless of what happens next (including if the
      // Supabase load below fails or is slow).
      dispatch({ type: ACTIONS.AUTH_SET, payload: { id: user.id } });

      // Offline-first: load and show THIS account's own local cache
      // immediately, while the fresh Supabase fetch is in flight —
      // never a different, stale account's data (the old bug: a
      // single, unscoped localStorage key shared by every account on
      // this browser).
      const localCache = loadState(user.id);
      if (!cancelled) dispatch({ type: ACTIONS.HYDRATE, payload: localCache });

      const serverState = await loadStateFromSupabase();
      if (cancelled) return;

      if (serverState) {
        dispatch({ type: ACTIONS.HYDRATE, payload: serverState });
        setLastSynced(new Date());
      } else {
        DEBUG && console.warn('[useSupabaseSync] Supabase unavailable, using localStorage fallback');
      }
      // Always reset nav to home on login — the store is a singleton
      // and persists in memory across logout/login in the same browser session.
      dispatch({ type: ACTIONS.NAV_SET, payload: { currentView: 'home', currentBinderId: null, currentCollectionId: null, currentPage: 1 } });
      setSyncing(false);
    }

    sync();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately user?.id, not the whole user object: a token refresh gives a new user object for the same logical user, and re-running this full reload + realtime-subscription effect for that would be wrong, not just wasteful
  }, [user?.id, dispatch]);

  // ── Effect 2: Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let debounceTimer = null;

    async function handleChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        // === FIX: this used to re-fetch immediately after the 300ms
        // debounce with no idea whether a write THIS SAME CLIENT just
        // made had actually finished committing yet. Since this event
        // fires on our own writes too (the filter is just "this
        // user", not "changes from elsewhere"), a delete followed by
        // Save could have its own re-fetch race ahead of the delete's
        // own upsert, read stale data, and silently overwrite the
        // just-made change back to its old state. Waiting for
        // everything currently in flight to settle first closes that
        // race — see store/index.js and supabaseSync.js for the
        // tracking this relies on. ===
        await waitForPendingSyncs();
        const serverState = await loadStateFromSupabase();
        if (serverState) {
          dispatch({ type: ACTIONS.HYDRATE, payload: serverState });
          setLastSynced(new Date());
        }
      }, 300);
    }

    const channel = supabase
      .channel(`user-data-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          filter: `user_id=eq.${user.id}`,
        },
        handleChange
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          DEBUG && console.info('[useSupabaseSync] Realtime connected');
        }
        if (status === 'CHANNEL_ERROR') {
          DEBUG && console.warn('[useSupabaseSync] Realtime connection error');
        }
      });

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately user?.id, not the whole user object — same reasoning as the effect above
  }, [user?.id, dispatch]);

  return { syncing, lastSynced };
}