/**
 * @fileoverview Supabase client — single instance shared across the app.
 *
 * Environment variables (set in .env.local, never committed to git):
 *   VITE_SUPABASE_URL      — your project URL from supabase.com
 *   VITE_SUPABASE_ANON_KEY — your project's anon/public key
 *
 * Usage:
 *   import { supabase } from '../services/supabase.js';
 *   const { data, error } = await supabase.auth.signUp({ email, password });
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Pinder] Missing Supabase environment variables.\n' +
    'Create a .env.local file in the project root with:\n' +
    '  VITE_SUPABASE_URL=https://your-project.supabase.co\n' +
    '  VITE_SUPABASE_ANON_KEY=your-anon-key'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);