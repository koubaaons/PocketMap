/**
 * @fileoverview CardGridItem — single image-first tile in a card grid.
 * === ISSUE #84: fixed column grid layout, consistent card size everywhere ===
 *
 * Replaces the old row-style display (CardDefinitionRow, FavoritesView's
 * inline result-row markup) with one shared tile component used by every
 * card listing: Collections' All Cards / Owned / Missing / Unorganised
 * tabs, and Favorites.
 *
 * Deliberately visual-only — no Edit/Delete buttons on the tile itself.
 * Clicking the tile calls onView, which opens the card detail where
 * those actions already live (per existing CardDetailModal flow).
 */

export function CardGridItem({ card, isOwned, isFavorite, onView }) {
  return (
    <button
      className={`card-grid-item ${isOwned ? 'card-grid-item-owned' : 'card-grid-item-not-owned'}`}
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

        {isFavorite && (
          <span className="card-grid-item-fav" title="Favorite">★</span>
        )}

        <span
          className={`card-grid-item-status ${isOwned ? 'card-grid-item-status-owned' : 'card-grid-item-status-missing'}`}
          title={isOwned ? 'Owned' : 'Not owned'}
        >
          {isOwned ? '✓' : '○'}
        </span>
      </div>

      <span className="card-grid-item-name">{card.name}</span>
    </button>
  );
}