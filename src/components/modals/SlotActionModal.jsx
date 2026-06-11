/**
 * @fileoverview SlotActionModal — actions when clicking a filled or placeholder slot.
 *
 * Owned card:   View card details, Remove from binder
 * Unowned card: "I own it now", Remove from binder
 */

// === ISSUE #56 START: Binder Slot Actions ===

import { Button, Modal, ModalActions } from '../ui/index.jsx';

/**
 * @param {{
 *   slot: object,
 *   cardDef: object,
 *   inventoryItem: object | null,
 *   onOwn: () => void,
 *   onRemove: () => void,
 *   onViewDetail: () => void,
 *   onClose: () => void,
 * }} props
 */
export function SlotActionModal({
  slot,
  cardDef,
  inventoryItem,
  onOwn,
  onRemove,
  onViewDetail,
  onClose,
}) {
  const isOwned = inventoryItem !== null;

  return (
    <Modal title={cardDef.name} onClose={onClose}>

      <div className="slot-action-status">
        {isOwned ? (
          <span className="status-badge status-owned">✓ Owned</span>
        ) : (
          <span className="status-badge status-not-owned">○ Not owned — placeholder</span>
        )}
      </div>

      <div className="slot-action-location">
        <span className="detail-label">Location</span>
        <span className="detail-value">
          Page {slot.pageNumber}, Slot {slot.slotIndex + 1}
        </span>
      </div>

      <hr className="modal-divider" />

      <div className="slot-action-buttons">
        {/* Owned card actions */}
        {isOwned && (
          <Button variant="ghost" onClick={onViewDetail}>
            View Card Details
          </Button>
        )}

        {/* Unowned card — mark as owned */}
        {!isOwned && (
          <Button variant="primary" onClick={onOwn}>
            ✓ I own it now
          </Button>
        )}

        {/* Both — remove from binder */}
        <Button variant="danger" onClick={onRemove}>
          Remove from Binder
        </Button>
      </div>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
}

// === ISSUE #56 END: Binder Slot Actions ===