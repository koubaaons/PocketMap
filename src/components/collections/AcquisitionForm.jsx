/**
 * @fileoverview AcquisitionForm — edit acquisition details for an owned card.
 * === ISSUE #37 START: Acquisition Information — AcquisitionForm ===
 *
 * AcquisitionFields is exported separately so CardDetailModal.jsx can
 * render the same fields inline (as a sub-page of its details panel)
 * instead of this whole thing opening as a separate modal — state
 * management itself lives in useAcquisitionForm.js, shared by both.
 */

import { Button, Modal, ModalActions } from '../ui/index.jsx';
import { CONDITION_RATINGS, CONDITION_LABELS, LANGUAGE_OPTIONS, LANGUAGE_LABELS } from '../../types/index.js';
import { useAcquisitionForm } from '../../hooks/useAcquisitionForm.js';

export function AcquisitionFields({ fields, set }) {
  return (
    <>
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
        <label htmlFor="acq-language">Language</label>
        <select id="acq-language" className="form-input"
          value={fields.language}
          onChange={e => set('language', e.target.value)}>
          <option value="">Not set</option>
          {LANGUAGE_OPTIONS.map(l => (
            <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
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
    </>
  );
}

// Kept as a standalone modal too — not currently used anywhere
// (CardDetailModal is the only caller, and it now uses
// AcquisitionFields + useAcquisitionForm inline instead), but left
// intact rather than deleted in case a future standalone use case
// needs it.
export function AcquisitionForm({ inventoryItem, cardName, onSubmit, onClose }) {
  const { fields, set, handleSubmit } = useAcquisitionForm({ inventoryItem, onSubmit });

  return (
    <Modal title={`Details — ${cardName}`} onClose={onClose}>
      <AcquisitionFields fields={fields} set={set} />
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Details</Button>
      </ModalActions>
    </Modal>
  );
}