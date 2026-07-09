/**
 * @fileoverview useTransitioningPairs + getEffectiveZIndex — z-index
 * timing logic for BinderBookFlip's page-pair flip animation.
 *
 * Extracted from BinderBookFlip.jsx where this logic lived inline
 * alongside the render tree. Both functions are pure logic with no
 * JSX dependency, making them independently testable.
 *
 * === What this file owns ===
 * - FLIP_TRANSITION_MS: the flip animation duration in ms (exported so
 *   BinderBookFlip can still reference it for its own showRightFrame
 *   delay, which is a separate concern from z-index timing but uses
 *   the same constant).
 * - getPairZIndex: pure function, two-pile z-index ordering at rest.
 * - useTransitioningPairs: hook that tracks which pairs are currently
 *   mid-rotation.
 * - getEffectiveZIndex: combines getPairZIndex + transition boost.
 * - TRANSITION_Z_BOOST: the boost applied to mid-rotating pairs.
 */

import { useEffect, useRef, useState } from 'react';

export const FLIP_TRANSITION_MS = 700;
const TRANSITION_Z_BOOST = 10000;

function getPairZIndex(pairSpreadIndex, totalSpreads, isFlipped) {
  return isFlipped
    ? pairSpreadIndex
    : totalSpreads - pairSpreadIndex;
}

/**
 * Returns a Set<pairSpreadIndex> of pairs CURRENTLY mid-transition —
 * i.e. whose real isFlipped(i) value changed within the last
 * FLIP_TRANSITION_MS. A pair stays in this set for the full duration
 * of its own visual rotation, regardless of which direction it's
 * turning (opening or closing) — see getEffectiveZIndex below for why
 * direction doesn't matter for the z-index rule itself.
 *
 * isFlipped(i) is a pure function of `spread` (and the fixed pair
 * index), so the effect depends on `spread` directly and recomputes
 * real values fresh inside its own body — NOT on a spread array of
 * pre-computed booleans, which would change LENGTH whenever
 * pairSpreadIndices.length changes (e.g. binder.pages grows via the
 * "+" button while a binder is open), violating React's fixed-length
 * deps-array rule for hooks.
 */
export function useTransitioningPairs(pairSpreadIndices, isFlipped, spread) {
  const [transitioning, setTransitioning] = useState(() => new Set());

  const prevRealRef    = useRef(new Map());
  const timeoutsRef    = useRef(new Map());
  const pairSpreadIndicesKey = pairSpreadIndices.join(',');

  useEffect(() => {
    pairSpreadIndices.forEach((i) => {
      const real     = isFlipped(i);
      const prevReal = prevRealRef.current.has(i) ? prevRealRef.current.get(i) : real;

      if (real !== prevReal) {
        const existingTimeout = timeoutsRef.current.get(i);
        if (existingTimeout) clearTimeout(existingTimeout);

        setTransitioning(prev => {
          if (prev.has(i)) return prev;
          const next = new Set(prev);
          next.add(i);
          return next;
        });

        const timeout = setTimeout(() => {
          setTransitioning(prev => {
            if (!prev.has(i)) return prev;
            const next = new Set(prev);
            next.delete(i);
            return next;
          });
          timeoutsRef.current.delete(i);
        }, FLIP_TRANSITION_MS);
        timeoutsRef.current.set(i, timeout);
      }

      prevRealRef.current.set(i, real);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, pairSpreadIndicesKey]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  return transitioning;
}

/**
 * A pair currently mid-rotation must render ABOVE every settled pair,
 * regardless of which direction it's turning — opening (unflipped →
 * flipped) or closing (flipped → unflipped) both need the same thing:
 * visibility throughout the turn, since the rotating face is, by
 * definition, not yet resting in either pile. Settled pairs keep
 * getPairZIndex's original two-pile ordering among themselves, just
 * shifted down by TRANSITION_Z_BOOST so a transitioning pair's boosted
 * value always wins regardless of totalSpreads/pairSpreadIndex size.
 */
export function getEffectiveZIndex(pairSpreadIndex, totalSpreads, isFlipped, isTransitioning) {
  const base = getPairZIndex(pairSpreadIndex, totalSpreads, isFlipped);
  return isTransitioning ? base + TRANSITION_Z_BOOST : base;
}