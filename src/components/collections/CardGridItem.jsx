/**
 * @fileoverview CardGridItem — single image-first tile, shared by
 * Collections' All Cards/Owned/Missing/Unorganised tabs and Favorites.
 *
 * Visual-only — no Edit/Delete on the tile; clicking it (outside the
 * star) calls onView to open the card detail instead. Takes the full
 * inventoryItem rather than isOwned/isFavorite booleans since
 * handleToggleFavorite needs the whole object.
 *
 * The flip+shine reveal plays once when a card transitions from
 * not-owned to owned (hadOwnedRef tracks the previous state). It's
 * deliberately separate from BinderSlot's slide-in — collecting a card
 * and placing it in a binder page are different actions.
 *
 * The ✓/○ circle is a real button mirroring the favorite star — click
 * to toggle ownership instantly. It triggers the same reveal animation
 * automatically, since that's keyed off isOwned changing, not what
 * caused it. onToggleOwned is optional (FavoritesView leaves it out;
 * the circle stays non-interactive there). */

import { useEffect, useRef, useState } from 'react';
import { formatConditionRating, formatLanguage } from '../../types/index.js';

export function CardGridItem({ card, inventoryItem, collectionName, onView, onToggleFavorite, onToggleOwned, quantityOwned = 0, totalPlaced = 0 }) {
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
    <div
      className={`card-grid-item ${isOwned ? 'card-grid-item-owned' : 'card-grid-item-not-owned'} ${justRevealed ? 'card-grid-item-reveal' : ''}`}
      onClick={onView}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(); } }}
      role="button"
      tabIndex={0}
      aria-label={card.name}
    >
      <div className="card-grid-item-image-wrapper">
        {/* === Quantity tracking: "X of Y placed" badge — only shown
            once more than one copy is owned; a single owned card
            doesn't need "1 of 1 placed" cluttering every tile. === */}
        {quantityOwned > 1 && (
          <span className="card-grid-item-quantity-badge">
            {totalPlaced} of {quantityOwned} placed
          </span>
        )}
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

        {/* === Language/condition info badge — visibility controlled
            entirely by CSS via [data-show-card-info] on the document
            root (see useCardInfoToggle.js and card-grid.css), not a
            prop threaded down here. Only shown for owned cards with
            at least one of the two set — an empty badge would just
            be noise. === */}
        {isOwned && (inventoryItem?.condition_rating || inventoryItem?.language) && (
          <span className="card-grid-item-info-badge">
            {[
              inventoryItem.language && formatLanguage(inventoryItem.language),
              inventoryItem.condition_rating && formatConditionRating(inventoryItem.condition_rating),
            ].filter(Boolean).join(' · ')}
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
    </div>
  );
}