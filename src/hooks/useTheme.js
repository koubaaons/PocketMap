/**
 * @fileoverview useTheme hook.
 *
 * Manages dark/light theme state.
 * - Defaults to system preference (prefers-color-scheme)
 * - Persists user choice to localStorage
 * - Applies data-theme attribute to document root
 * - Exposes toggle function and current theme
 *
 * Theme switching approach:
 * All CSS transitions reference --transition-fast or --transition-slow.
 * On toggle, we temporarily override both to the same value (0.3s) at
 * the :root level so every element changes colour simultaneously.
 * GPU-composited elements (.book-flip-container etc) are demoted by
 * adding a no-compositing class before the switch and removed after.
 */

// === ISSUE #69 START: Theme Toggle ===

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bindervault-theme';
const TRANSITION_DURATION = '0.3s';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme, animate = false) {
  const root = document.documentElement;

  if (!animate) {
    root.setAttribute('data-theme', theme);
    return;
  }

  // Step 1: override both transition duration variables to the same value
  // so every element — fast or slow — transitions simultaneously
  root.style.setProperty('--transition-fast', TRANSITION_DURATION);
  root.style.setProperty('--transition-slow', TRANSITION_DURATION);

  // Switch on next frame so the variable overrides are applied first
  requestAnimationFrame(() => {
    root.setAttribute('data-theme', theme);

    // Restore original variable values after transition completes
    setTimeout(() => {
      root.style.removeProperty('--transition-fast');
      root.style.removeProperty('--transition-slow');
    }, 400);
  });
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme();
    applyTheme(initial);
    return initial;
  });

  // Persist to localStorage whenever theme changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Follow system preference if user hasn't set an explicit preference
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    setTheme(next);
  };

  const setDark  = () => { applyTheme('dark',  true); setTheme('dark');  };
  const setLight = () => { applyTheme('light', true); setTheme('light'); };

  return { theme, toggleTheme, setDark, setLight, isDark: theme === 'dark' };
}

// === ISSUE #69 END: Theme Toggle ===