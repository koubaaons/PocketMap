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
import { createBinder, DEFAULT_BINDER_COLOR, MAX_BINDER_COLS, MAX_BINDER_ROWS, MAX_BINDER_PAGES } from '../../types/index.js';

const GRID_OPTIONS = Array.from({ length: MAX_BINDER_COLS }, (_, i) => i + 1);
const PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 36, 40, 50, 75, 100].filter(n => n <= MAX_BINDER_PAGES);

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
        if (e.includes('cols'))  fieldErrors.cols  = `1–${MAX_BINDER_COLS}`;
        if (e.includes('rows'))  fieldErrors.rows  = `1–${MAX_BINDER_ROWS}`;
        if (e.includes('pages')) fieldErrors.pages = `1–${MAX_BINDER_PAGES}`;
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

/**
 * @fileoverview SwapPagesModal — exchanges everything on one page
 * with everything on another, within the same binder. Requested
 * directly by a user citing other card-tracking sites that already
 * offer this.
 */
export function SwapPagesModal({ binder, onSubmit, onClose }) {
  const [pageA, setPageA] = useState('');
  const [pageB, setPageB] = useState('');
  const [error, setError] = useState('');

  const parsedA = parseInt(pageA, 10);
  const parsedB = parseInt(pageB, 10);

  const validate = () => {
    if (!pageA || !pageB) return 'Enter both page numbers';
    if (!Number.isInteger(parsedA) || !Number.isInteger(parsedB)) return 'Enter valid page numbers';
    if (parsedA < 1 || parsedA > binder.pages || parsedB < 1 || parsedB > binder.pages) {
      return `Pages must be between 1 and ${binder.pages}`;
    }
    if (parsedA === parsedB) return 'Choose two different pages';
    return '';
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    onSubmit(parsedA, parsedB);
    onClose();
  };

  return (
    <Modal title="Swap Pages" onClose={onClose} size="sm">
      <p className="modal-step-note">
        Exchange everything on one page with everything on another — every
        card keeps its same row/column position, just on the other page.
      </p>

      <div className="form-row">
        <Input
          id="swap-page-a"
          label="Page"
          type="number"
          min={1}
          max={binder.pages}
          placeholder="e.g. 3"
          value={pageA}
          onChange={e => setPageA(e.target.value)}
          autoFocus
        />
        <Input
          id="swap-page-b"
          label="Swap with page"
          type="number"
          min={1}
          max={binder.pages}
          placeholder="e.g. 7"
          value={pageB}
          onChange={e => setPageB(e.target.value)}
        />
      </div>
      {error && <span className="field-error-msg">{error}</span>}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Swap Pages</Button>
      </ModalActions>
    </Modal>
  );
}