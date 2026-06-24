/**
 * @fileoverview useCardHoloPointer — pointer-position tracking for the
 * holographic card effect, written directly to the DOM (bypassing
 * React state) so moving the mouse over a holo card never triggers a
 * re-render.
 *
 * === Real source contract (simeydotme/pokemon-cards-css) ===
 * The genuine technique computes several DERIVED values from raw
 * pointer position, not just an x/y percentage — and the per-rarity
 * CSS recipes (regular-holo.css, cosmos-holo.css, rainbow-holo.css)
 * key off these derived names directly:
 *   --pointer-x / --pointer-y      raw position, 0%-100%
 *   --pointer-from-center          0-1, distance from card center
 *                                   (0 = dead center, ~1 = at an edge)
 *   --pointer-from-top             0-1, vertical position (0=top, 1=bottom)
 *   --pointer-from-left            0-1, horizontal position (0=left, 1=right)
 *   --background-x / --background-y
 *                                  used by regular-holo's background-
 *                                  position math; the source derives
 *                                  these from the card's TILT angle
 *                                  (--rotate-x/--rotate-y), which this
 *                                  app deliberately has none of — so
 *                                  here they're derived directly from
 *                                  pointer position instead (the same
 *                                  role, just skipping the rotation
 *                                  middleman that doesn't exist here).
 *
 * === Why direct DOM writes, not useState ===
 * pointermove can fire many times per second. Routing that through
 * React state would mean re-rendering on every event; writing
 * straight to el.style.setProperty(...) goes to the compositor without
 * ever entering React's render cycle.
 *
 * === Why only the hovered card, not all visible cards ===
 * This hook is meant to be attached only to whichever single card the
 * pointer is currently over — see BinderSlot.jsx / CardDetailModal.jsx,
 * which only wire up these handlers when a card's own holoType isn't
 * 'none'.
 */

import { useCallback, useRef } from 'react';

export function useCardHoloPointer() {
  const elRef = useRef(null);

  const setRef = useCallback((el) => {
    elRef.current = el;
  }, []);

  const handlePointerMove = useCallback((e) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    // Distance-from-center terms, matching the source's own formulas
    // exactly (it computes these from percentage position the same
    // way, independent of its tilt — tilt is a SEPARATE, later step
    // in the source that this app never takes).
    const fromLeft = xPct / 100;             // 0 (left edge) .. 1 (right edge)
    const fromTop = yPct / 100;              // 0 (top edge) .. 1 (bottom edge)
    const fromCenter = Math.min(1, Math.hypot(fromLeft - 0.5, fromTop - 0.5) / 0.707107);
    // 0.707107 = hypot(0.5, 0.5), i.e. the maximum possible distance
    // from center within a unit square — normalizes fromCenter to 0-1.

    const style = el.style;
    style.setProperty('--pointer-x', `${xPct}%`);
    style.setProperty('--pointer-y', `${yPct}%`);
    style.setProperty('--pointer-from-left', fromLeft.toFixed(4));
    style.setProperty('--pointer-from-top', fromTop.toFixed(4));
    style.setProperty('--pointer-from-center', fromCenter.toFixed(4));
    // --background-x/--background-y: in the source these track tilt
    // angle; with no tilt here, position itself is the closest
    // equivalent driver for the same visual role (shifting the
    // diagonal rainbow band as you move across the card).
    style.setProperty('--background-x', `${xPct}%`);
    style.setProperty('--background-y', `${yPct}%`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const style = el.style;
    style.setProperty('--pointer-x', '50%');
    style.setProperty('--pointer-y', '50%');
    style.setProperty('--pointer-from-left', '0.5');
    style.setProperty('--pointer-from-top', '0.5');
    style.setProperty('--pointer-from-center', '0');
    style.setProperty('--background-x', '50%');
    style.setProperty('--background-y', '50%');
  }, []);

  return { holoRef: setRef, handlePointerMove, handlePointerLeave };
}