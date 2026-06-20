/**
 * @fileoverview CardGridItem — single image-first tile in a card grid.
 * === ISSUE #84: fixed column grid layout, consistent card size everywhere ===
 * === ISSUE: click-to-favorite star, owned cards only ===
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
 */

export function CardGridItem({ card, inventoryItem, onView, onToggleFavorite }) {
  const isOwned    = inventoryItem !== null && inventoryItem !== undefined;
  const isFavorite = inventoryItem?.is_favorite ?? false;

  const handleStarClick = (e) => {
    e.stopPropagation(); // don't also trigger onView
    if (isOwned && onToggleFavorite) onToggleFavorite(inventoryItem);
  };

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