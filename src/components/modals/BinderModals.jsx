/**
 * @fileoverview Binder modals.
 * === ISSUE #81: color picker, dropdown inputs ===
 */

import { useState, useCallback } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createBinder, BINDER_COLORS, DEFAULT_BINDER_COLOR } from '../../types/index.js';

// Dropdown options for rows and columns
const GRID_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];

export function CreateBinderModal({ onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name:        '',
    cols:        3,
    rows:        3,
    pages:       20,
    // === ISSUE #81: default color ===
    cover_color: DEFAULT_BINDER_COLOR,
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  const handleSubmit = useCallback(() => {
    const { binder, errors: errs } = createBinder(fields);
    if (!binder) {
      const fieldErrors = {};
      errs.forEach(e => {
        if (e.includes('name'))  fieldErrors.name  = 'Required';
        if (e.includes('cols'))  fieldErrors.cols  = '1–10';
        if (e.includes('rows'))  fieldErrors.rows  = '1–10';
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

      {/* === ISSUE #81: rows and columns as dropdowns === */}
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="binder-cols">Columns</label>
          <select
            id="binder-cols"
            className="form-input"
            value={fields.cols}
            onChange={e => set('cols', Number(e.target.value))}
          >
            {GRID_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {errors.cols && <span className="field-error-msg">{errors.cols}</span>}
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="binder-rows">Rows</label>
          <select
            id="binder-rows"
            className="form-input"
            value={fields.rows}
            onChange={e => set('rows', Number(e.target.value))}
          >
            {GRID_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {errors.rows && <span className="field-error-msg">{errors.rows}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="binder-pages">Number of Pages</label>
        <select
          id="binder-pages"
          className="form-input"
          value={fields.pages}
          onChange={e => set('pages', Number(e.target.value))}
        >
          {PAGE_OPTIONS.map(n => (
            <option key={n} value={n}>{n} pages</option>
          ))}
        </select>
        {errors.pages && <span className="field-error-msg">{errors.pages}</span>}
      </div>

      {/* === ISSUE #81: color picker === */}
      <div className="form-group">
        <label>Binder Color</label>
        <div className="color-picker">
          {BINDER_COLORS.map(color => (
            <button
              key={color}
              className={`color-swatch ${fields.cover_color === color ? 'color-swatch-active' : ''}`}
              style={{ background: color }}
              onClick={() => set('cover_color', color)}
              aria-label={`Select color ${color}`}
              title={color}
              type="button"
            />
          ))}
        </div>
      </div>

      <p className="capacity-hint">
        Total capacity:{' '}
        <strong>{Number.isFinite(capacity) ? capacity.toLocaleString() : '—'} cards</strong>
      </p>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} style={{ background: fields.cover_color, borderColor: fields.cover_color }}>
          Create Binder
        </Button>
      </ModalActions>
    </Modal>
  );
}