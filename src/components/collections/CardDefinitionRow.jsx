/**
 * @fileoverview CardDefinitionRow — renders a single card definition in the list.
 *
 * Receives pre-computed data via props. No state, no dispatch.
 * Shows card name, key attributes, and an actions menu.
 */

// === ISSUE #15 START: Card Definitions List — CardDefinitionRow ===

/**
 * @param {{
 *   card: object,
 *   templateFields: object[],
 *   onEdit: () => void,
 *   onDelete: () => void,
 * }} props
 */
export function CardDefinitionRow({ card, templateFields, onEdit, onDelete }) {
  // Show the first 3 attributes as preview values
  const previewFields = templateFields
    .filter(f => f.collectionId === card.collectionId)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);

  return (
    <div className="card-def-row">
      <div className="card-def-info">
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
        <button className="card-action-btn" onClick={onEdit} aria-label={`Edit ${card.name}`}>
          Edit
        </button>
        <button className="card-action-btn card-action-danger" onClick={onDelete} aria-label={`Delete ${card.name}`}>
          Delete
        </button>
      </div>
    </div>
  );
}

// === ISSUE #15 END: Card Definitions List — CardDefinitionRow ===