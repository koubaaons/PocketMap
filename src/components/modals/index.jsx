/**
 * @fileoverview Feature modals — Binder and Card forms.
 *
 * Each modal manages its own local form state (uncontrolled inputs
 * would make validation harder). Validated data is dispatched via
 * the store on submit. Errors are shown per-field.
 */

import { useState, useCallback } from 'react';
import { Modal, ModalActions, Button, Input, Select, ConfirmModal } from '../ui/index.jsx';
import { createBinder, createCard } from '../../types/index.js';
import { isSlotOccupied, availableSlots } from '../../utils/index.js';

// ─── Binder Modal ─────────────────────────────────────────────────────────────

/**
 * @param {{ onSubmit: (binder) => void, onClose: () => void }} props
 */
export function CreateBinderModal({ onSubmit, onClose }) {
  const [fields, setFields] = useState({ name: '', cols: 3, rows: 3, pages: 20 });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  const handleSubmit = useCallback(() => {
    const { binder, errors: errs } = createBinder(fields);
    if (!binder) {
      // Map errors to fields
      const fieldErrors = {};
      errs.forEach(e => {
        if (e.includes('name')) fieldErrors.name = 'Required';
        if (e.includes('cols')) fieldErrors.cols = '1–10';
        if (e.includes('rows')) fieldErrors.rows = '1–10';
        if (e.includes('pages')) fieldErrors.pages = '1–500';
      });
      setErrors(fieldErrors);
      return;
    }
    onSubmit(binder);
  }, [fields, onSubmit]);

  return (
    <Modal title="Create New Binder" onClose={onClose}>
      <Input
        id="binder-name"
        label="Binder Name *"
        placeholder="e.g. Winx Club Main Collection"
        value={fields.name}
        onChange={e => set('name', e.target.value)}
        error={errors.name}
        autoFocus
      />
      <div className="form-row">
        <Input id="binder-cols" label="Columns" type="number" min={1} max={10}
          value={fields.cols} onChange={e => set('cols', +e.target.value)} error={errors.cols} />
        <Input id="binder-rows" label="Rows" type="number" min={1} max={10}
          value={fields.rows} onChange={e => set('rows', +e.target.value)} error={errors.rows} />
      </div>
      <Input id="binder-pages" label="Number of Pages" type="number" min={1} max={500}
        value={fields.pages} onChange={e => set('pages', +e.target.value)} error={errors.pages} />
      <p className="capacity-hint">
        Total capacity: <strong>{Number.isFinite(capacity) ? capacity.toLocaleString() : '—'} cards</strong>
      </p>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Create Binder</Button>
      </ModalActions>
    </Modal>
  );
}

// ─── Card Modal ───────────────────────────────────────────────────────────────

/**
 * @param {{ binder, cards, initialPage?, initialSlot?, onSubmit, onClose }} props
 */
