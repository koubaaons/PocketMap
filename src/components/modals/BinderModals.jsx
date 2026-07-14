/**
 * @fileoverview Binder modals.
 * === ISSUE #81: color picker, dropdown inputs ===
 * === ISSUE #82: page color toggle (dark/light) — now fully custom,
 *     see binder.types.js/BinderBookFlip.jsx/colorUtils.js ===
 *
 * === Create flow simplified back to a single step (per user
 * request) === Color and sticker customization briefly lived here as
 * their own wizard steps, but were removed again — a binder is
 * created with sensible defaults (DEFAULT_BINDER_COLOR, the default
 * page color) and customized afterward via the existing Customize
 * panel (BinderCustomizePanel.jsx / useBinderCoverEditor.js), which
 * already does color + sticker editing on an already-created binder.
 * This avoids maintaining two separate places that both edit the
 * same fields with two separate UIs.
 */

import { useState, useCallback } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createBinder, DEFAULT_BINDER_COLOR } from '../../types/index.js';

const GRID_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];

export function CreateBinderModal({ onSubmit, onClose }) {
  const [fields, setFields] = useState({
    name:        '',
    cols:        3,
    rows:        3,
    pages:       20,
    cover_color: DEFAULT_BINDER_COLOR,
    page_color:  '#1e1e1e',
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  const handleSubmit = useCallback(() => {
    const { binder, errors: errs } = createBinder({ ...fields, stickers: [] });
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
    setErrors({});
    onSubmit(binder);
  }, [fields, onSubmit]);

  return (
    <Modal title="Create New Binder" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

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
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="binder-cols">Columns</label>
          <select id="binder-cols" className="form-input" value={fields.cols}
            onChange={e => set('cols', Number(e.target.value))}>
            {GRID_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.cols && <span className="field-error-msg">{errors.cols}</span>}
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="binder-rows">Rows</label>
          <select id="binder-rows" className="form-input" value={fields.rows}
            onChange={e => set('rows', Number(e.target.value))}>
            {GRID_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {errors.rows && <span className="field-error-msg">{errors.rows}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="binder-pages">Number of Pages</label>
        <select id="binder-pages" className="form-input" value={fields.pages}
          onChange={e => set('pages', Number(e.target.value))}>
          {PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} pages</option>)}
        </select>
        {errors.pages && <span className="field-error-msg">{errors.pages}</span>}
      </div>

      <p className="capacity-hint">
        Total capacity:{' '}
        <strong>{Number.isFinite(capacity) ? capacity.toLocaleString() : '—'} cards</strong>
      </p>

      <p className="modal-step-note">
        You can customize this binder's cover color, page color, and add a sticker
        after creating it — look for the "Customize" button on the closed cover.
      </p>

      </form>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          Create Binder
        </Button>
      </ModalActions>
    </Modal>
  );
}