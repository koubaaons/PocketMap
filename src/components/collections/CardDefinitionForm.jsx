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

import { Button, Modal, ModalActions } from '../ui/index.jsx';

// === REFACTOR4b START: use useCardDefinitionForm hook ===
import { useCardDefinitionForm } from '../../hooks/useCardDefinitionForm.js';
// === REFACTOR4b END ===

export function CardDefinitionForm({ collection, templateFields, initialCard, mode = 'create', onSubmit, onClose }) {
  const sortedFields = [...templateFields]
    .filter(f => f.collectionId === collection.id)
    .sort((a, b) => a.order - b.order);

  // === REFACTOR4b START: form logic in hook, component only renders ===
  const { values, errors, set, handleSubmit } = useCardDefinitionForm({
    collection,
    sortedFields,
    initialCard,
    mode,
    onSubmit,
  });
  // === REFACTOR4b END ===

  const title = mode === 'create'
    ? `Add Card to ${collection.name}`
    : 'Edit Card';

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
