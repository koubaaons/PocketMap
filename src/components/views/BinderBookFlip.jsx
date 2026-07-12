/**
 * @fileoverview BinderBookFlip — page-turning mechanism using a stacked
 * page-pair architecture, adapted from a CodePen reference (credit:
 * Nidhanshu Sharma, https://codepen.io/nidhanshusharma).
 */

import { useMemo } from 'react';
import { useTransitioningPairs, getEffectiveZIndex } from './useTransitioningPairs.js';
import { BinderPage } from '../collections/BinderPage.jsx';

const RENDER_RADIUS = 3;

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
  const lastPairSpreadIndex = pagePairs.length > 0
    ? pagePairs[pagePairs.length - 1].spreadIndex
    : 0;

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
  const getTransitionStyleFor = (pairSpreadIndex) =>
    snapInstantly.has(pairSpreadIndex) ? { transition: 'none' } : undefined;

  const coverFlipped = isFlipped(0);

  return (
    <div
      className={`book-flip-container binder-pages-${pageColor}`}
      style={{ '--cover-color': coverColor }}
    >

      {/* Static back-cover placeholder */}
      <div className="book-page-pair-back-cover" />

      {/* === COVER CONTAINER — SINGLE UNIT ===
          Both front and back faces are inside this container.
          The container rotates as a unit around the left edge.
          Both faces are always perfectly aligned. */}
      <div
        className={`book-page-pair-cover ${coverFlipped ? 'is-flipped' : ''}`}
        style={{ zIndex: getZIndexFor(0), ...getTransitionStyleFor(0) }}
      >
        {/* Front face — visible when closed */}
        <div
          className="book-page-pair-cover-face book-page-pair-cover-front"
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

        {/* Back face — visible when flipped */}
        <div className="book-page-pair-cover-face book-page-pair-cover-back">
          {coverBackContent}
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