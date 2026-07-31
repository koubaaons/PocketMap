/**
 * @fileoverview ExportSpreadRenderer — a clean, non-interactive
 * render of one full binder "spread" (two facing physical pages side
 * by side, exactly like opening a real binder) for image/PDF export.
 *
 * Deliberately reuses ExportPageRenderer for each side rather than
 * duplicating its grid-rendering logic — a spread is fundamentally
 * just two pages placed next to each other, so this component's own
 * job is only the pairing/layout, not re-implementing how a single
 * page's cells get positioned.
 *
 * Either side can be blank (leftPageNum/rightPageNum null) — the
 * inside of the front cover has no real page behind it, and an even
 * page count leaves the final page with no partner, matching how a
 * real physical binder's last sheet only has one printed side. A
 * blank side renders as empty space, keeping the spread visually
 * balanced rather than collapsing to half width.
 */

import { ExportPageRenderer } from './ExportPageRenderer.jsx';

export function ExportSpreadRenderer({
  binder,
  leftPageNum,
  rightPageNum,
  allBinderSlots,
  allBinderPanels,
  cardDefMap,
  binderInsertMap,
  inventoryGroupMap,
  panelAspectRatios = {},
  hideSlotNumbers = false,
  hideQuantityBadges = false,
  hideBackground = false,
  cardsOnly = false,
}) {
  function renderSide(pageNumber) {
    if (pageNumber === null) {
      // Blank side — the inside of the front cover, or an unpaired
      // final page's missing partner. Genuinely empty, not a page
      // with zero slots — no label, no grid, no border.
      return <div className="export-spread-blank-side" />;
    }

    const pageSlotMap = {};
    allBinderSlots
      .filter(s => s.binderId === binder.id && s.pageNumber === pageNumber)
      .forEach(s => { pageSlotMap[s.slotIndex] = s; });
    const pagePanels = allBinderPanels.filter(p => p.binderId === binder.id && p.pageNumber === pageNumber);

    return (
      <ExportPageRenderer
        binder={binder}
        pageNumber={pageNumber}
        pageSlotMap={pageSlotMap}
        pagePanels={pagePanels}
        cardDefMap={cardDefMap}
        binderInsertMap={binderInsertMap}
        inventoryGroupMap={inventoryGroupMap}
        panelAspectRatios={panelAspectRatios}
        hideSlotNumbers={hideSlotNumbers}
        hideQuantityBadges={hideQuantityBadges}
        hideBackground={hideBackground}
        cardsOnly={cardsOnly}
      />
    );
  }

  const wrapperClass = cardsOnly ? 'export-spread-wrapper export-spread-wrapper-transparent' : 'export-spread-wrapper';

  return (
    <div className={wrapperClass}>
      <div className="export-spread-side">{renderSide(leftPageNum)}</div>
      <div className="export-spread-side">{renderSide(rightPageNum)}</div>
    </div>
  );
}
