/**
 * @fileoverview BinderBookFlip — page-turning mechanism using a stacked
 * page-pair architecture, adapted from a CodePen reference (credit:
 * Nidhanshu Sharma, https://codepen.io/nidhanshusharma).
 */

import { useMemo } from 'react';
import { useTransitioningPairs, getEffectiveZIndex } from './useTransitioningPairs.js';
import { BinderPage } from '../collections/BinderPage.jsx';
import { resolvePageColor, getContrastTextColor } from '../../utils/colorUtils.js';

const RENDER_RADIUS = 3;

export function BinderBookFlip({
  binder,
  binderSlots,
  spread,
  isPreviewMode,
  selectedSlot,
  makePageHandlers,
  coverFrontContent,
  coverBackContent = null,
  coverColor,
  pageColor = '#1e1e1e',
  isFrontCoverTransparent = false,
  onCoverClick,
  isClickable = true,
}) {
  // === FIX: last-2-pages-skipped bug ===
  // Each pair n covers physical pages {2n-1 (front), 2n (back)}. When
  // pages is EVEN, the very last pair's back face (2n = binder.pages)
  // is the true final page and has no partner — it needs its own
  // spread, one more than a plain pair count gives. totalSpreads must
  // match that (see useBinderView.js, which needs the identical
  // formula so state clamping agrees with what's rendered here).
  //
  // The previous code kept the old (too-small) totalSpreads and instead
  // special-cased isFlipped to flip the last pair one spread EARLY
  // (`<=` instead of `<`) so its back face could still be reached.
  // That's what caused the skip: the second-to-last pair's back face
  // and the last pair's front face both fall on that same shared
  // spread transition, so neither one is ever the topmost, visible
  // face — they're flipped past in the same instant, invisibly.
  // E.g. for a 10-page binder that hid pages 8 and 9 (spread jumped
  // straight from showing 6-7 to showing the lone final page 10).
  //
  // Giving even-count binders the extra spread they actually need
  // removes any reason to flip early, so isFlipped can just be the
  // plain, uniform rule below.
  const totalSpreads = Math.floor(binder.pages / 2) + 2;

  const slotMapsByPage = useMemo(() => {
    const maps = {};
    binderSlots.forEach(s => {
      if (!maps[s.pageNumber]) maps[s.pageNumber] = {};
      maps[s.pageNumber][s.slotIndex] = s;
    });
    return maps;
  }, [binderSlots]);

  const pagePairs = [];
  for (let n = 1; (n * 2 - 1) <= binder.pages; n++) {
    pagePairs.push({ spreadIndex: n, frontPageNum: n * 2 - 1, backPageNum: n * 2 });
  }

  const isFlipped = (pairSpreadIndex) => pairSpreadIndex < spread;

  const allPairSpreadIndices = useMemo(
    () => [0, ...pagePairs.map(p => p.spreadIndex)],
    [pagePairs.map(p => p.spreadIndex).join(',')]
  );
  const { transitioning, snapInstantly } = useTransitioningPairs(allPairSpreadIndices, isFlipped, spread);
  const getZIndexFor = (pairSpreadIndex) =>
    getEffectiveZIndex(pairSpreadIndex, totalSpreads, isFlipped(pairSpreadIndex), transitioning.has(pairSpreadIndex));
  const getTransitionStyleFor = (pairSpreadIndex) =>
    snapInstantly.has(pairSpreadIndex) ? { transition: 'none' } : undefined;

  const coverFlipped = isFlipped(0);

  // page_color used to be a fixed 'dark'/'light' preset string, now
  // any hex color — resolvePageColor handles existing binders that
  // still have the old preset strings stored, getContrastTextColor
  // picks a readable text color for whatever custom color is chosen.
  // isDarkPage still branches the overlay STYLE (light-mode overlays
  // are white-based, dark-mode are black-based — these wouldn't look
  // right blindly swapped for an arbitrary custom color), while the
  // actual base tone itself is now fully custom via --page-color.
  const resolvedPageColor = resolvePageColor(pageColor);
  const pageTextColor = getContrastTextColor(resolvedPageColor);
  const isDarkPage = getContrastTextColor(resolvedPageColor).includes('255,255,255');

  return (
    <div
      className="book-flip-container"
      data-page-mode={isDarkPage ? 'dark' : 'light'}
      style={{
        '--cover-color': coverColor,
        '--page-color': resolvedPageColor,
        '--page-text-color': pageTextColor,
      }}
    >

      {/* Static back-cover placeholder */}
      <div className="book-page-pair-back-cover" />

      {/* === ONE SINGLE COVER === */}
      <div
        className="book-page-pair-cover"
        style={{ zIndex: getZIndexFor(0) }}
      >
        {/* === LEFT HALF (STATIC BACK COVER) ===
            Appears AFTER the rotation finishes (700ms delay).
            Uses opacity with transition-delay. */}
        <div className={`book-page-pair-cover-left-static ${coverFlipped ? 'is-flipped' : ''}`}>
          {coverBackContent}
        </div>

        {/* === RIGHT HALF (ROTATES) === */}
        <div
          className={`book-page-pair-cover-right-rotating ${coverFlipped ? 'is-flipped' : ''}`}
          style={{ ...getTransitionStyleFor(0) }}
        >
          {/* Front face — visible when closed. Fades to reveal the
              real first page pair already mounted behind it (thanks
              to virtualization keeping nearby pairs in the DOM even
              while closed) while actively previewing a page color —
              see BinderCustomizePanel.jsx's file header for the full
              reasoning. */}
          <div
            className="book-page-pair-cover-right-front"
            style={{
              opacity: isFrontCoverTransparent ? 0 : 1,
              transition: 'opacity 0.3s ease',
              pointerEvents: isFrontCoverTransparent ? 'none' : undefined,
            }}
            onClick={!coverFlipped && isClickable && onCoverClick ? onCoverClick : undefined}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !coverFlipped && isClickable && onCoverClick) {
                e.preventDefault();
                onCoverClick();
              }
            }}
            role={!coverFlipped && isClickable && onCoverClick ? 'button' : undefined}
            tabIndex={!coverFlipped && isClickable && onCoverClick ? 0 : -1}
            aria-label={!coverFlipped && isClickable && onCoverClick ? `Open ${binder.name}` : undefined}
          >
            {coverFrontContent}
          </div>

          {/* Back face — visible when flipped open. This is page 1's
              only real home — see the fix comment on the left-static
              side above for why it's not duplicated there too. */}
          <div className="book-page-pair-cover-right-back">
            {coverBackContent}
          </div>
        </div>
      </div>

      {/* Content page-pairs */}
      {pagePairs.map(({ spreadIndex, frontPageNum, backPageNum }) => {
        const flipped = isFlipped(spreadIndex);
        const isFarFromSpread = !transitioning.has(spreadIndex)
          && Math.abs(spreadIndex - spread) > RENDER_RADIUS;
        if (isFarFromSpread) return null;

        return (
          <div
            key={spreadIndex}
            className={`book-page-pair ${flipped ? 'is-flipped' : ''}`}
            style={{ zIndex: getZIndexFor(spreadIndex), ...getTransitionStyleFor(spreadIndex) }}
          >
            <div className="book-page-pair-face book-page-pair-front binder-book-page">
              {frontPageNum <= binder.pages && (
                <BinderPage
                  binder={binder}
                  pageNumber={frontPageNum}
                  pageSlotMap={slotMapsByPage[frontPageNum] ?? {}}
                  isPreviewMode={isPreviewMode}
                  selectedSlot={selectedSlot}
                  {...makePageHandlers(frontPageNum)}
                />
              )}
            </div>
            <div className="book-page-pair-face book-page-pair-back binder-book-page">
              {backPageNum <= binder.pages && (
                <BinderPage
                  binder={binder}
                  pageNumber={backPageNum}
                  pageSlotMap={slotMapsByPage[backPageNum] ?? {}}
                  isPreviewMode={isPreviewMode}
                  selectedSlot={selectedSlot}
                  {...makePageHandlers(backPageNum)}
                />
              )}
            </div>
          </div>
        );
      })}

    </div>
  );
}