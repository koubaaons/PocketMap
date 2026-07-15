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
 * @param {{ inventoryItem: object, compact?: boolean }} props
 */
export function AcquisitionSummary({ inventoryItem, compact = false }) {
  const hasAnyDetail =
    inventoryItem.condition_rating ||
    inventoryItem.acquired_at ||
    inventoryItem.personal_notes ||
    inventoryItem.is_tradeable ||
    inventoryItem.is_sellable;

  if (!hasAnyDetail) {
    return compact ? <span className="acquisition-summary-compact-empty">No details yet</span> : null;
  }

  // === Compact mode — a short one-line summary instead of the full
  // field-by-field layout below, used when showing multiple copies of
  // the same card in a list (CardDetailModal's per-copy rows), where
  // the full layout per copy would take up too much space. ===
  if (compact) {
    const parts = [
      inventoryItem.condition_rating && formatConditionRating(inventoryItem.condition_rating),
      inventoryItem.acquired_at && new Date(inventoryItem.acquired_at).toLocaleDateString(),
    ].filter(Boolean);
    return <span className="acquisition-summary-compact">{parts.join(' · ') || 'No details yet'}</span>;
  }

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