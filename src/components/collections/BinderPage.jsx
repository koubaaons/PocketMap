/**
 * @fileoverview BinderPage — grid of slots for one page.
 * === ISSUE #82: passes preview mode and selected slot props to each slot ===
 *
 * === Michi Method support: combined slots ===
 * Every cell (normal slot or panel) gets an EXPLICIT gridColumnStart/
 * gridRowStart rather than relying on CSS Grid's auto-placement flow.
 * Auto-placement can behave unpredictably once some cells span
 * multiple rows/columns and others don't — explicit positioning for
 * every cell, panel or not, means there's no ambiguity about where
 * anything lands regardless of DOM order or which cells get skipped.
 *
 * Slot positions covered by a panel (other than the panel's own start
 * position) are simply not rendered as their own cell at all — the
 * panel's own span already covers that visual space.
 */

import { BinderSlot } from './BinderSlot.jsx';
import { BinderPanelSlot } from './BinderPanelSlot.jsx';
import { getQuantityOwned } from '../../selectors/inventorySelectors.js';
import { getTotalPlacedCount } from '../../selectors/binderSelectors.js';
import { useBinderData } from '../../contexts/useBinderData.js';

export function BinderPage({
  binder,
  pageNumber,
  pageSlotMap,
  pagePanels = [],
  binderInsertMap = {},
  isPreviewMode = false,
  selectedSlot = null,
  onClickEmpty,
  onClickSlot,
  onToggleOwned,
  onRemove,
  onDropEmpty,
  onClickPanel,
  onUncombinePanel,
  onUpdatePanel,
  onDropInsert,
  isCombineMode = false,
  combineSelection = [],
  getCombineRectangle,
  onClearCombineSelection,
  onConfirmCombine,
}) {
  const { cardDefMap, inventoryGroupMap, allBinderSlots, allBinderPanels } = useBinderData();
  const totalSlots = binder.rows * binder.cols;
  const cols = binder.cols;

  // Map every slot index this page's panels cover to the panel
  // itself, and separately track which of those indices are each
  // panel's own starting position (that's the only one that
  // actually renders something).
  const coveredByPanel = {};
  const panelStartIndices = new Set();
  pagePanels.forEach(panel => {
    panelStartIndices.add(panel.startSlotIndex);
    const startRow = Math.floor(panel.startSlotIndex / cols);
    const startCol = panel.startSlotIndex % cols;
    for (let r = 0; r < panel.spanRows; r++) {
      for (let c = 0; c < panel.spanCols; c++) {
        coveredByPanel[(startRow + r) * cols + (startCol + c)] = panel;
      }
    }
  });

  return (
    <div className="binder-page-wrapper">
      <div className="binder-page-label">Page {pageNumber}</div>
      <div
        className="binder-page-grid"
        style={{
          gridTemplateColumns: `repeat(${binder.cols}, 1fr)`,
        }}
      >
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          const gridColumnStart = (slotIndex % cols) + 1;
          const gridRowStart    = Math.floor(slotIndex / cols) + 1;

          const panel = coveredByPanel[slotIndex];
          if (panel) {
            // Only the panel's own starting position actually
            // renders something — every other covered position is
            // silently absorbed into that one cell's span.
            if (slotIndex !== panel.startSlotIndex) return null;

            const panelCardDef = panel.panelType === 'card' ? (cardDefMap[panel.cardDefId] ?? null) : null;
            const panelInsert  = panel.panelType === 'insert' ? (binderInsertMap[panel.insertId] ?? null) : null;
            // === FIX (same real bug as the slot-level one below, found
            // right after: this used to check ownershipMap[cardDefId]
            // (is ANY copy of this card owned, anywhere), not whether
            // THIS panel's own linked copy still exists. With 2 copies,
            // unowning the one in this panel left it looking owned
            // because a different copy existed elsewhere. No fallback
            // when inventoryItemId is null — a panel with no specific
            // link is unowned, period, regardless of other copies. ===
            const isOwned = panel.panelType === 'card' && panel.inventoryItemId
              ? (inventoryGroupMap[panel.cardDefId] ?? []).some(inv => inv.id === panel.inventoryItemId)
              : false;

            return (
              <BinderPanelSlot
                key={panel.id}
                panel={panel}
                cardDef={panelCardDef}
                insert={panelInsert}
                isOwned={isOwned}
                gridColumnStart={gridColumnStart}
                gridRowStart={gridRowStart}
                onClick={() => onClickPanel(panel)}
                onUncombine={() => onUncombinePanel(panel)}
                onUpdatePosition={(patch) => onUpdatePanel(panel.id, patch)}
                onDropInsert={onDropInsert ? (insertId) => onDropInsert(panel.id, insertId) : undefined}
              />
            );
          }

          const slot         = pageSlotMap[slotIndex] ?? null;
          const cardDef      = slot ? (cardDefMap[slot.cardDefId] ?? null) : null;
          // === FIX (real bug reported directly by the user): copies
          // are supposed to act independently — this used to check
          // ownershipMap[slot.cardDefId] (is ANY copy of this card
          // owned, anywhere), not whether THIS slot's own linked copy
          // still exists. With 2 copies placed in different slots,
          // unowning the one in this slot correctly unlinked it
          // (slot.inventoryItemId became null) but the slot still
          // rendered as owned/colored, because the OTHER slot's copy
          // still existed. No fallback when inventoryItemId is null —
          // a slot with no specific link is unowned, period,
          // regardless of whether other copies exist elsewhere.
          const isOwned      = slot?.inventoryItemId
            ? (inventoryGroupMap[slot.cardDefId] ?? []).some(inv => inv.id === slot.inventoryItemId)
            : false;
          const isFav        = slot?.inventoryItemId
            ? (inventoryGroupMap[slot.cardDefId] ?? []).find(inv => inv.id === slot.inventoryItemId)?.is_favorite ?? false
            : false;
          const isSelected   = selectedSlot?.id === slot?.id;
          const isMoveTarget = selectedSlot !== null && !slot;

          // === FIX (real bug reported directly by the user): copies
          // are supposed to act independently — unowning the copy
          // sitting in THIS slot shouldn't affect a different copy of
          // the same card placed elsewhere. This used to look up
          // ownershipMap[cardDef.id], which is the generic "earliest
          // acquired" REPRESENTATIVE copy for the card overall — not
          // necessarily the specific copy this particular slot is
          // actually linked to via slot.inventoryItemId. With 2
          // copies (e.g. English + Chinese), toggling ownership from
          // either slot always affected the same representative
          // copy, regardless of which one was actually pictured in
          // that slot. Same fix applies to the info badge below,
          // which had the identical bug (showing the wrong copy's
          // language/condition). ===
          const slotSpecificItem = slot?.inventoryItemId
            ? (inventoryGroupMap[slot.cardDefId] ?? []).find(inv => inv.id === slot.inventoryItemId) ?? null
            : null;

          return (
            <BinderSlot
              key={slotIndex}
              slotIndex={slotIndex}
              slot={slot}
              cardDef={cardDef}
              isOwned={isOwned}
              isFavorite={isFav}
              isPreviewMode={isPreviewMode}
              isSelected={isSelected}
              isMoveTarget={isMoveTarget}
              isCombineMode={isCombineMode}
              isCombineSelected={combineSelection.includes(slotIndex)}
              quantityOwned={cardDef ? getQuantityOwned(inventoryGroupMap, cardDef.id) : 0}
              totalPlaced={cardDef ? getTotalPlacedCount(allBinderSlots, allBinderPanels, cardDef.id) : 0}
              inventoryItem={slotSpecificItem}
              copyGroup={cardDef ? (inventoryGroupMap[cardDef.id] ?? []) : []}
              gridColumnStart={gridColumnStart}
              gridRowStart={gridRowStart}
              onClickEmpty={() => onClickEmpty(slotIndex)}
              onClickSlot={(s) => onClickSlot(s, cardDef)}
              onToggleOwned={cardDef ? () => onToggleOwned(cardDef, slot) : undefined}
              onRemove={slot ? () => onRemove(slot) : undefined}
              onDropCard={onDropEmpty ? (payload) => onDropEmpty(slotIndex, payload) : undefined}
            />
          );
        })}

        {/* === Michi Method support: floating combine action, anchored
            to the current selection's own bounding box instead of a
            disconnected banner elsewhere on screen. Positioned just
            below-center of whatever's currently selected — shows a
            transparent Combine button once the selection forms a
            valid rectangle, or a small "select a rectangle" bubble
            while it doesn't yet.
            === FIX (real bug reported directly by the user): when the
            selection touches the LAST row, the old "always below"
            positioning computed to 100% (or beyond) of the grid's own
            height — landing below the entire page, where it got
            hidden behind whatever UI comes after the binder (bottom
            nav, page indicator, etc). Now flips to sit ABOVE the
            selection instead whenever it touches the bottom row, so
            it's always actually visible.
            === FIX (real bug reported directly by the user): the same
            problem existed on the horizontal axis — centering the
            button on the selection meant a selection near the left or
            right edge of the page pushed half the button's width past
            that edge, clipping it. Now anchors to whichever edge the
            selection is actually touching instead of always
            centering, computed as a single inline transform (both
            axes at once) rather than juggling a combinatorial set of
            CSS classes for every left/right × above/below pairing. === */}
        {isCombineMode && combineSelection.length > 0 && (() => {
          const rows = combineSelection.map(i => Math.floor(i / cols));
          const colsSel = combineSelection.map(i => i % cols);
          const minRow = Math.min(...rows), maxRow = Math.max(...rows);
          const minCol = Math.min(...colsSel), maxCol = Math.max(...colsSel);

          const touchesBottomRow = maxRow >= binder.rows - 1;
          const touchesLastCol   = maxCol >= cols - 1;
          const touchesFirstCol  = minCol <= 0;

          let leftPct, translateX;
          if (touchesLastCol && !touchesFirstCol) {
            leftPct = ((maxCol + 1) / cols) * 100; // right edge of selection
            translateX = '-100%'; // anchor the button's own right edge here
          } else if (touchesFirstCol && !touchesLastCol) {
            leftPct = (minCol / cols) * 100; // left edge of selection
            translateX = '0%'; // anchor the button's own left edge here
          } else {
            leftPct = ((minCol + maxCol + 2) / 2 / cols) * 100; // centered, as before
            translateX = '-50%';
          }

          const topPct = touchesBottomRow
            ? (minRow / binder.rows) * 100   // sit above the selection's top edge
            : ((maxRow + 1) / binder.rows) * 100; // sit below the selection's bottom edge (original behavior)
          const translateY = touchesBottomRow ? 'calc(-100% - var(--space-2))' : 'var(--space-2)';

          const rect = getCombineRectangle(cols);

          return (
            <div
              className="binder-combine-floating"
              style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: `translate(${translateX}, ${translateY})` }}
            >
              {rect ? (
                <button
                  className="binder-combine-floating-btn"
                  onClick={() => onConfirmCombine(rect)}
                >
                  Combine {rect.spanCols}×{rect.spanRows}
                </button>
              ) : (
                <div className="binder-combine-floating-bubble">
                  Please select a rectangle to combine
                </div>
              )}
              <button
                className="binder-combine-floating-cancel"
                onClick={onClearCombineSelection}
                aria-label="Cancel selection"
                title="Cancel selection"
              >
                ✕
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// === ISSUE #55 END ===