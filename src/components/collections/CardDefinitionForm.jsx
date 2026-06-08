/**
 * @fileoverview CardDefinitionForm — dynamic form driven by template fields.
 *
 * Renders one input per template field based on field_type.
 * Used for both create and edit — mode prop switches behavior.
 *
 * field_type → input:
 *   text    → <input type="text">
 *   number  → <input type="number">
 *   boolean → <input type="checkbox">
 *   select  → <select> using field.options
 */

// === ISSUE #14 START: Card Definition Form ===

import { useState } from 'react';
import { Button, Modal, ModalActions } from '../ui/index.jsx';
import { createCardDefinition } from '../../types/index.js';

/**
 * @param {{
 *   collection: object,
 *   templateFields: object[],
 *   initialCard?: object,        — provided in edit mode
 *   mode: 'create' | 'edit',
 *   onSubmit: (cardDef) => void,
 *   onClose: () => void,
 * }} props
 */
export function CardDefinitionForm({ collection, templateFields, initialCard, mode = 'create', onSubmit, onClose }) {
  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === collection.id)
    .sort((a, b) => a.order - b.order);

  // Build initial form values
  const buildInitialValues = () => {
    const values = { name: '' };
    sortedFields.forEach(f => {
      const existing = initialCard?.attributes?.[f.field_name];
      if (existing !== undefined) {
        values[f.field_name] = existing;
      } else {
        // Sensible defaults per type
        switch (f.field_type) {
          case 'boolean': values[f.field_name] = false; break;
          case 'number':  values[f.field_name] = ''; break;
          default:        values[f.field_name] = '';
        }
      }
    });
    return values;
  };

  const [values, setValues] = useState(buildInitialValues);
  const [errors, setErrors] = useState({});

  const set = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // === ISSUE #14: Validation — required field enforcement ===
  const validate = () => {
    const newErrors = {};
    if (!values.name.trim()) newErrors.name = 'Card name is required';
    sortedFields.forEach(f => {
      if (!f.is_required) return;
      const val = values[f.field_name];
      if (val === undefined || val === null || String(val).trim() === '') {
        newErrors[f.field_name] = `${f.field_name} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    // Build attributes from dynamic fields
    const attributes = {};
    sortedFields.forEach(f => {
      attributes[f.field_name] = values[f.field_name];
    });

    if (mode === 'create') {
      const { cardDef, errors: createErrors } = createCardDefinition({
        collectionId: collection.id,
        name: values.name.trim(),
        attributes,
      });
      if (!cardDef) { console.error('Card creation failed:', createErrors); return; }
      onSubmit(cardDef);
    } else {
      // Edit mode — merge attributes onto existing card
      onSubmit({
        ...initialCard,
        name: values.name.trim(),
        attributes,
        updatedAt: Date.now(),
      });
    }
  };

  const title = mode === 'create'
    ? `Add Card to ${collection.name}`
    : `Edit Card`;

  return (
    <Modal title={title} onClose={onClose}>

      {/* Card name — always present regardless of template */}
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

      {/* === ISSUE #14: Dynamic fields from template === */}
      {sortedFields.map(field => (
        <DynamicField
          key={field.id}
          field={field}
          value={values[field.field_name]}
          error={errors[field.field_name]}
          onChange={(val) => set(field.field_name, val)}
        />
      ))}
      {/* === ISSUE #14 END === */}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          {mode === 'create' ? 'Add Card' : 'Save Changes'}
        </Button>
      </ModalActions>
    </Modal>
  );
}

// === ISSUE #14: DynamicField — renders the right input for each field_type ===
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
          <input id={id} type="checkbox"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)} />
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

// === ISSUE #14 END: Card Definition Form ===