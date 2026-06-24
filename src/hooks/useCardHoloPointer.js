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
 *                                  app deliberately has none of in
 *                                  BINDER SLOTS — so here they're
 *                                  derived directly from pointer
 *                                  position instead (the same role,
 *                                  just skipping the rotation
 *                                  middleman).
 *
 * === Rotation (--rotate-x/--rotate-y) — separate, opt-in ===
 * Binder slots never tilt — only the color/shine effect applies there,
 * per explicit product decision. Outside binders (the card creation/
 * edit form preview, and the card detail modal), a real 3D tilt
 * following the pointer IS wanted. handlePointerMoveWithTilt computes
 * --rotate-x/--rotate-y in addition to everything handlePointerMove
 * already does; ordinary handlePointerMove (used by BinderSlot) never
 * touches these two properties, so binder slots stay flat regardless.
 *
 * NOTE ON FIDELITY: the source's real rotateX/rotateY formula lives in
 * its card.svelte COMPONENT (JS), not in any of the CSS files that
 * were actually available to port from — only a static hover-fallback
 * value (--rotate-x: 7deg; --rotate-y: -19deg, for non-interactive
 * cards) was visible in base.css, which is a fixed resting tilt, not a
 * pointer-driven formula. The formula below (linear mapping from
 * pointer position to a ±MAX_TILT_DEG range) is a standard, reasonable
 * equivalent — not a verified port of the source's own exact math.
 *
 * === Why direct DOM writes, not useState ===
 * pointermove can fire many times per second. Routing that through
 * React state would mean re-rendering on every event; writing
 * straight to el.style.setProperty(...) goes to the compositor without
 * ever entering React's render cycle.
 *
 * === Why only the hovered card, not all visible cards ===
 * This hook is meant to be attached only to whichever single card the
 * pointer is currently over — see BinderSlot.jsx / CardDetailModal.jsx
 * / CardDefinitionForm.jsx, which only wire up these handlers when a
 * card's own holoType isn't 'none'.
 */

import { useCallback, useRef } from 'react';

const MAX_TILT_DEG = 12;

export function useCardHoloPointer() {
  const elRef = useRef(null);

  const setRef = useCallback((el) => {
    elRef.current = el;
  }, []);

  const computeDerived = (e, rect) => {
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    const fromLeft = xPct / 100;
    const fromTop = yPct / 100;
    const fromCenter = Math.min(1, Math.hypot(fromLeft - 0.5, fromTop - 0.5) / 0.707107);

    return { xPct, yPct, fromLeft, fromTop, fromCenter };
  };

  const applyBaseProps = (style, { xPct, yPct, fromLeft, fromTop, fromCenter }) => {
    style.setProperty('--pointer-x', `${xPct}%`);
    style.setProperty('--pointer-y', `${yPct}%`);
    style.setProperty('--pointer-from-left', fromLeft.toFixed(4));
    style.setProperty('--pointer-from-top', fromTop.toFixed(4));
    style.setProperty('--pointer-from-center', fromCenter.toFixed(4));
    style.setProperty('--background-x', `${xPct}%`);
    style.setProperty('--background-y', `${yPct}%`);
  };

  const handlePointerMove = useCallback((e) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    applyBaseProps(el.style, computeDerived(e, rect));
  }, []);

  // === Opt-in tilt variant — used outside binder slots only (form
  // preview, detail modal). Computes the same base properties PLUS
  // --rotate-x/--rotate-y, a standard linear pointer-to-angle mapping
  // (see fidelity note above — not a verified port of the source's
  // own JS formula, which wasn't available to read).
  const handlePointerMoveWithTilt = useCallback((e) => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const derived = computeDerived(e, rect);
    applyBaseProps(el.style, derived);

    // Centered at 50/50 -> 0deg tilt. Moving right tilts the card's
    // right edge away (rotateY negative-toward-viewer on that side);
    // moving down tilts the bottom edge away (rotateX positive).
    const rotateY = ((derived.fromLeft - 0.5) * 2) * MAX_TILT_DEG;
    const rotateX = ((0.5 - derived.fromTop) * 2) * MAX_TILT_DEG;

    el.style.setProperty('--rotate-x', `${rotateX.toFixed(2)}deg`);
    el.style.setProperty('--rotate-y', `${rotateY.toFixed(2)}deg`);
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

  // Same reset, plus zeroing rotation back to flat — used wherever
  // handlePointerMoveWithTilt is used, so the card settles back to
  // resting/flat when the pointer leaves rather than freezing at its
  // last tilt angle.
  const handlePointerLeaveWithTilt = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    handlePointerLeave();
    el.style.setProperty('--rotate-x', '0deg');
    el.style.setProperty('--rotate-y', '0deg');
  }, [handlePointerLeave]);

  return {
    holoRef: setRef,
    handlePointerMove,
    handlePointerLeave,
    handlePointerMoveWithTilt,
    handlePointerLeaveWithTilt,
  };
}