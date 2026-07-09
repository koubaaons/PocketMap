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

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the current session immediately on mount — handles the case
    // where the user already has a valid session from a previous visit.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to future auth changes (login, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}