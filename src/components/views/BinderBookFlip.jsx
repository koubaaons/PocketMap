/**
 * @fileoverview BinderBookFlip — page-turning mechanism using a stacked
 * page-pair architecture, adapted from a CodePen reference (credit:
 * Nidhanshu Sharma, https://codepen.io/nidhanshusharma).
 *
 * === The actual geometry (verified, not assumed) ===
 * Each .book-page-pair sits on the RIGHT half, hinged at its own LEFT
 * edge. Flipping rotates the whole pair -180deg around that hinge,
 * which physically relocates the ENTIRE pair box from the right half
 * to the left half. Once there, backface-visibility means the pair's
 * BACK face (pre-rotated 180deg) is what actually faces the viewer.
 *
 * This means: a pair's FRONT face is only ever seen on the RIGHT
 * (while unflipped), and a pair's BACK face is only ever seen on the
 * LEFT (once flipped). Earlier versions of this file had this
 * backwards — back faces held "rightPageNum" content, which then
 * physically landed on the left, putting the wrong page number on
 * each side. There is no separate non-rotating "fixed left panel"
 * mechanism needed at all: every page that ever appears on the left
 * is simply some pair's back face, landed there by its own rotation.
 *
 * === PAGE NUMBERING (confirmed against the physical book model) ===
 *   pair 0 (the cover): front = cover art, back = inside-of-cover
 *   pair N (N>=1):       front = page (2N-1), back = page (2N)
 *
 *   spread 0 (closed):  left=nothing            right=cover front
 *   spread 1:           left=inside-of-cover    right=Page 1
 *   spread 2:           left=Page 2             right=Page 3
 *   spread 3:           left=Page 4             right=Page 5
 *   spread N (N>=1):    left=Page (2N-2)*       right=Page (2N-1)
 *     (*for N=1, "Page 0" doesn't exist — that's the inside-of-cover
 *      special case, handled by pair 0's back face instead)
 *
 * A pair is FLIPPED (showing its back, landed on the left) once you've
 * navigated STRICTLY PAST its own spread — pairSpreadIndex < spread.
 * This is different from "current pair flips immediately" because each
 * pair's front face is the RIGHT-hand content for the spread BEFORE it
 * turns, and turning it past is what reveals the NEXT pair's front
 * face as the new right-hand content. Concretely: pair1 (front=Page1,
 * back=Page2) is what's showing at spread 1 (front, Page 1, on the
 * right) — it only flips once spread reaches 2, revealing Page 2 on
 * the left and handing the right side over to pair2's front (Page 3).
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
 * === FIX: z-index during the transition window (mid-flip occlusion) ===
 * getPairZIndex's ordering above is only correct AT REST — it assumes
 * a pair's visual rotation already matches its logical isFlipped
 * value. But isFlipped is a discrete boolean that flips the INSTANT
 * `spread` changes, while the actual CSS transform rotation
 * (.book-page-pair's `transition: transform 0.7s`) takes 0.7s to
 * visually catch up. z-index has no transition of its own — it's
 * applied instantly, with no animatable in-between state.
 *
 * Concretely, OPENING: the cover's z-index drops to its "flipped"
 * value (lowest in the stack) the instant spread changes, while the
 * NEXT pair's z-index jumps to its "unflipped" value (much higher) —
 * both instantly, before the cover has rotated even one degree. For
 * the entire 0.7s the cover is still visually flat-on, facing the
 * viewer, it renders BEHIND the next pair — confirmed via
 * frame-by-frame screenshots showing the cover as a sliver tucked
 * behind the page grid throughout its own animation.
 *
 * An EARLIER version of this fix tried holding each pair's z-index
 * ORDERING at its pre-change value for 0.7s, on the theory that "the
 * old ordering was correct a moment ago, so keep using it until the
 * visual catches up." That happens to work for OPENING (the cover's
 * old ordering was "topmost on the right," which is also what it
 * needs while leaving) but is BACKWARDS for CLOSING: the cover's old
 * ordering at rest was "flipped/lowest" (resting on the left), and
 * holding THAT while it actively rotates back into view on the right
 * keeps it buried beneath the very pair it needs to rotate over —
 * confirmed via a second round of frame-by-frame screenshots showing
 * the identical occlusion bug, now on close instead of open.
 *
 * The actually-correct, direction-agnostic rule: a pair currently
 * MID-ROTATION must render above every settled pair, full stop —
 * regardless of which direction it's turning, since "not yet at rest
 * in either pile" is what it means to be transitioning at all. See
 * useTransitioningPairs + getEffectiveZIndex below: any pair whose
 * real isFlipped value changed within the last 0.7s gets a flat
 * z-index boost large enough to beat every settled pair's ordering,
 * regardless of totalSpreads/pairSpreadIndex magnitude; once the
 * timeout elapses (the rotation has actually finished), it drops back
 * to the normal two-pile ordering, which is correct again now that
 * it's genuinely at rest.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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
 * @param {number} spread - current spread index (0 = cover spread, matches useBinderView's `page`)
 * @param {boolean} isPreviewMode
 * @param {object|null} selectedSlot
 * @param {(pageNumber: number) => { onClickEmpty, onClickSlot }} makePageHandlers
 * @param {React.ReactNode} coverFrontContent - whatever renders on the cover's own front face (name, stickers, customize controls — passed in rather than hardcoded here, so BinderView keeps owning all of that logic)
 * @param {React.ReactNode} [coverBackContent] - content for the inside of the front cover, on the cover pair's own back face (lands on the left once the cover flips)
 * @param {string} [pageColor] - 'dark' | 'light', applied as the same binder-pages-{color} class the original book uses, so page backgrounds/labels match
 * @param {() => void} [onCoverClick] - called when the cover's front face is clicked while still closed (spread 0). BinderView wires this to its existing handleOpenBinder/isOpen state so both books open together.
 * @param {boolean} [isClickable] - whether the cover should currently respond to clicks (BinderView already knows not to open while mid-animation or while editing the cover)
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

  // === FIX (border disappears too early during close): the right
  // frame-half's visibility was tied directly to `spread >= 1`, which
  // flips to false the INSTANT you click close — before the cover has
  // even started its 0.7s rotation back shut. That made the border
  // vanish immediately while the cover was still visibly mid-close,
  // looking like it disappeared too soon instead of staying present
  // until the cover actually finished covering that area. This delays
  // hiding the right frame-half by the same 0.7s the cover's rotation
  // takes, so it only disappears once the close animation has
  // actually finished — appearing (spread 0->1) is unaffected, since
  // there's no reason to delay something becoming visible. ===
  const [showRightFrameDelayed, setShowRightFrameDelayed] = useState(spread >= 1);

  useEffect(() => {
    if (spread >= 1) {
      setShowRightFrameDelayed(true);
      return;
    }
    const timeout = setTimeout(() => setShowRightFrameDelayed(false), FLIP_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [spread]);

  // Build slot maps once per spread-pair, same approach BinderView
  // already uses today — just looped across every spread instead of
  // only the current one, since every page-pair needs to be mounted
  // simultaneously now (they're all real DOM, not conditionally
  // rendered), so each can carry its own real content on both faces.
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

  // === FIX (final spread stuck, right arrow disabled, pages mismatch
  // vs. the original book): a pair normally flips once `spread` moves
  // STRICTLY PAST its own spreadIndex (`<`), because the NEXT pair's
  // front face is what takes over the right side at that point. The
  // LAST pair has no next pair to hand off to — the right side at the
  // true final spread is supposed to be empty (matching the original
  // book's own empty-right-page placeholder there), so the last pair
  // must flip as soon as its own spread is REACHED, not strictly past
  // it. Without this special case, the last pair never flipped at the
  // final spread (e.g. for a 20-page binder, pair 10's back face
  // — Page 20 — never appeared on the left at spread 10, since
  // `10 < 10` is false), which also meant `spread` could never advance
  // to what both books agree is the true last spread, so the right
  // arrow stayed permanently enabled one step short of done, or
  // disabled one step early depending on totalSpreads bookkeeping —
  // confirmed via screenshot: original book correctly on Page 20 /
  // empty-right, BinderBookFlip stuck on Page 18 / Page 19. ===
  const isFlipped = (pairSpreadIndex) => pairSpreadIndex === lastPairSpreadIndex
    ? pairSpreadIndex <= spread
    : pairSpreadIndex < spread;

  // === FIX: z-index ordering, delayed to match the visual transition.
  // See big comment block at top of file. allPairSpreadIndices covers
  // the cover (0) plus every content pair, so every pair's z-index
  // ordering is delayed consistently, not just the cover's.
  const allPairSpreadIndices = useMemo(
    () => [0, ...pagePairs.map(p => p.spreadIndex)],
    [pagePairs.map(p => p.spreadIndex).join(',')]
  );
  const { transitioning, snapInstantly } = useTransitioningPairs(allPairSpreadIndices, isFlipped, spread);
  const getZIndexFor = (pairSpreadIndex) =>
    getEffectiveZIndex(pairSpreadIndex, totalSpreads, isFlipped(pairSpreadIndex), transitioning.has(pairSpreadIndex));
  // === PERF: pairs buried deep in a multi-spread jump (see
  // useTransitioningPairs) skip their animated turn entirely — this
  // disables the CSS transition on just those pairs for the one frame
  // they snap in, so they land at rest instantly instead of playing a
  // 700ms rotation nobody would see anyway. ===
  const getTransitionStyleFor = (pairSpreadIndex) =>
    snapInstantly.has(pairSpreadIndex) ? { transition: 'none' } : undefined;

  return (
    <div
      className={`book-flip-container binder-pages-${pageColor}`}
      style={{ '--cover-color': coverColor }}
    >

      {/* === Background frame halves — sit BEHIND every page-pair as
          their own layer. Always mounted (never conditionally
          rendered) so the opacity transition below can actually
          animate; conditional mounting removes elements from the DOM
          instantly with no way to transition that. RIGHT half is
          visible from spread 1 onward (Page 1 at spread 1, and every
          page after). LEFT half is visible only from spread 2 onward
          — spread 1's left side is the cover's freshly-opened back
          face, which must read as empty, not already framed.
          Neither is visible at spread 0 (closed). === */}
      <div className={`book-flip-frame-half book-flip-frame-half-right ${showRightFrameDelayed ? 'book-flip-frame-half-visible' : ''}`} />
      <div className={`book-flip-frame-half book-flip-frame-half-left ${spread >= 2 ? 'book-flip-frame-half-visible' : ''}`} />

      {/* === Back cover — fills the right side once every pair has
          flipped (spread has reached/passed the last pair), since at
          that point there's no remaining unflipped pair to show a
          front face there. Plain binder-color fill, same family of
          treatment as the front cover's gradient, just no text or
          stickers — matches the original book's own empty-right
          placeholder being a colored box, just using the binder's
          actual color instead of leaving it black. Sits at the very
          bottom of the z-stack (zIndex: -1) so it only shows through
          when nothing else is covering it; every real pair has zIndex
          >= 0 already.
          === FIX (rendered on the LEFT instead of the right): this
          div previously also carried the `book-page-pair-face` class,
          whose `!important` rules (left: 0, width: 100%) overrode the
          inline right: 0 / width: 50% below — confirmed via
          getBoundingClientRect, which showed this box occupying the
          container's LEFT 250px instead of its right half. Dropped
          that class entirely; this element isn't actually a pair
          face, just a plain positioned placeholder, so it never
          needed those rules in the first place. === */}
      {spread >= lastPairSpreadIndex && (
        <div
          className="book-page-pair-back-cover"
          style={{
            position: 'absolute',
            top: '14px',
            left: 'calc(50% + 14px)',
            right: '14px',
            bottom: '14px',
            boxSizing: 'border-box',
            zIndex: -1,
            background: coverColor,
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
            borderRadius: '0 16px 16px 0',
          }}
        />
      )}

      {/* === Cover pair (spreadIndex 0) — front is the cover art
          (visible on the right while closed/unflipped); back is the
          inside-of-cover (visible on the left once flipped open). === */}
      <div
        className={`book-page-pair book-page-pair-cover ${isFlipped(0) ? 'is-flipped' : ''}`}
        style={{ zIndex: getZIndexFor(0), ...getTransitionStyleFor(0) }}
      >
        <div
          className="book-page-pair-face book-page-pair-front"
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
        {/* === FIX (white border on inside-of-cover): this face used
            to also carry the `binder-book-page` class, which exists
            so BinderPage's own internal CSS (height:100% etc) applies
            correctly on faces that hold real page content. This face
            holds flipCoverBackContent — a plain color div, no
            BinderPage at all — so that class was only contributing an
            unwanted decorative box-shadow/border (confirmed via
            getComputedStyle: a 1px white highlight + drop shadow meant
            for real page slots), which is what showed up as a thin
            white border around the inside-of-cover. Removed here since
            this face never needed it. === */}
        <div className="book-page-pair-face book-page-pair-back">
          {coverBackContent}
        </div>
      </div>

      {/* === Content page-pairs — pair N's front is page (2N-1),
          back is page (2N). binder-book-page class added so
          BinderPage's own CSS (height:100% etc, scoped to
          .binder-book-page .binder-page-wrapper) applies — without
          it, page content collapses to zero height since it never
          gets that ancestor class in this structure.
          INSET: each face leaves a 14px gap on its own outer edge so
          the background frame halves (above) can show through —
          matching their own visibility rules exactly: front (right
          side) insets once spread >= 1, back (left side) insets once
          spread >= 2 (spread 1's left side is the cover's freshly-
          opened back, not a content pair's back at all, so this
          exactly tracks when each side's frame half is shown). === */}
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

        // === THE FIX (other AI's diagnosis): page faces ALWAYS carry
        // their inset properties by default, never waiting for spread
        // to change, so their card grids are pre-rendered at final
        // size from the moment they mount instead of transitioning
        // into it while the cover is also animating.
        const frontInset = true;
        const backInset = true;
        return (
          <div
            key={spreadIndex}
            className={`book-page-pair ${flipped ? 'is-flipped' : ''}`}
            style={{ zIndex: getZIndexFor(spreadIndex), ...getTransitionStyleFor(spreadIndex) }}
          >
            <div
              className="book-page-pair-face book-page-pair-front binder-book-page"
              style={{
                top: frontInset ? '14px' : '0',
                right: frontInset ? '14px' : '0',
                bottom: frontInset ? '14px' : '0',
                left: 'auto',
                width: frontInset ? 'calc(100% - 28px)' : '100%',
                height: frontInset ? 'calc(100% - 28px)' : '100%',
                borderRadius: frontInset ? '0 16px 16px 0' : '0',
              }}
            >
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
            <div
              className="book-page-pair-face book-page-pair-back binder-book-page"
              style={{
                top: backInset ? '14px' : '0',
                left: backInset ? '14px' : '0',
                bottom: backInset ? '14px' : '0',
                right: 'auto',
                width: backInset ? 'calc(100% - 28px)' : '100%',
                height: backInset ? 'calc(100% - 28px)' : '100%',
                borderRadius: backInset ? '16px 0 0 16px' : '0',
              }}
            >
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