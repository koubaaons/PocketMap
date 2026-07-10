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
import { ACTIONS } from '../store/index.js';
import { loadStateFromSupabase } from '../store/storage.js';
import { useAuth } from './useAuth.js';
import { supabase } from '../services/supabase.js';

export function useSupabaseSync() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [syncing, setSyncing]       = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  // ── Effect 1: Initial load ───────────────────────────────────────────────────
  useEffect(() => {
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
        dispatch({ type: ACTIONS.HYDRATE, payload: serverState });
        setLastSynced(new Date());
      } else {
        console.warn('[useSupabaseSync] Supabase unavailable, using localStorage fallback');
      }
      setSyncing(false);
    }

    sync();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Effect 2: Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let debounceTimer = null;

    async function handleChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
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
          console.info('[useSupabaseSync] Realtime connected');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[useSupabaseSync] Realtime connection error');
        }
      });

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return { syncing, lastSynced };
}