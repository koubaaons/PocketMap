/**
 * @fileoverview CardGridItem — single image-first tile in a card grid.
 * === ISSUE #84: fixed column grid layout, consistent card size everywhere ===
 * === ISSUE: click-to-favorite star, owned cards only ===
 * === ISSUE #85: optional collectionName subtext, used by Favorites only —
 *     Collections tabs are already scoped to one collection so it'd be
 *     redundant there; Favorites spans multiple collections so it's
 *     genuinely useful context there. ===
 *
 * Replaces the old row-style display (CardDefinitionRow, FavoritesView's
 * inline result-row markup) with one shared tile component used by every
 * card listing: Collections' All Cards / Owned / Missing / Unorganised
 * tabs, and Favorites.
 *
 * Deliberately visual-only otherwise — no Edit/Delete buttons on the tile
 * itself. Clicking the tile (outside the star) calls onView, which opens
 * the card detail where those actions already live.
 *
 * Takes the actual inventoryItem (not separate isOwned/isFavorite
 * booleans) because handleToggleFavorite (useInventoryActions.js) needs
 * the full item object, not just an id or a boolean.
 *
 * === FIX (new card reveal animation): plays once when a card
 * transitions from not-owned to owned — the "you now have this card"
 * moment, which is what a flip-in + light sweep is meant to celebrate.
 * This is deliberately SEPARATE from the binder-slot animation (a
 * slide-in, see BinderSlot.jsx) — getting a card into your collection
 * and physically placing it into a binder page are different actions
 * that call for different motion. hadOwnedRef tracks whether THIS
 * card was owned on the previous render; justRevealed flips on for one
 * animation cycle when it wasn't and now is, then back off
 * automatically.
 *
 * === FIX (own/unown flow): the ✓/○ circle is now a real button,
 * mirroring the favorite star exactly — click to toggle ownership on
 * the spot, no modal needed for the common case (handleOwn/handleUnown
 * are already simple, instant actions — see useInventoryActions.js).
 * The reveal animation above needs no changes for this: it already
 * triggers off isOwned transitioning from false to true regardless of
 * WHAT caused that change, so clicking the circle gets the same
 * flip+shine the card detail modal's own "mark as owned" already gets.
 * onToggleOwned is optional — FavoritesView only ever shows already-
 * owned cards (see the isOwned-gated star above), so the circle simply
 * stays non-interactive there, exactly like before. ===*/

import { useEffect, useRef, useState } from 'react';

export function CardGridItem({ card, inventoryItem, collectionName, onView, onToggleFavorite, onToggleOwned }) {
  const isOwned    = inventoryItem !== null && inventoryItem !== undefined;
  const isFavorite = inventoryItem?.is_favorite ?? false;

  const hadOwnedRef = useRef(isOwned);
  const [justRevealed, setJustRevealed] = useState(false);

  useEffect(() => {
    if (isOwned && !hadOwnedRef.current) {
      setJustRevealed(true);
      const t = setTimeout(() => setJustRevealed(false), 500);
      hadOwnedRef.current = true;
      return () => clearTimeout(t);
    }
    hadOwnedRef.current = isOwned;
  }, [isOwned]);

  const handleStarClick = (e) => {
    e.stopPropagation(); // don't also trigger onView
    if (isOwned && onToggleFavorite) onToggleFavorite(inventoryItem);
  };

  const handleStatusClick = (e) => {
    e.stopPropagation(); // don't also trigger onView
    if (onToggleOwned) onToggleOwned(card, inventoryItem);
  };

  return (
    <button
      className={`card-grid-item ${isOwned ? 'card-grid-item-owned' : 'card-grid-item-not-owned'} ${justRevealed ? 'card-grid-item-reveal' : ''}`}
      onClick={onView}
      aria-label={card.name}
    >
      <div className="card-grid-item-image-wrapper">
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.name}
            className={`card-grid-item-image ${!isOwned ? 'card-grid-item-image-grey' : ''}`}
          />
        ) : (
          <div className="card-grid-item-image-placeholder" aria-hidden="true">🃏</div>
        )}

        {/* Only owned cards get a star at all — favoriting something you
            don't own doesn't make sense, so unowned cards show nothing
            here rather than a disabled/grey star. */}
        {isOwned && (
          <button
            className={`card-grid-item-fav-btn ${isFavorite ? 'card-grid-item-fav-btn-active' : ''}`}
            onClick={handleStarClick}
            aria-label={isFavorite ? `Remove ${card.name} from favorites` : `Add ${card.name} to favorites`}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}

        {onToggleOwned ? (
          <button
            className={`card-grid-item-status card-grid-item-status-clickable ${isOwned ? 'card-grid-item-status-owned' : 'card-grid-item-status-missing'}`}
            onClick={handleStatusClick}
            aria-label={isOwned ? `Remove ${card.name} from your collection` : `Mark ${card.name} as owned`}
            aria-pressed={isOwned}
          >
            {isOwned ? '✓' : '○'}
          </button>
        ) : (
          <span
            className={`card-grid-item-status ${isOwned ? 'card-grid-item-status-owned' : 'card-grid-item-status-missing'}`}
            title={isOwned ? 'Owned' : 'Not owned'}
          >
            {isOwned ? '✓' : '○'}
          </span>
        )}

        {/* === FIX: light-sweep overlay, only rendered for the ~0.5s the
            reveal is playing. Lives inside .card-grid-item-image-wrapper
            (which already has position:relative + overflow:hidden — see
            card-grid.css) so it clips to the image area, not the tile's
            text label below. ===*/}
        {justRevealed && <span className="card-grid-item-reveal-shine" aria-hidden="true" />}
      </div>

      <div className="card-grid-item-info">
        <span className="card-grid-item-name">{card.name}</span>
        {collectionName && (
          <span className="card-grid-item-collection">{collectionName}</span>
        )}
      </div>
    </button>
  );
}