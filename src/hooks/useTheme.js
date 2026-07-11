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

function applyTheme(theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    // Add transitioning attribute so CSS transitions fire simultaneously
    root.setAttribute('data-theme-transitioning', '');
    // Switch theme on next frame so the attribute is applied first
    requestAnimationFrame(() => {
      root.setAttribute('data-theme', theme);
      // Remove after transition completes (--transition-slow = 0.3s)
      setTimeout(() => root.removeAttribute('data-theme-transitioning'), 350);
    });
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme();
    applyTheme(initial);
    return initial;
  });

  // Apply whenever theme changes
  useEffect(() => {
    // Don't animate on mount or localStorage restore — only on user toggle
    document.documentElement.setAttribute('data-theme', theme);
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

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true); // animate the switch
    setTheme(next);
  };
  const setDark  = () => setTheme('dark');
  const setLight = () => setTheme('light');

  return { theme, toggleTheme, setDark, setLight, isDark: theme === 'dark' };
}

// === ISSUE #69 END: Theme Toggle ===