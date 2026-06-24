/**
 * @fileoverview CardDefinitionForm — dynamic form driven by template fields.
 * === ISSUE #80: image upload, preview, and persistence ===
 * === ISSUE #88: replaced FileReader with compressImage — size warning removed,
 *     compression handles it automatically ===
 */

import { useState, useRef } from 'react';
import { Button, Modal, ModalActions } from '../ui/index.jsx';
import { useCardDefinitionForm } from '../../hooks/useCardDefinitionForm.js';
import { compressImage } from '../../utils/index.js';
import { HOLO_TYPES } from '../../types/index.js';
import { useCardHoloPointer } from '../../hooks/useCardHoloPointer.js';

const HOLO_LABELS = {
  // === LABEL NOTE: the stored value is still 'none' (unchanged, for
  // backward compatibility with existing data), but it's no longer a
  // no-op — it's Regular Holo, the default look every card gets.
  // Labeling the button "None" would be confusing UI for something
  // that visibly applies an effect, so it's shown as "Regular" instead
  // — only the user-facing label changed, not the underlying value. ===
  off: 'Off',
  none: 'Regular',
  holo: 'Holo',
  galaxy: 'Galaxy',
  rainbow: 'Rainbow',
  gold: 'Gold',
  v: 'V',
  vstar: 'VStar',
};

export function CardDefinitionForm({ collection, templateFields, initialCard, mode = 'create', onSubmit, onClose }) {
  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === collection.id)
    .sort((a, b) => a.order - b.order);

  const { values, errors, set, handleSubmit } = useCardDefinitionForm({
    collection,
    sortedFields,
    initialCard,
    mode,
    onSubmit,
  });

  // === ISSUE #80: image preview syncs from values.image_url ===
  // === ISSUE #88: isCompressing replaces imageSizeWarning — compression
  //     happens automatically, no size warning needed anymore ===
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      set('image_url', compressed);
    } catch (err) {
      console.error('Image compression failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    set('image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // === HOLO: live preview, driven directly by values.holoType as the
  // user clicks different picker buttons — no save needed to see it.
  // Reuses .card-detail-image-wrapper's [data-holo] CSS rules (same
  // selector card-holo.css already targets for the real detail modal)
  // rather than inventing a third, parallel selector set just for
  // this form's preview. Only 'off' disables the live preview now —
  // 'none' is Regular Holo, the active default. ===
  const holoType = values.holoType ?? 'none';
  const activeHolo = holoType !== 'off' ? holoType : null;
  const { holoRef, handlePointerMoveWithTilt, handlePointerLeaveWithTilt } = useCardHoloPointer();

  const title = mode === 'create' ? `Add Card to ${collection.name}` : 'Edit Card';

  return (
    <Modal title={title} onClose={onClose}>

      {/* Image upload */}
      <div className="form-group">
        <label>Card Image</label>
        <div className="image-upload-area">
          {values.image_url ? (
            <div
              ref={activeHolo ? holoRef : undefined}
              className="image-preview-wrapper card-rotate-wrapper"
              data-holo={activeHolo ?? undefined}
              onPointerMove={activeHolo ? handlePointerMoveWithTilt : undefined}
              onPointerLeave={activeHolo ? handlePointerLeaveWithTilt : undefined}
            >
              <div className="card-rotator">
                <img src={values.image_url} alt="Card preview" className="image-preview" />
                {activeHolo && (
                  <>
                    <span className="card-holo-shine" aria-hidden="true" />
                    <span className="card-holo-glare" aria-hidden="true" />
                  </>
                )}
              </div>
              <button className="image-remove-btn" onClick={handleRemoveImage} aria-label="Remove image">✕</button>
            </div>
          ) : (
            <button
              className="image-upload-placeholder"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              disabled={isCompressing}
            >
              <span className="image-upload-icon">🖼</span>
              <span className="image-upload-label">{isCompressing ? 'Compressing…' : 'Add card image'}</span>
              <span className="image-upload-hint">JPG, PNG, WebP</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            style={{ display: 'none' }}
            aria-label="Upload card image"
          />
        </div>
      </div>

      {/* Holographic effect */}
      <div className="form-group">
        <label>Holographic Effect</label>
        <HolographicPicker value={values.holoType} onChange={(v) => set('holoType', v)} />
      </div>

      {/* Card name */}
      <div className="form-group">
        <label htmlFor="card-def-name">Card Name *</label>
        <input
          id="card-def-name"
          className={`form-input ${errors.name ? 'input-error' : ''}`}
          placeholder="e.g. Bloom Believix"
          value={values.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
        {errors.name && <span className="field-error-msg">{errors.name}</span>}
      </div>

      {/* Dynamic fields */}
      {sortedFields.map(field => (
        <DynamicField
          key={field.id}
          field={field}
          value={values[field.field_name]}
          error={errors[field.field_name]}
          onChange={(val) => set(field.field_name, val)}
        />
      ))}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {mode === 'create' ? 'Add Card' : 'Save Changes'}
        </Button>
      </ModalActions>
    </Modal>
  );
}

function HolographicPicker({ value, onChange }) {
  const current = value ?? 'none';
  return (
    <div className="holo-picker" role="radiogroup" aria-label="Holographic effect">
      {HOLO_TYPES.map(type => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={current === type}
          className={`holo-swatch ${current === type ? 'holo-swatch-selected' : ''}`}
          onClick={() => onChange(type)}
        >
          {HOLO_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

function DynamicField({ field, value, error, onChange }) {
  const id = `field-${field.id}`;
  const label = field.field_name + (field.is_required ? ' *' : '');

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {field.field_type === 'text' && (
        <input id={id} className={`form-input ${error ? 'input-error' : ''}`}
          value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.field_name}`} />
      )}
      {field.field_type === 'number' && (
        <input id={id} type="number" className={`form-input ${error ? 'input-error' : ''}`}
          value={value ?? ''} onChange={e => onChange(e.target.value)}
          placeholder={`Enter ${field.field_name}`} />
      )}
      {field.field_type === 'boolean' && (
        <label className="checkbox-label">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
          Yes
        </label>
      )}
      {field.field_type === 'select' && (
        <select id={id} className={`form-input ${error ? 'input-error' : ''}`}
          value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select {field.field_name}…</option>
          {(field.options ?? []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}