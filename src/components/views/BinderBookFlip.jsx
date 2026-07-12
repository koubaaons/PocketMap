/**
 * @fileoverview BinderBookFlip — page-turning mechanism using a stacked
 * page-pair architecture, adapted from a CodePen reference (credit:
 * Nidhanshu Sharma, https://codepen.io/nidhanshusharma).
 *
 * Cover-related pieces (the cover pair, the background frame halves,
 * the back-cover placeholder, the fixed left panel) have all been
 * removed entirely per request — this is currently just the card-page
 * mechanism, a clean baseline to rebuild the cover on top of later.
 *
 * === The actual geometry (verified, not assumed) ===
 * Each .book-page-pair sits on the RIGHT half, hinged at its own LEFT
 * edge. Flipping rotates the whole pair -180deg around that hinge,
 * which physically relocates the ENTIRE pair box from the right half
 * to the left half. Once there, backface-visibility means the pair's
 * BACK face (pre-rotated 180deg) is what actually faces the viewer.
 *
 * === PAGE NUMBERING ===
 *   pair N (N>=1): front = page (2N-1), back = page (2N)
 *
 * A pair is FLIPPED (showing its back, landed on the left) once you've
 * navigated STRICTLY PAST its own spread — pairSpreadIndex < spread.
 *
 * === Z-INDEX ===
 * A single linear z-index cannot correctly order both piles (left:
 * flipped pairs landed there; right: unflipped pairs still there) at
 * once, because they need OPPOSITE internal orderings:
 *   - Among flipped pairs, the most RECENTLY flipped (highest
 *     pairSpreadIndex) must be on top of the left pile.
 *   - Among unflipped pairs, the NEXT one to flip (lowest
 *     pairSpreadIndex) must be on top of the right pile.
 * getPairZIndex below uses pairSpreadIndex directly while flipped, and
 * (totalSpreads - pairSpreadIndex) while unflipped, so each pile
 * independently peaks at its own boundary with the current spread.
 *
 * A pair currently MID-ROTATION must render above every settled pair,
 * full stop — regardless of which direction it's turning. See
 * useTransitioningPairs + getEffectiveZIndex below: any pair whose
 * real isFlipped value changed within the last 0.7s gets a flat
 * z-index boost large enough to beat every settled pair's ordering;
 * once the timeout elapses, it drops back to the normal ordering.
 */

import { useMemo } from 'react';
import { FLIP_TRANSITION_MS, useTransitioningPairs, getEffectiveZIndex } from './useTransitioningPairs.js';
import { BinderPage } from '../collections/BinderPage.jsx';

// === PERF (opening a binder feels heavy, scales with binder.pages):
// every page-pair is permanently mounted so the flip has real content
// to rotate — but that means React creates the DOM for EVERY page's
// slot grid, holo overlays, etc. up front on mount, even the ones
// buried under the pile that are never visible (only ~2 pairs are ever
// actually visible at rest: the topmost unflipped one and the topmost
// flipped one). RENDER_RADIUS pairs, this many steps in either
// direction from the current spread, are the only ones actually
// mounted; everything further isn't created at all until navigation
// brings it within range. A pair mounts fresh the moment it re-enters
// range — well before the user could ever navigate to it — so there's
// no pop or flash, and since it has no prior rendered state, it simply
// appears at rest with no animation (nothing was visible to animate
// away from anyway).
const RENDER_RADIUS = 3;

/**
 * @param {object} binder - the binder being viewed
 * @param {object[]} binderSlots - all slots for this binder (or preview slots)
 * @param {object} cardDefMap - id -> cardDef lookup
 * @param {object} ownershipMap - id -> ownership info lookup
 * @param {number} spread - current spread index
 * @param {boolean} isPreviewMode
 * @param {object|null} selectedSlot
 * @param {(pageNumber: number) => { onClickEmpty, onClickSlot }} makePageHandlers
 * @param {string} [pageColor] - 'dark' | 'light', applied as the same binder-pages-{color} class the original book uses, so page backgrounds/labels match
 */
