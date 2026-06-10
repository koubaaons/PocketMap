/**
 * @fileoverview AcquisitionForm — edit acquisition details for an owned card.
 */

// === ISSUE #37 START: Acquisition Information — AcquisitionForm ===

import { useState } from 'react';
import { Button, Modal, ModalActions } from '../ui/index.jsx';

// === REFACTOR5c START: import CONDITION_LABELS from types ===
import { CONDITION_RATINGS, CONDITION_LABELS } from '../../types/index.js';
// === REFACTOR5c END ===

export function AcquisitionForm({ inventoryItem, cardName, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    condition_rating: inventoryItem.condition_rating ?? '',
    personal_notes:   inventoryItem.personal_notes ?? '',
    is_tradeable:     inventoryItem.is_tradeable ?? false,
    is_sellable:      inventoryItem.is_sellable ?? false,
    // === REFACTOR5f START: safe date initialisation ===
    acquired_at: (() => {
      if (!inventoryItem.acquired_at) return '';
      const d = new Date(inventoryItem.acquired_at);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    })(),
    // === REFACTOR5f END ===
  });

  const set = (key, val) => setFields(prev => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    // === REFACTOR5f START: safe date conversion ===
    let acquired_at = null;
    if (fields.acquired_at) {
      const parsed = new Date(fields.acquired_at).getTime();
      acquired_at = isNaN(parsed) ? null : parsed;
    }
    // === REFACTOR5f END ===

    onSubmit({
      ...inventoryItem,
      condition_rating: fields.condition_rating || null,
      personal_notes:   fields.personal_notes.trim() || null,
      is_tradeable:     fields.is_tradeable,
      is_sellable:      fields.is_sellable,
      acquired_at,
      updatedAt: Date.now(),
    });
  };

  return (
    <Modal title={`Details — ${cardName}`} onClose={onClose}>

      <div className="form-group">
        <label htmlFor="acq-condition">Condition</label>
        <select id="acq-condition" className="form-input"
          value={fields.condition_rating}
          onChange={e => set('condition_rating', e.target.value)}>
          <option value="">Not graded</option>
          {CONDITION_RATINGS.map(r => (
            <option key={r} value={r}>{CONDITION_LABELS[r]}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="acq-date">Date Acquired</label>
        <input id="acq-date" type="date" className="form-input"
          value={fields.acquired_at}
          onChange={e => set('acquired_at', e.target.value)} />
      </div>

      <div className="form-group">
        <label htmlFor="acq-notes">Personal Notes</label>
        <textarea id="acq-notes" className="form-input" rows={3}
          placeholder="Any notes about this card…"
          value={fields.personal_notes}
          onChange={e => set('personal_notes', e.target.value)} />
      </div>

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
