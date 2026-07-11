/**
 * @fileoverview BinderSlot — single slot in the binder grid.
 * === ISSUE #82: preview mode shows all cards in full color, selected state for move ===
 */

// === ISSUE #55 START: Binder Page View — BinderSlot ===

// === HOLO: pointer-position tracking, written straight to the DOM
// (bypasses React state — see useCardHoloPointer.js for why this
// matters for performance). Only ever attached when the slot's own
// card actually has a holoType set; ordinary cards pay nothing. ===
import { useEffect, useRef, useState } from 'react';
import { useCardHoloPointer } from '../../hooks/useCardHoloPointer.js';

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
  const hasCard = !!(slot && cardDef);

  // === FIX (new card reveal animation, plus a latent hooks-order bug
  // this fix required correcting): useCardHoloPointer was previously
  // called AFTER an early return for the empty-slot case — meaning
  // the SAME component instance calls a different number of hooks
  // depending on whether its slot is empty or filled, which breaks
  // React's rules of hooks the moment a slot transitions between the
  // two (exactly the transition this animation needs to detect).
  // Moving every hook above any early return fixes that as a
  // necessary side effect.
  //
  // hadCardRef tracks whether THIS slot had a card on the previous
  // render; if it just went from empty to filled, justFilled flips on
  // for one animation cycle (see binder-slot-reveal in
  // binder-view-feature.css) and back off automatically after.
  const hadCardRef = useRef(hasCard);
  const [justFilled, setJustFilled] = useState(false);

  useEffect(() => {
    if (hasCard && !hadCardRef.current) {
      setJustFilled(true);
      const t = setTimeout(() => setJustFilled(false), 400);
      hadCardRef.current = true;
      return () => clearTimeout(t);
    }
    hadCardRef.current = hasCard;
  }, [hasCard]);

  // In preview mode all cards show in full color regardless of ownership
  const showGrey = hasCard && !isOwned && !isPreviewMode;

  // === HOLO: only meaningfully active when this card has a holoType
  // set AND it's actually showing in full color — a greyed-out
  // not-owned placeholder shouldn't shine, matching the existing
  // convention that ownership already changes how a slot looks
  // (slot-card-image-grey, "Not owned" label) rather than introducing
  // a new, separate rule just for holo. cardDef.holoType may be
  // undefined on cards created before this field existed; treat that
  // the same as 'none' (Regular Holo, the default look — see
  // collection.types.js for why 'none' is no longer a no-op). Only
  // 'off' genuinely disables the holo overlay now. ===
  const holoType = hasCard ? (cardDef.holoType ?? 'none') : 'none';
  const activeHolo = hasCard && !showGrey && holoType !== 'off' ? holoType : null;
  const { holoRef, handlePointerMove, handlePointerLeave } = useCardHoloPointer();

  // Empty slot
  if (!hasCard) {
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

  return (
    <button
      ref={activeHolo ? holoRef : undefined}
      className={`binder-slot ${showGrey ? 'binder-slot-placeholder' : 'binder-slot-filled'} ${isSelected ? 'binder-slot-selected' : ''} ${justFilled ? 'binder-slot-reveal' : ''}`}
      data-holo={activeHolo ?? undefined}
      onClick={() => onClickSlot(slot)}
      onPointerMove={activeHolo ? handlePointerMove : undefined}
      onPointerLeave={activeHolo ? handlePointerLeave : undefined}
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
      {/* === HOLO: two real overlay elements, matching the source's
          own .card__shine / .card__glare structure exactly — each
          with its own ::before/::after sub-layers and its own
          mix-blend-mode, not flattened into one pseudo-element. === */}
      {activeHolo && (
        <>
          <span className="card-holo-shine" aria-hidden="true" />
          <span className="card-holo-glare" aria-hidden="true" />
        </>
      )}
      {/* === FIX (new card reveal animation): a slide-in, not a flip —
          placing a card in a binder is a physical insertion, distinct
          from the flip+shine "you now got this card" moment used in
          the collection view (see CardGridItem.jsx). justFilled
          controls the animation class only; no extra overlay element
          needed for a slide. === */}
    </button>
  );
}

// === ISSUE #55 END ===