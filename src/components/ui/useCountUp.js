/**
 * @fileoverview useCountUp — split out of components/ui/index.jsx so
 * that file exports only components. See contexts/useBinderData.js's
 * comment for why (React Fast Refresh needs a file's exports to be
 * exclusively components to hot-reload reliably) — ui/index.jsx is
 * imported very widely, so this one mattered more than most.
 *
 * Animates numeric values from 0 up to their target over ~900ms using
 * requestAnimationFrame, re-triggering whenever the target itself
 * changes (so it also plays if stats update live, not just on first
 * mount). Non-numeric values pass through untouched.
 */

import { useState, useEffect } from 'react';

export function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (typeof target !== 'number') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- passthrough case for an effect that's otherwise driving a real requestAnimationFrame loop below
      setDisplay(target);
      return;
    }

    let raf;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(target * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
