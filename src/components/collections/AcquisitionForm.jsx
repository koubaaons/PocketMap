/**
 * @fileoverview AcquisitionForm — edit acquisition details for an owned card.
 *
 * Shown inside CardDetailModal when a card is owned.
 * Fields: condition_rating, acquired_at, personal_notes, is_tradeable, is_sellable
 */

// === ISSUE #37 START: Acquisition Information — AcquisitionForm ===

import { useState } from 'react';
import { Button, Modal, ModalActions } from '../ui/index.jsx';
import { CONDITION_RATINGS } from '../../types/index.js';

const CONDITION_LABELS = {
  mint:       'Mint',
  near_mint:  'Near Mint',
  excellent:  'Excellent',
  good:       'Good',
  played:     'Played',
  poor:       'Poor',
};

/**
 * @param {{
 *   inventoryItem: object,
 *   cardName: string,
 *   onSubmit: (updatedItem) => void,
 *   onClose: () => void,
 * }} props
 */
export function AcquisitionForm({ inventoryItem, cardName, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    condition_rating: inventoryItem.condition_rating ?? '',
    personal_notes:   inventoryItem.personal_notes ?? '',
    is_tradeable:     inventoryItem.is_tradeable ?? false,
    is_sellable:      inventoryItem.is_sellable ?? false,
    acquired_at:      inventoryItem.acquired_at
      ? new Date(inventoryItem.acquired_at).toISOString().split('T')[0]
      : '',
  });

  const set = (key, val) => setFields(prev => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    onSubmit({
      ...inventoryItem,
      condition_rating: fields.condition_rating || null,
      personal_notes:   fields.personal_notes.trim() || null,
      is_tradeable:     fields.is_tradeable,
      is_sellable:      fields.is_sellable,
      acquired_at:      fields.acquired_at
        ? new Date(fields.acquired_at).getTime()
        : null,
      updatedAt: Date.now(),
    });
  };

  return (
    <Modal title={`Details — ${cardName}`} onClose={onClose}>

      {/* Condition */}
      <div className="form-group">
        <label htmlFor="acq-condition">Condition</label>
        <select
          id="acq-condition"
          className="form-input"
          value={fields.condition_rating}
          onChange={e => set('condition_rating', e.target.value)}
        >
          <option value="">Not graded</option>
          {CONDITION_RATINGS.map(r => (
            <option key={r} value={r}>{CONDITION_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {/* Acquired date */}
      <div className="form-group">
        <label htmlFor="acq-date">Date Acquired</label>
        <input
          id="acq-date"
          type="date"
          className="form-input"
          value={fields.acquired_at}
          onChange={e => set('acquired_at', e.target.value)}
        />
      </div>

      {/* Personal notes */}
      <div className="form-group">
        <label htmlFor="acq-notes">Personal Notes</label>
        <textarea
          id="acq-notes"
          className="form-input"
          rows={3}
          placeholder="Any notes about this card…"
          value={fields.personal_notes}
          onChange={e => set('personal_notes', e.target.value)}
        />
      </div>

      {/* Tradeable / Sellable toggles */}
      <div className="form-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={fields.is_tradeable}
            onChange={e => set('is_tradeable', e.target.checked)} />
          Available for trade
        </label>
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={fields.is_sellable}
            onChange={e => set('is_sellable', e.target.checked)} />
          Available for sale
        </label>
      </div>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Details</Button>
      </ModalActions>
    </Modal>
  );
}

// === ISSUE #37 END: Acquisition Information ===