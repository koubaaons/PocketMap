/**
 * @fileoverview BinderPage — grid of slots for one page.
 * === ISSUE #82: passes preview mode and selected slot props to each slot ===
 */

// === ISSUE #55 START: Binder Page View — BinderPage ===

import { BinderSlot } from './BinderSlot.jsx';

export function BinderPage({
  binder,
  pageNumber,
  pageSlotMap,
  cardDefMap,
  ownershipMap,
  isPreviewMode = false,
  selectedSlot = null,
  onClickEmpty,
  onClickSlot,
  onToggleOwned,
  onRemove,
}) {
  const totalSlots = binder.rows * binder.cols;

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
              onClickEmpty={() => onClickEmpty(slotIndex)}
              onClickSlot={(s) => onClickSlot(s, cardDef)}
              onToggleOwned={cardDef ? () => onToggleOwned(cardDef) : undefined}
              onRemove={slot ? () => onRemove(slot) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// === ISSUE #55 END ===