/**
 * @fileoverview CardDefinitionRow — renders a single card definition in the list.
 * Receives pre-computed ownership state via props. No dispatch.
 */

// === ISSUE #15 START: Card Definitions List — CardDefinitionRow ===

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
      <div className="card-def-ownership">
        {isOwned
          ? <span className="ownership-dot ownership-owned" title="Owned">✓</span>
          : <span className="ownership-dot ownership-missing" title="Not owned">○</span>
        }
        {/* === ISSUE #38 START: Favorite indicator === */}
        {isFavorite && <span className="ownership-fav" title="Favorite">★</span>}
        {/* === ISSUE #38 END === */}
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

// === ISSUE #15 END: Card Definitions List — CardDefinitionRow ===