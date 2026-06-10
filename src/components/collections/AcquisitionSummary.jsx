/**
 * @fileoverview AcquisitionSummary — read-only display of acquisition details.
 *
 * Extracted from CardDetailModal so it can be reused in:
 *   - CardDetailModal (current)
 *   - Owned tab card rows (Milestone 6)
 *   - Any future view that shows owned card details
 */

// === REFACTOR5b START: Extract AcquisitionSummary component ===

import { formatConditionRating } from '../../types/index.js';

/**
 * @param {{ inventoryItem: object }} props
 */
export function AcquisitionSummary({ inventoryItem }) {
  const hasAnyDetail =
    inventoryItem.condition_rating ||
    inventoryItem.acquired_at ||
    inventoryItem.personal_notes ||
    inventoryItem.is_tradeable ||
    inventoryItem.is_sellable;

  if (!hasAnyDetail) return null;

  return (
    <div className="acquisition-summary">
      {inventoryItem.condition_rating && (
        <div className="detail-field">
          <span className="detail-label">Condition</span>
          <span className="detail-value">
            {formatConditionRating(inventoryItem.condition_rating)}
          </span>
        </div>
      )}

      {inventoryItem.acquired_at && (
        <div className="detail-field">
          <span className="detail-label">Acquired</span>
          <span className="detail-value">
            {new Date(inventoryItem.acquired_at).toLocaleDateString()}
          </span>
        </div>
      )}

      {inventoryItem.personal_notes && (
        <div className="detail-field">
          <span className="detail-label">Notes</span>
          <span className="detail-value">{inventoryItem.personal_notes}</span>
        </div>
      )}

      {(inventoryItem.is_tradeable || inventoryItem.is_sellable) && (
        <div className="detail-field">
          <span className="detail-label">Available</span>
          <span className="detail-value">
            {[
              inventoryItem.is_tradeable && 'Trade',
              inventoryItem.is_sellable && 'Sale',
            ].filter(Boolean).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// === REFACTOR5b END ===