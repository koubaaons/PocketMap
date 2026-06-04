/**
 * @fileoverview Binder modals.
 * Responsibility: create and manage binders only.
 */

import { useState, useCallback } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createBinder } from '../../types/index.js';

export function CreateBinderModal({ onSubmit, onClose }) {
  const [fields, setFields] = useState({ name: '', cols: 3, rows: 3, pages: 20 });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  const handleSubmit = useCallback(() => {
    const { binder, errors: errs } = createBinder(fields);
    if (!binder) {
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
      <Input id="binder-name" label="Binder Name *" placeholder="e.g. Winx Club Main Collection"
        value={fields.name} onChange={e => set('name', e.target.value)} error={errors.name} autoFocus />
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