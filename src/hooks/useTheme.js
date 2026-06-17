/**
 * @fileoverview useTheme hook.
 *
 * Manages dark/light theme state.
 * - Defaults to system preference (prefers-color-scheme)
 * - Persists user choice to localStorage
 * - Applies data-theme attribute to document root
 * - Exposes toggle function and current theme
 */

// === ISSUE #69 START: Theme Toggle ===

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bindervault-theme';

function getInitialTheme() {
  // Check localStorage first — user preference wins
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';

  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme();
    applyTheme(initial);
    return initial;
  });

  // Apply whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return; // user has explicit preference, don't override

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const setDark  = () => setTheme('dark');
  const setLight = () => setTheme('light');

  return { theme, toggleTheme, setDark, setLight, isDark: theme === 'dark' };
}

// === ISSUE #69 END: Theme Toggle ===