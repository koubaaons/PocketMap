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

  const title = mode === 'create' ? `Add Card to ${collection.name}` : 'Edit Card';

  return (
    <Modal title={title} onClose={onClose}>

      {/* Image upload */}
      <div className="form-group">
        <label>Card Image</label>
        <div className="image-upload-area">
          {values.image_url ? (
            <div className="image-preview-wrapper">
              <img src={values.image_url} alt="Card preview" className="image-preview" />
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