export function AddCardModal({ binder, cards, initialPage = 1, initialSlot = null, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name: '', character: '', series: '',
    page: initialPage,
    slot: initialSlot ?? (availableSlots(cards, binder, initialPage)[0] ?? 1),
    favorite: false,
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const pageOptions = Array.from({ length: binder.pages }, (_, i) => ({
    value: i + 1, label: `Page ${i + 1}`,
  }));

  const totalSlots = binder.rows * binder.cols;
  const slotOptions = Array.from({ length: totalSlots }, (_, i) => {
    const slot = i + 1;
    const taken = isSlotOccupied(cards, binder.id, fields.page, slot);
    return { value: slot, label: `Slot ${slot}${taken ? ' (taken)' : ''}`, disabled: taken };
  });

  const handlePageChange = (page) => {
    const free = availableSlots(cards, binder, page);
    set('page', page);
    if (!free.includes(fields.slot)) {
      setFields(f => ({ ...f, page, slot: free[0] ?? 1 }));
    } else {
      set('page', page);
    }
  };

  const handleSubmit = useCallback(() => {
    if (isSlotOccupied(cards, binder.id, fields.page, fields.slot)) {
      setErrors({ slot: 'This slot is already taken' });
      return;
    }
    const { card, errors: errs } = createCard({ ...fields, binderId: binder.id });
    if (!card) {
      const fieldErrors = {};
      errs.forEach(e => {
        if (e.includes('name')) fieldErrors.name = 'Required';
      });
      setErrors(fieldErrors);
      return;
    }
    onSubmit(card);
  }, [fields, cards, binder, onSubmit]);

  return (
    <Modal title={`Add Card to "${binder.name}"`} onClose={onClose}>
      <Input id="card-name" label="Card Name *" placeholder="e.g. Bloom Enchantix"
        value={fields.name} onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <Input id="card-char" label="Character" placeholder="e.g. Bloom"
          value={fields.character} onChange={e => set('character', e.target.value)} />
        <Input id="card-series" label="Series" placeholder="e.g. Winx Club"
          value={fields.series} onChange={e => set('series', e.target.value)} />
      </div>
      <div className="form-row">
        <Select id="card-page" label="Page" options={pageOptions}
          value={fields.page} onChange={e => handlePageChange(+e.target.value)} />
        <Select id="card-slot" label="Slot" options={slotOptions}
          value={fields.slot} onChange={e => set('slot', +e.target.value)} error={errors.slot} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={fields.favorite}
          onChange={e => set('favorite', e.target.checked)} />
        Mark as Favorite
      </label>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Add Card</Button>
      </ModalActions>
    </Modal>
  );
}

// ─── Edit Card Modal ──────────────────────────────────────────────────────────

/**
 * @param {{ card, onSubmit, onClose }} props
 */
export function EditCardModal({ card, onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name: card.name,
    character: card.character ?? '',
    series: card.series ?? '',
    favorite: card.favorite,
  });
  const [errors, setErrors] = useState({});
  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    const name = fields.name.trim();
    if (!name) { setErrors({ name: 'Required' }); return; }
    onSubmit({ ...card, ...fields, name });
  };

  return (
    <Modal title="Edit Card" onClose={onClose}>
      <Input id="edit-name" label="Card Name *" value={fields.name}
        onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
      <div className="form-row">
        <Input id="edit-char" label="Character" value={fields.character}
          onChange={e => set('character', e.target.value)} />
        <Input id="edit-series" label="Series" value={fields.series}
          onChange={e => set('series', e.target.value)} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={fields.favorite}
          onChange={e => set('favorite', e.target.checked)} />
        Mark as Favorite
      </label>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
      </ModalActions>
    </Modal>
  );
}

// ─── Card Detail Modal ────────────────────────────────────────────────────────

/**
 * @param {{ card, binderName, onEdit, onDelete, onToggleFavorite, onClose }} props
 */
export function CardDetailModal({ card, binderName, onEdit, onDelete, onToggleFavorite, onClose }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <ConfirmModal
        title="Delete Card?"
        message={`Move "${card.name}" to the trash? You can restore it later.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    );
  }

  return (
    <Modal title={card.name} onClose={onClose}>
      <div className="card-detail-grid">
        {card.character && (
          <div className="detail-field">
            <span className="detail-label">Character</span>
            <span className="detail-value">{card.character}</span>
          </div>
        )}
        {card.series && (
          <div className="detail-field">
            <span className="detail-label">Series</span>
            <span className="detail-value detail-series">{card.series}</span>
          </div>
        )}
        <div className="detail-field">
          <span className="detail-label">Binder</span>
          <span className="detail-value">{binderName}</span>
        </div>
        <div className="detail-field">
          <span className="detail-label">Location</span>
          <span className="detail-value">Page {card.page} · Slot {card.slot}</span>
        </div>
      </div>
      {card.favorite && <div className="fav-badge">★ Favorite</div>}
      <hr className="modal-divider" />
      <div className="card-detail-actions">
        <Button variant="ghost" size="sm" onClick={onToggleFavorite}>
          {card.favorite ? '☆ Unfavorite' : '★ Favorite'}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Delete</Button>
        </div>
      </div>
    </Modal>
  );
}