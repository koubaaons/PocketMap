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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const FLIP_TRANSITION_MS = 700;
const TRANSITION_Z_BOOST = 10000;

// === PERF (lag on a multi-spread jump, e.g. closing the binder from
// deep inside, or typing a page number far from the current one):
// a jump like that changes isFlipped for every pair between the old
// and new spread AT ONCE. Only the pair(s) closest to each end of the
// jump are ever actually visible mid-turn — everything deeper is
// buried under the pile the whole time, so animating it is pure wasted
// compositor work (a real transform transition + a z-index reflow per
// pair) for something nobody sees move. JUMP_ADJACENCY is how many
// steps from either endpoint still get a real animated turn; anything
// further snaps straight to its resting position instead. ===
const JUMP_ADJACENCY = 1;

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
  const [snapInstantly, setSnapInstantly] = useState(() => new Set());

  const prevRealRef    = useRef(new Map());
  const prevSpreadRef  = useRef(spread);
  const timeoutsRef    = useRef(new Map());
  const pairSpreadIndicesKey = pairSpreadIndices.join(',');

  // === FIX (page from an adjacent spread flashes on top for one frame):
  // this was a plain `useEffect`, which runs AFTER the browser paints.
  // That left exactly one rendered frame — right when `spread` changes,
  // before this effect had a chance to add TRANSITION_Z_BOOST — where a
  // just-toggled pair's z-index already reflected its NEW isFlipped
  // value (via getEffectiveZIndex's base formula) while its CSS
  // transform hadn't actually started rotating yet. Since the flipped-
  // pile formula (z = pairSpreadIndex) and unflipped-pile formula
  // (z = totalSpreads - pairSpreadIndex) aren't guaranteed to stay clear
  // of each other for every totalSpreads/pairSpreadIndex combination,
  // that one unboosted frame could let an unrelated settled pair
  // outrank the transitioning one, flashing its page on top before the
  // very next frame (once the effect ran) corrected the stacking.
  // useLayoutEffect runs synchronously before the browser paints, so
  // the boost is applied in the SAME frame as the spread change —
  // there's no unboosted frame left for the wrong pair to win. ===
  useLayoutEffect(() => {
    const prevSpread = prevSpreadRef.current;
    // More than one spread apart = a jump (close button, page-number
    // input, etc.) rather than a single arrow-click step.
    const isJump = Math.abs(spread - prevSpread) > 1;
    const instantThisPass = new Set();

    pairSpreadIndices.forEach((i) => {
      const real     = isFlipped(i);
      const prevReal = prevRealRef.current.has(i) ? prevRealRef.current.get(i) : real;

      if (real !== prevReal) {
        // A pair within JUMP_ADJACENCY of either the spread we left or
        // the spread we landed on is the one actually sitting on top
        // of its pile — that's the pair whose turn you'd really see.
        // Everything else that changed during a jump is buried and
        // gets snapped instead of animated.
        const nearOldSpread = Math.abs(i - prevSpread) <= JUMP_ADJACENCY;
        const nearNewSpread = Math.abs(i - spread) <= JUMP_ADJACENCY;
        const shouldSnap = isJump && !nearOldSpread && !nearNewSpread;

        if (shouldSnap) {
          instantThisPass.add(i);
        } else {
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
      }

      prevRealRef.current.set(i, real);
    });

    prevSpreadRef.current = spread;

    if (instantThisPass.size > 0) {
      setSnapInstantly(instantThisPass);
      // Re-enable normal transitions on the next paint, once the
      // browser has committed this frame with transitions disabled —
      // the standard "disable, apply, re-enable next frame" pattern
      // for suppressing one transition without affecting future ones.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSnapInstantly(new Set()));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, pairSpreadIndicesKey]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  return { transitioning, snapInstantly };
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