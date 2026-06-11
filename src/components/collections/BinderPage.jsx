/**
 * @fileoverview BinderPage — renders the full slot grid for one binder page.
 * Receives pre-computed slot and card data via props. No dispatch.
 */

// === ISSUE #55 START: Binder Page View — BinderPage ===

import { BinderSlot } from './BinderSlot.jsx';

/**
 * @param {{
 *   binder: object,
 *   pageNumber: number,
 *   pageSlotMap: Record<number, object>,   — slotIndex → slot
 *   cardDefMap: Record<string, object>,    — cardDefId → cardDef
 *   ownershipMap: Record<string, object>,  — cardDefId → inventoryItem
 *   onClickEmpty: (slotIndex) => void,
 *   onClickSlot: (slot, cardDef) => void,
 * }} props
 */
export function BinderPage({
  binder,
  pageNumber,
  pageSlotMap,
  cardDefMap,
  ownershipMap,
  onClickEmpty,
  onClickSlot,
}) {
  const totalSlots = binder.rows * binder.cols;

  return (
    <div className="binder-page-wrapper">
      <div className="binder-page-label">Page {pageNumber}</div>
      <div
        className="binder-page-grid"
        style={{ gridTemplateColumns: `repeat(${binder.cols}, 1fr)` }}
      >
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          const slot    = pageSlotMap[slotIndex] ?? null;
          const cardDef = slot ? (cardDefMap[slot.cardDefId] ?? null) : null;
          const isOwned    = slot ? ownershipMap[slot.cardDefId] !== undefined : false;
          const isFavorite = slot ? (ownershipMap[slot.cardDefId]?.is_favorite ?? false) : false;

          return (
            <BinderSlot
              key={slotIndex}
              slotIndex={slotIndex}
              slot={slot}
              cardDef={cardDef}
              isOwned={isOwned}
              isFavorite={isFavorite}
              onClickEmpty={() => onClickEmpty(slotIndex)}
              onClickSlot={(s) => onClickSlot(s, cardDef)}
            />
          );
        })}
      </div>
    </div>
  );
}

// === ISSUE #55 END: Binder Page View — BinderPage ===