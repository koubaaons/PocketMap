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

export function BinderPage({
  binder,
  pageNumber,
  pageSlotMap,
  cardDefMap,
  ownershipMap,
  inventoryGroupMap = {},
  allBinderSlots = [],
  allBinderPanels = [],
  pagePanels = [],
  binderInsertMap = {},
  isPreviewMode = false,
  selectedSlot = null,
  onClickEmpty,
  onClickSlot,
  onToggleOwned,
  onRemove,
  onClickPanel,
  onUncombinePanel,
  onUpdatePanel,
  isCombineMode = false,
  combineSelection = [],
  getCombineRectangle,
  onConfirmCombine,
}) {
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
            const isOwned = panel.panelType === 'card' ? ownershipMap[panel.cardDefId] !== undefined : false;

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
                onUncombine={!isPreviewMode ? () => onUncombinePanel(panel) : undefined}
                onUpdatePosition={(patch) => onUpdatePanel(panel.id, patch)}
              />
            );
          }

          const slot         = pageSlotMap[slotIndex] ?? null;
          const cardDef      = slot ? (cardDefMap[slot.cardDefId] ?? null) : null;
          const isOwned      = slot ? ownershipMap[slot.cardDefId] !== undefined : false;
          const isFav        = slot ? (ownershipMap[slot.cardDefId]?.is_favorite ?? false) : false;
          const isSelected   = selectedSlot?.id === slot?.id;
          const isMoveTarget = selectedSlot !== null && !slot;

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
              gridColumnStart={gridColumnStart}
              gridRowStart={gridRowStart}
              onClickEmpty={() => onClickEmpty(slotIndex)}
              onClickSlot={(s) => onClickSlot(s, cardDef)}
              onToggleOwned={cardDef ? () => onToggleOwned(cardDef) : undefined}
              onRemove={slot ? () => onRemove(slot) : undefined}
            />
          );
        })}

        {/* === Michi Method support: floating combine action, anchored
            to the current selection's own bounding box instead of a
            disconnected banner elsewhere on screen. Positioned just
            below-center of whatever's currently selected — shows a
            transparent Combine button once the selection forms a
            valid rectangle, or a small "select a rectangle" bubble
            while it doesn't yet. === */}
        {isCombineMode && combineSelection.length > 0 && (() => {
          const rows = combineSelection.map(i => Math.floor(i / cols));
          const colsSel = combineSelection.map(i => i % cols);
          const minRow = Math.min(...rows), maxRow = Math.max(...rows);
          const minCol = Math.min(...colsSel), maxCol = Math.max(...colsSel);
          const leftPct = ((minCol + maxCol + 2) / 2 / cols) * 100;
          const topPct  = ((maxRow + 1) / binder.rows) * 100;

          const rect = getCombineRectangle(cols);

          return (
            <div
              className="binder-combine-floating"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
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
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// === ISSUE #55 END ===