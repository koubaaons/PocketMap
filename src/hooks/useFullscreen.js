/**
 * @fileoverview useFullscreen — wraps the browser's native Fullscreen API
 * to make a specific element (passed in as a ref) fill the entire monitor,
 * not just the browser viewport.
 * === ISSUE #93 (final approach) ===
 *
 * Deliberately simple: this hook does NOT resize, measure, or transform
 * anything. It just asks the browser to put one existing element into
 * real fullscreen. Whatever that element already renders — and however
 * it's already laid out (centering, sizing, etc.) — keeps working exactly
 * as-is, just inside a bigger box. No scale math, no portal, no separate
 * fullscreen-specific markup needed in the consuming component.
 *
 * Usage:
 *   const rootRef = useRef(null);
 *   const { isFullscreen, toggleFullscreen } = useFullscreen(rootRef);
 *   <div ref={rootRef}>...entire existing view, unchanged...</div>
 */

import { useState, useCallback, useEffect } from 'react';

export function useFullscreen(elementRef) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Some browsers/contexts reject requestFullscreen (e.g. not a
          // direct user gesture, or restricted environment). Fall back to
          // the CSS-driven fullscreen-style state so the toggle still does
          // something useful, just without true OS-level fullscreen.
          setIsFullscreen(true);
        });
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => setIsFullscreen(false));
    }
  }, [elementRef]);

  // Covers ALL exit paths automatically: the toggle button, ESC (handled
  // natively by the browser once real fullscreen is active), F11, or any
  // other browser-native fullscreen exit — isFullscreen always stays in
  // sync with reality.
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  return { isFullscreen, toggleFullscreen };
}