/**
 * @fileoverview CardDefinitionRow — renders a single card definition in the list.
 * === ISSUE #80: card image displayed on left side ===
 */

// === ISSUE #15 START: Card Definitions List — CardDefinitionRow ===
// === ISSUE #80 START: Card Images ===

export function CardDefinitionRow({ card, templateFields, isOwned, isFavorite, onView, onEdit, onDelete }) {
  const previewFields = templateFields
    .filter(f => f.collectionId === card.collectionId)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);

  return (
    <div
      className={`card-def-row ${isOwned ? 'card-owned' : 'card-not-owned'}`}
      onClick={onView}
      style={{ cursor: 'pointer' }}
    >
      {/* === ISSUE #80: card image or placeholder === */}
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.name}
          className="card-def-image"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div className="card-def-image-placeholder" aria-hidden="true">🃏</div>
      )}

      <div className="card-def-ownership">
        {isOwned
          ? <span className="ownership-dot ownership-owned" title="Owned">✓</span>
          : <span className="ownership-dot ownership-missing" title="Not owned">○</span>
        }
        {isFavorite && <span className="ownership-fav" title="Favorite">★</span>}
      </div>

      <div className="card-def-info" style={{ flex: 1 }}>
        <span className="card-def-name">{card.name}</span>
        {previewFields.length > 0 && (
          <span className="card-def-attrs">
            {previewFields.map(f => {
              const val = card.attributes?.[f.field_name];
              if (val === undefined || val === null || val === '') return null;
              return (
                <span key={f.id} className="card-def-attr">
                  <span className="attr-label">{f.field_name}:</span>{' '}
                  <span className="attr-value">{String(val)}</span>
                </span>
              );
            }).filter(Boolean)}
          </span>
        )}
      </div>

      <div className="card-def-actions">
        <button
          className="card-action-btn"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          aria-label={`Edit ${card.name}`}
        >
          Edit
        </button>
        <button
          className="card-action-btn card-action-danger"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${card.name}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// === ISSUE #80 END: Card Images ===
// === ISSUE #15 END: Card Definitions List — CardDefinitionRow ===