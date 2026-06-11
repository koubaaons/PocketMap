/**
 * @fileoverview BinderSlot — renders a single slot in the binder grid.
 *
 * Three states:
 *   empty       — no card assigned, shows + to add
 *   placeholder — card assigned but not owned, grey
 *   filled      — card assigned and owned, colored
 */

// === ISSUE #55 START: Binder Page View — BinderSlot ===

/**
 * @param {{
 *   slotIndex: number,
 *   slot: object | null,        — null if empty
 *   cardDef: object | null,     — null if empty
 *   isOwned: boolean,
 *   isFavorite: boolean,
 *   onClickEmpty: () => void,
 *   onClickSlot: (slot) => void,
 * }} props
 */
export function BinderSlot({ slotIndex, slot, cardDef, isOwned, isFavorite, onClickEmpty, onClickSlot }) {

  // Empty slot
  if (!slot || !cardDef) {
    return (
      <button
        className="binder-slot binder-slot-empty"
        onClick={onClickEmpty}
        aria-label={`Add card to slot ${slotIndex + 1}`}
      >
        <span className="slot-index">{slotIndex + 1}</span>
        <span className="slot-add-icon">+</span>
      </button>
    );
  }

  // Placeholder — card assigned but not owned (grey)
  if (!isOwned) {
    return (
      <button
        className="binder-slot binder-slot-placeholder"
        onClick={() => onClickSlot(slot)}
        aria-label={`${cardDef.name} — not owned`}
      >
        <span className="slot-index">{slotIndex + 1}</span>
        <div className="slot-card-content">
          <span className="slot-card-name">{cardDef.name}</span>
          <span className="slot-placeholder-label">Not owned</span>
        </div>
      </button>
    );
  }

  // Filled — card owned
  return (
    <button
      className="binder-slot binder-slot-filled"
      onClick={() => onClickSlot(slot)}
      aria-label={cardDef.name}
    >
      <span className="slot-index">{slotIndex + 1}</span>
      {isFavorite && <span className="slot-fav-star" aria-label="Favorite">★</span>}
      {cardDef.image_url ? (
        <img src={cardDef.image_url} alt={cardDef.name} className="slot-card-image" />
      ) : (
        <div className="slot-card-content">
          <span className="slot-card-name">{cardDef.name}</span>
        </div>
      )}
    </button>
  );
}

// === ISSUE #55 END: Binder Page View — BinderSlot ===