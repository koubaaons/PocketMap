/**
 * @fileoverview useSupabaseSync — loads user data from Supabase on mount.
 *
 * Called once in App.jsx after the user is authenticated. Fetches all
 * seven tables in parallel (loadStateFromSupabase), then dispatches a
 * single HYDRATE action to replace the store's current state with the
 * server data.
 *
 * Falls back to localStorage silently if Supabase returns an error —
 * the user sees their local data and can keep working offline. The
 * next successful Supabase load will overwrite the local data.
 *
 * Returns { syncing } so App.jsx can show a loading screen while the
 * initial fetch is in flight, preventing a flash of empty state.
 */

import { useEffect, useState } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { loadStateFromSupabase } from '../store/storage.js';
import { useAuth } from './useAuth.js';

export function useSupabaseSync() {
  const dispatch  = useDispatch();
  const { user }  = useAuth();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Only run when we have an authenticated user.
    // If there's no user, the AuthGate will handle showing the login screen.
    if (!user) {
      setSyncing(false);
      return;
    }

    let cancelled = false;

    async function sync() {
      setSyncing(true);

      const serverState = await loadStateFromSupabase();

      if (cancelled) return;

      if (serverState) {
        // Server data loaded successfully — hydrate the store.
        // HYDRATE replaces all data slices at once without touching nav.
        dispatch({
          type:    ACTIONS.HYDRATE,
          payload: serverState,
        });
      } else {
        // Supabase failed — keep the localStorage data already in the
        // store from the initial buildInitialState() call.
        console.warn('[useSupabaseSync] Supabase unavailable, using localStorage fallback');
      }

      setSyncing(false);
    }

    sync();

    return () => { cancelled = true; };
  }, [user?.id]); // re-sync when the logged-in user changes

  return { syncing };
}