export function BinderBookFlip({
  binder,
  binderSlots,
  cardDefMap,
  ownershipMap,
  spread,
  isPreviewMode,
  selectedSlot,
  makePageHandlers,
  coverFrontContent,
  coverBackContent = null,
  coverColor,
  pageColor = 'dark',
  onCoverClick,
  isClickable = true,
}) {
  const totalSpreads = Math.ceil(binder.pages / 2) + 1;

  // Build slot maps once per spread-pair.
  const slotMapsByPage = useMemo(() => {
    const maps = {};
    binderSlots.forEach(s => {
      if (!maps[s.pageNumber]) maps[s.pageNumber] = {};
      maps[s.pageNumber][s.slotIndex] = s;
    });
    return maps;
  }, [binderSlots]);

  // Pair N (N>=1): front = page (2N-1), back = page (2N). Generated
  // until the front page number would exceed binder.pages.
  const pagePairs = [];
  for (let n = 1; (n * 2 - 1) <= binder.pages; n++) {
    pagePairs.push({ spreadIndex: n, frontPageNum: n * 2 - 1, backPageNum: n * 2 });
  }
  const lastPairSpreadIndex = pagePairs.length > 0
    ? pagePairs[pagePairs.length - 1].spreadIndex
    : 0;

  // === FIX (final spread stuck, right arrow disabled, pages mismatch):
  // a pair normally flips once `spread` moves STRICTLY PAST its own
  // spreadIndex (`<`), because the NEXT pair's front face is what
  // takes over the right side at that point. The LAST pair has no
  // next pair to hand off to, so it must flip as soon as its own
  // spread is REACHED, not strictly past it. ===
  const isFlipped = (pairSpreadIndex) => pairSpreadIndex === lastPairSpreadIndex
    ? pairSpreadIndex <= spread
    : pairSpreadIndex < spread;

  const allPairSpreadIndices = useMemo(
    () => [0, ...pagePairs.map(p => p.spreadIndex)],
    [pagePairs.map(p => p.spreadIndex).join(',')]
  );
  const { transitioning, snapInstantly } = useTransitioningPairs(allPairSpreadIndices, isFlipped, spread);
  const getZIndexFor = (pairSpreadIndex) =>
    getEffectiveZIndex(pairSpreadIndex, totalSpreads, isFlipped(pairSpreadIndex), transitioning.has(pairSpreadIndex));
  // === PERF: pairs buried deep in a multi-spread jump skip their
  // animated turn entirely — this disables the CSS transition on just
  // those pairs for the one frame they snap in, so they land at rest
  // instantly instead of playing a 700ms rotation nobody would see. ===
  const getTransitionStyleFor = (pairSpreadIndex) =>
    snapInstantly.has(pairSpreadIndex) ? { transition: 'none' } : undefined;

  return (
    <div
      className={`book-flip-container binder-pages-${pageColor}`}
      style={{ '--cover-color': coverColor }}
    >

      {/* === Static back-cover placeholder — same size/color as the
          front cover (reuses the same box model, just without any
          rotation at all). Always rendered, unconditionally — since
          it's bigger than the card pages, it's meant to peek out
          slightly around their edges the whole time, not just appear
          once you've reached the last page. Low z-index (-1) means it
          only actually shows through wherever a page isn't fully
          covering it — every real pair has zIndex >= 0 already. === */}
      <div className="book-page-pair-back-cover" />

      {/* === Cover pair (spreadIndex 0) — its own dedicated classes
          (book-page-pair-cover, book-page-pair-cover-face) entirely
          separate from the shared .book-page-pair-face/-front/-back
          classes content pages use, so this is purely additive — card
          pages are completely untouched by this. Same rotation
          mechanism (is-flipped + rotateY), just a bigger box and its
          own color, sized via dedicated CSS instead of touching the
          shared page-face rules at all. === */}
      <div
        className={`book-page-pair-cover ${isFlipped(0) ? 'is-flipped' : ''}`}
        style={{ zIndex: getZIndexFor(0), ...getTransitionStyleFor(0) }}
      >
        <div
          className="book-page-pair-cover-face book-page-pair-cover-front"
          onClick={!isFlipped(0) && isClickable && onCoverClick ? onCoverClick : undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isFlipped(0) && isClickable && onCoverClick) {
              e.preventDefault();
              onCoverClick();
            }
          }}
          role={!isFlipped(0) && isClickable && onCoverClick ? 'button' : undefined}
          tabIndex={!isFlipped(0) && isClickable && onCoverClick ? 0 : -1}
          aria-label={!isFlipped(0) && isClickable && onCoverClick ? `Open ${binder.name}` : undefined}
        >
          {coverFrontContent}
        </div>
        <div className="book-page-pair-cover-face book-page-pair-cover-back">
          {coverBackContent}
        </div>
      </div>

      {/* === Content page-pairs — pair N's front is page (2N-1),
          back is page (2N). binder-book-page class added so
          BinderPage's own CSS (height:100% etc, scoped to
          .binder-book-page .binder-page-wrapper) applies — without
          it, page content collapses to zero height since it never
          gets that ancestor class in this structure. === */}
      {pagePairs.map(({ spreadIndex, frontPageNum, backPageNum }) => {
        const flipped = isFlipped(spreadIndex);

        // === PERF: see RENDER_RADIUS comment above. A transitioning
        // pair is always within 1 of spread anyway (see
        // useTransitioningPairs), but transitioning.has() is checked
        // too as a hard safety net so an actively-animating pair can
        // never be skipped mid-flip regardless of distance math.
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
                  cardDefMap={cardDefMap}
                  ownershipMap={ownershipMap}
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
                  cardDefMap={cardDefMap}
                  ownershipMap={ownershipMap}
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