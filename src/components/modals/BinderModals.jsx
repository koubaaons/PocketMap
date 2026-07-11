/**
 * @fileoverview Binder modals.
 * === ISSUE #81: color picker, dropdown inputs ===
 * === ISSUE #82: page color toggle (dark/light) ===
 *
 * === Two-step creation flow ===
 * Step 1 — Configure: name, grid, colour, page colour
 * Step 2 — Customise: add stickers to the cover, then create
 * Sticker state is managed locally here since the binder doesn't
 * exist yet and can't be dispatched to. Stickers are passed to
 * onSubmit alongside the other fields.
 */

import { useState, useCallback, useRef } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createBinder, createSticker, BINDER_COLORS, DEFAULT_BINDER_COLOR } from '../../types/index.js';
import { CustomizerSticker } from './CustomizerSticker.jsx';
import { compressStickerImage } from '../../utils/index.js';

const GRID_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
const MAX_STICKERS = 10;
const STICKER_MAX_WIDTH = 400;

export function CreateBinderModal({ onSubmit, onClose }) {
  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1 = configure, 2 = customise

  // ── Step 1 fields ─────────────────────────────────────────────────────────
  const [fields, setFields] = useState({
    name:        '',
    cols:        3,
    rows:        3,
    pages:       20,
    cover_color: DEFAULT_BINDER_COLOR,
    page_color:  'dark',
  });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setFields(f => ({ ...f, [key]: val }));
  const capacity = fields.rows * fields.cols * fields.pages || 0;

  // ── Step 2 sticker state ──────────────────────────────────────────────────
  const [draftStickers, setDraftStickers]           = useState([]);
  const [selectedStickerId, setSelectedStickerId]   = useState(null);
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [stickerUploadError, setStickerUploadError] = useState('');
  const coverRef            = useRef(null);
  const stickerFileInputRef = useRef(null);
  const isUploadingStickerRef = useRef(false);

  // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
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
    setStep(2);
  }, [fields]);

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const { binder } = createBinder({ ...fields, stickers: draftStickers });
    if (binder) onSubmit(binder);
  }, [fields, draftStickers, onSubmit]);

  // ── Sticker handlers ──────────────────────────────────────────────────────
  const handleAddStickerClick = () => {
    if (draftStickers.length >= MAX_STICKERS) {
      setStickerUploadError(`Maximum ${MAX_STICKERS} stickers per cover.`);
      return;
    }
    stickerFileInputRef.current?.click();
  };

  const handleStickerFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isUploadingStickerRef.current) return;
    isUploadingStickerRef.current = true;
    setIsUploadingSticker(true);
    setStickerUploadError('');
    try {
      const image_url = await compressStickerImage(file, STICKER_MAX_WIDTH);
      const offsetX = 50 + (Math.random() * 20 - 10);
      const offsetY = 50 + (Math.random() * 20 - 10);
      const { sticker, errors: sErrs } = createSticker({ image_url, x: offsetX, y: offsetY, rotation: 0 });
      if (!sticker) { setStickerUploadError('Could not add that image — ' + sErrs.join(', ')); return; }
      setDraftStickers(prev => [...prev, sticker]);
      setSelectedStickerId(sticker.id);
    } catch {
      setStickerUploadError('Could not read that image. Try a different file.');
    } finally {
      setIsUploadingSticker(false);
      isUploadingStickerRef.current = false;
    }
  };

  const handleChangeDraftSticker = useCallback((id, patch) => {
    setDraftStickers(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const handleRemoveDraftSticker = (id) => {
    setDraftStickers(prev => prev.filter(s => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Modal
        title="Customise Your Binder"
        onClose={onClose}
      >
        <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Add stickers to your cover — or skip straight to creating. You can always customise the cover later.
        </p>

        {/* Live cover preview */}
        <div
          ref={coverRef}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedStickerId(null); }}
          style={{
            position:        'relative',
            width:           '100%',
            aspectRatio:     '3 / 4',
            maxHeight:       '280px',
            maxWidth:        '210px',
            margin:          '0 auto var(--space-5)',
            borderRadius:    'var(--radius-lg)',
            backgroundColor: fields.cover_color,
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
            overflow:        'hidden',
            boxShadow:       '0 4px 24px rgba(0,0,0,0.18)',
            cursor:          'default',
          }}
        >
          {/* Stickers */}
          {draftStickers.map(sticker => (
            <CustomizerSticker
              key={sticker.id}
              sticker={sticker}
              containerRef={coverRef}
              editable
              isSelected={selectedStickerId === sticker.id}
              onSelect={() => setSelectedStickerId(sticker.id)}
              onChange={(patch) => handleChangeDraftSticker(sticker.id, patch)}
              onRemove={() => handleRemoveDraftSticker(sticker.id)}
            />
          ))}
        </div>

        {/* Binder name and meta below the preview */}
        <div className="binder-cover-label" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="binder-cover-label-name">{fields.name || 'Untitled'}</div>
          <div className="binder-cover-label-meta">{fields.pages} pages · {fields.rows}×{fields.cols}</div>
        </div>

        {/* Sticker controls */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddStickerClick}
            disabled={isUploadingSticker || draftStickers.length >= MAX_STICKERS}
          >
            {isUploadingSticker ? 'Uploading…' : '+ Add Sticker'}
          </Button>
          {selectedStickerId && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleRemoveDraftSticker(selectedStickerId)}
            >
              Remove Selected
            </Button>
          )}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {draftStickers.length}/{MAX_STICKERS} stickers
          </span>
        </div>

        {stickerUploadError && (
          <p style={{ color: 'var(--color-error, #e05252)', fontSize: 'var(--text-xs)', margin: '0 0 var(--space-3)' }}>
            {stickerUploadError}
          </p>
        )}

        <input
          ref={stickerFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleStickerFileSelected}
        />

        <ModalActions>
          <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            style={{ background: fields.cover_color, borderColor: fields.cover_color }}
          >
            Create Binder
          </Button>
        </ModalActions>
      </Modal>
    );
  }

  // Step 1 — Configure
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
              type="button"
            />
          ))}
        </div>
      </div>

      {/* === ISSUE #82: page color toggle === */}
      <div className="form-group">
        <label>Page Color</label>
        <div className="page-color-toggle">
          <button
            type="button"
            className={`page-color-option ${fields.page_color === 'dark' ? 'page-color-active' : ''}`}
            onClick={() => set('page_color', 'dark')}
          >
            <span className="page-color-preview page-color-preview-dark" />
            Dark
          </button>
          <button
            type="button"
            className={`page-color-option ${fields.page_color === 'light' ? 'page-color-active' : ''}`}
            onClick={() => set('page_color', 'light')}
          >
            <span className="page-color-preview page-color-preview-light" />
            Light
          </button>
        </div>
      </div>

      <p className="capacity-hint">
        Total capacity:{' '}
        <strong>{Number.isFinite(capacity) ? capacity.toLocaleString() : '—'} cards</strong>
      </p>

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleNext}
          style={{ background: fields.cover_color, borderColor: fields.cover_color }}
        >
          Next →
        </Button>
      </ModalActions>
    </Modal>
  );
}