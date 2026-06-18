/**
 * @fileoverview BinderSlot — single slot in the binder grid.
 * === ISSUE #82: preview mode shows all cards in full color, selected state for move ===
 */

// === ISSUE #55 START: Binder Page View — BinderSlot ===

export function BinderSlot({
  slotIndex,
  slot,
  cardDef,
  isOwned,
  isFavorite,
  isPreviewMode = false,
  isSelected = false,
  isMoveTarget = false,
  onClickEmpty,
  onClickSlot,
}) {

  // Empty slot
  if (!slot || !cardDef) {
    return (
      <button
        className={`binder-slot binder-slot-empty ${isMoveTarget ? 'binder-slot-move-target' : ''}`}
        onClick={onClickEmpty}
        aria-label={`Add card to slot ${slotIndex + 1}`}
      >
        <span className="slot-index">{slotIndex + 1}</span>
        <span className="slot-add-icon">{isMoveTarget ? '↓' : '+'}</span>
      </button>
    );
  }

  // In preview mode all cards show in full color regardless of ownership
  const showGrey = !isOwned && !isPreviewMode;

  return (
    <button
      className={`binder-slot ${showGrey ? 'binder-slot-placeholder' : 'binder-slot-filled'} ${isSelected ? 'binder-slot-selected' : ''}`}
      onClick={() => onClickSlot(slot)}
      aria-label={cardDef.name}
      aria-pressed={isSelected}
    >
      <span className="slot-index">{slotIndex + 1}</span>
      {isFavorite && <span className="slot-fav-star" aria-label="Favorite">★</span>}
      {cardDef.image_url ? (
        <img
          src={cardDef.image_url}
          alt={cardDef.name}
          className={`slot-card-image ${showGrey ? 'slot-card-image-grey' : ''}`}
        />
      ) : (
        <div className="slot-card-content">
          <span className="slot-card-name">{cardDef.name}</span>
          {showGrey && <span className="slot-placeholder-label">Not owned</span>}
        </div>
      )}
    </button>
  );
}

// === ISSUE #55 END ===