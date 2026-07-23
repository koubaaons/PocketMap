/**
 * @fileoverview useBinderFullscreen — fullscreen toggling and book
 * sizing/aspect-ratio measurement for BinderView.
 *
 * Extracted from BinderView.jsx where this logic lived inline,
 * making it independently maintainable and testable.
 *
 * === What this hook owns ===
 * - rootRef: attaches to the binder view's root element, passed to
 *   useFullscreen for OS-level fullscreen.
 * - bookFlipWrapperRef: attaches to the div wrapping BinderBookFlip,
 *   used as the measurement target for both the width-cap and the
 *   aspect-ratio correction (BinderBookFlip itself takes no ref).
 * - fullscreenMaxBookWidth: a pixel cap applied to the book wrapper
 *   when in fullscreen, computed by measuring its real rendered height
 *   and shrinking by the exact ratio needed — no estimating.
 * - bookAspectRatio: formula-based estimate of the book's width/height
 *   ratio from binder dimensions and slot proportions.
 * - measuredAspectRatio: corrects bookAspectRatio by measuring real
 *   DOM overflow (scrollHeight vs clientHeight) on a live page grid.
 * - effectiveBookAspectRatio: measuredAspectRatio if available,
 *   bookAspectRatio otherwise — this is what BinderView actually uses.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFullscreen } from './useFullscreen.js';
import { useTheme } from './useTheme.js';

// How much vertical space (px) to reserve for the topbar + page-nav
// row that remain visible even inside fullscreen.
const FULLSCREEN_VERTICAL_PADDING = 160;

/**
 * @param {{ rows: number, cols: number }} binderDimensions
 */
export function useBinderFullscreen({ rows, cols }) {
  const rootRef = useRef(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(rootRef);

  // useTheme() included here so that a theme switch while already in
  // fullscreen triggers a recalculation — binder.rows/cols/isFullscreen
  // don't change on a theme toggle, but a layout shift from the theme
  // switch can make the stale fullscreenMaxBookWidth incorrect.
  const { theme } = useTheme();

  const bookFlipWrapperRef = useRef(null);
  const [fullscreenMaxBookWidth, setFullscreenMaxBookWidth] = useState(null);

  useEffect(() => {
    if (!isFullscreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tied to the real DOM remeasurement below, not derivable during render
      setFullscreenMaxBookWidth(null);
      return;
    }

    const recalc = () => {
      // Reset to the normal width first so we measure the book's true
      // natural height — not a height already shrunk by a prior correction.
      setFullscreenMaxBookWidth(null);

      // Two frames: a theme switch can trigger CSS transitions that take
      // a moment to settle; measuring mid-transition risks an off rect.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = bookFlipWrapperRef.current;
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const availableHeight = window.innerHeight - FULLSCREEN_VERTICAL_PADDING;

          if (rect.height <= availableHeight || rect.height === 0) {
            return; // fits already
          }

          const shrinkFactor = availableHeight / rect.height;
          setFullscreenMaxBookWidth(rect.width * shrinkFactor);
        });
      });
    };

    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [isFullscreen, rows, cols, theme]);

  // Formula-based estimate of the book's width/height ratio from
  // binder dimensions and slot proportions (2.5:3.5 per slot).
  const bookAspectRatio = useMemo(() => {
    const SLOT_RATIO = 2.5 / 3.5;
    const pageWidthUnits  = cols;
    const pageHeightUnits = rows / SLOT_RATIO;
    const bookWidthUnits  = pageWidthUnits * 2; // two pages side by side
    return bookWidthUnits / pageHeightUnits;
  }, [cols, rows]);

  // Corrects bookAspectRatio by measuring real DOM overflow on a live
  // page grid — handles padding/gaps that the formula can't account for.
  const [measuredAspectRatio, setMeasuredAspectRatio] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset tied to the real DOM remeasurement immediately below, not derivable during render
    setMeasuredAspectRatio(null); // reset to re-measure fresh

    const recalc = () => {
      const wrapperEl = bookFlipWrapperRef.current;
      if (!wrapperEl) return;

      const gridEl = wrapperEl.querySelector('.binder-page-grid');
      if (!gridEl) return;

      const wrapperEl2 = gridEl.closest('.binder-page-wrapper');
      const measureEl = wrapperEl2 ?? gridEl;

      const overflow = measureEl.scrollHeight - measureEl.clientHeight;
      if (overflow <= 0) return;

      const bookRect = wrapperEl.getBoundingClientRect();
      if (bookRect.height === 0) return;

      const correctedHeight = bookRect.height + overflow;
      setMeasuredAspectRatio(bookRect.width / correctedHeight);
    };

    requestAnimationFrame(() => requestAnimationFrame(recalc));

    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [rows, cols, bookAspectRatio]);

  return {
    rootRef,
    bookFlipWrapperRef,
    isFullscreen,
    toggleFullscreen,
    fullscreenMaxBookWidth,
    effectiveBookAspectRatio: measuredAspectRatio ?? bookAspectRatio,
  };
}