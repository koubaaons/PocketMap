/**
 * @fileoverview useAuth — Supabase auth state hook.
 *
 * Wraps Supabase's onAuthStateChange listener and exposes the current
 * session and user to any component that needs it. Uses a module-level
 * singleton pattern (same as useStore/useTheme) so the listener is
 * only registered once regardless of how many components call this hook.
 *
 * Returns:
 *   user     — the Supabase User object, or null if not logged in
 *   loading  — true while the initial session check is in flight
 *              (prevents a flash of the login screen on page reload
 *               when the user is already logged in)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase.js';
import { runImageMigrationIfNeeded } from '../utils/migrateImagesToStorage.js';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current session immediately on mount — handles the case
    // where the user already has a valid session from a previous visit.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // === ISSUE #125: also check here, not just on the SIGNED_IN
      // event below. onAuthStateChange's SIGNED_IN typically only
      // fires on a fresh sign-in action — a restored session from a
      // previous visit (the common case for anyone who stays logged
      // in) wouldn't fire it at all, meaning the migration would
      // never run for exactly the users most likely to have old
      // base64 images sitting around. ===
      if (session?.user?.id) {
        runImageMigrationIfNeeded(session.user.id);
      }
    });

    // Subscribe to future auth changes (login, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        // === ISSUE #125: one-time base64→Storage image migration ===
        // Only on an actual sign-in, not every token refresh — the
        // migration's own localStorage flag already makes repeat
        // calls a no-op, but there's no reason to even check on every
        // refresh when SIGNED_IN already tells us definitively.
        if (event === 'SIGNED_IN' && session?.user?.id) {
          runImageMigrationIfNeeded(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}