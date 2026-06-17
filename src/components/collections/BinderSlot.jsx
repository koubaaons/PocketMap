/**
 * @fileoverview BinderSlot — renders a single slot in the binder grid.
 *
 * Three states:
 *   empty       — no card assigned, shows + to add
 *   placeholder — card assigned but not owned, greyscale image or grey text
 *   filled      — card assigned and owned, full color
 */

// === ISSUE #55 START: Binder Page View — BinderSlot ===
// === ISSUE #80: show greyscale image for unowned cards ===

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

  // Placeholder — card assigned but not owned
  if (!isOwned) {
    return (
      <button
        className="binder-slot binder-slot-placeholder"
        onClick={() => onClickSlot(slot)}
        aria-label={`${cardDef.name} — not owned`}
      >
        <span className="slot-index">{slotIndex + 1}</span>
        {cardDef.image_url ? (
          // === ISSUE #80: show image in greyscale when not owned ===
          <img
            src={cardDef.image_url}
            alt={cardDef.name}
            className="slot-card-image slot-card-image-grey"
          />
        ) : (
          <div className="slot-card-content">
            <span className="slot-card-name">{cardDef.name}</span>
            <span className="slot-placeholder-label">Not owned</span>
          </div>
        )}
      </button>
    );
  }

  // Filled — card owned, full color
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

// === ISSUE #80 END ===
// === ISSUE #55 END: Binder Page View — BinderSlot ===