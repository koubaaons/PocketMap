/**
 * @fileoverview ExportPageRenderer — a clean, non-interactive render
 * of exactly one physical binder page, built specifically for image/
 * PDF export.
 *
 * Deliberately NOT a reuse of BinderPage.jsx/BinderSlot.jsx/
 * BinderPanelSlot.jsx: those are full of interactive affordances
 * (click handlers, hover buttons, "+" add icons, drag targets,
 * selection highlighting) that have no business appearing in an
 * exported image, and stripping all of that back out via props would
 * make those already-complex components even harder to follow. This
 * mirrors just their layout algorithm (explicit grid position per
 * cell, panels spanning multiple cells) with a static, minimal cell
 * renderer instead.
 *
 * Supports the four export toggles directly:
 * - hideSlotNumbers    — the small position number in each slot's corner
 * - hideQuantityBadges — the "×N" badge on a card with multiple copies
 * - hideBackground     — the binder's own page background/texture
 * - cardsOnly          — the strongest option: no background, no slot
 *   borders/frame, no page label — just the card/insert images
 *   themselves, floating on nothing. Meaningful only for a transparent
 *   PNG export; see binderExport.js for why this can't apply to PDF.
 */

export function ExportPageRenderer({
  binder,
  pageNumber,
  pageSlotMap,
  pagePanels = [],
  cardDefMap,
  binderInsertMap,
  inventoryGroupMap,
  hideSlotNumbers = false,
  hideQuantityBadges = false,
  hideBackground = false,
  cardsOnly = false,
}) {
  const totalSlots = binder.rows * binder.cols;
  const cols = binder.cols;

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

  const wrapperClass = cardsOnly
    ? 'export-page-wrapper export-page-wrapper-transparent'
    : `export-page-wrapper ${hideBackground ? 'export-page-wrapper-plain' : ''}`;

  return (
    <div className={wrapperClass}>
      {!cardsOnly && <div className="export-page-label">Page {pageNumber}</div>}
      <div className="export-page-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          const gridColumnStart = (slotIndex % cols) + 1;
          const gridRowStart    = Math.floor(slotIndex / cols) + 1;
          const cellStyle = { gridColumnStart, gridRowStart };

          const panel = coveredByPanel[slotIndex];
          if (panel) {
            if (slotIndex !== panel.startSlotIndex) return null;

            const panelCardDef = panel.panelType === 'card' ? (cardDefMap[panel.cardDefId] ?? null) : null;
            const panelInsert  = panel.panelType === 'insert' ? (binderInsertMap[panel.insertId] ?? null) : null;
            const name     = panel.panelType === 'card' ? panelCardDef?.name : panelInsert?.name;
            const imageUrl = panel.panelType === 'card' ? panelCardDef?.image_url : panelInsert?.image_url;
            const isOwned  = panel.panelType === 'card' && panel.inventoryItemId
              ? (inventoryGroupMap[panel.cardDefId] ?? []).some(inv => inv.id === panel.inventoryItemId)
              : false;
            const showGrey = panel.panelType === 'card' && !isOwned;
            const quantity = panel.panelType === 'card' ? (inventoryGroupMap[panel.cardDefId]?.length ?? 0) : 0;

            return (
              <div
                key={panel.id}
                className={`export-cell export-cell-filled ${cardsOnly ? 'export-cell-cardsonly' : ''}`}
                style={{ ...cellStyle, gridColumn: `span ${panel.spanCols}`, gridRow: `span ${panel.spanRows}` }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={name ?? ''} crossOrigin="anonymous" className={`export-cell-image ${showGrey ? 'export-cell-image-grey' : ''}`} />
                ) : (
                  !cardsOnly && <div className="export-cell-placeholder" />
                )}
                {!hideQuantityBadges && quantity > 1 && (
                  <span className="export-cell-quantity">×{quantity}</span>
                )}
              </div>
            );
          }

          const slot    = pageSlotMap[slotIndex] ?? null;
          const cardDef = slot ? (cardDefMap[slot.cardDefId] ?? null) : null;
          const isOwned = slot?.inventoryItemId
            ? (inventoryGroupMap[slot.cardDefId] ?? []).some(inv => inv.id === slot.inventoryItemId)
            : false;
          const showGrey = !!slot && !isOwned;
          const quantity = slot ? (inventoryGroupMap[slot.cardDefId]?.length ?? 0) : 0;

          if (!slot) {
            // Empty slot — a faint bordered box normally (like a real
            // empty binder pocket), or nothing at all in cardsOnly
            // mode (fully transparent gap, no visual placeholder).
            return cardsOnly ? null : (
              <div key={slotIndex} className="export-cell export-cell-empty" style={cellStyle}>
                {!hideSlotNumbers && <span className="export-cell-index">{slotIndex + 1}</span>}
              </div>
            );
          }

          return (
            <div key={slotIndex} className={`export-cell export-cell-filled ${cardsOnly ? 'export-cell-cardsonly' : ''}`} style={cellStyle}>
              {!hideSlotNumbers && !cardsOnly && <span className="export-cell-index">{slotIndex + 1}</span>}
              {cardDef?.image_url ? (
                <img src={cardDef.image_url} alt={cardDef.name} crossOrigin="anonymous" className={`export-cell-image ${showGrey ? 'export-cell-image-grey' : ''}`} />
              ) : (
                !cardsOnly && <div className="export-cell-placeholder" />
              )}
              {!hideQuantityBadges && quantity > 1 && (
                <span className="export-cell-quantity">×{quantity}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}