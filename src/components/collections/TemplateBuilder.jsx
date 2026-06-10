/**
 * @fileoverview TemplateBuilder — reusable field builder component.
 */

// === ISSUE #10 START: Template Builder UI ===

import { useState } from 'react';

const FIELD_TYPES = [
  { value: 'text',    label: 'Text'     },
  { value: 'number',  label: 'Number'   },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select',  label: 'Dropdown' },
];

export function TemplateBuilder({ fields, errors = {}, onChange, onAdd, onReorder, onRemove, readOnly = false }) {
  const sorted = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div className="template-builder">
      {sorted.length === 0 && (
        <p className="template-builder-empty">No fields yet. Add your first field below.</p>
      )}
      <div className="template-fields-list">
        {sorted.map((field, idx) => (
          <TemplateBuilderRow
            key={field.id}
            field={field}
            error={errors[field.id]}
            isFirst={idx === 0}
            isLast={idx === sorted.length - 1}
            onChange={onChange}
            onReorder={onReorder}
            onRemove={onRemove}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <button className="template-add-field-btn" onClick={onAdd}>
          + Add Field
        </button>
      )}
    </div>
  );
}

function TemplateBuilderRow({ field, error, isFirst, isLast, onChange, onReorder, onRemove, readOnly }) {
  const isNew = field.id.startsWith('new-');

  return (
    <div className={`template-field-row ${error ? 'has-error' : ''}`}>

      {!readOnly && (
        <div className="field-reorder-btns">
          <button className="reorder-btn" onClick={() => onReorder(field.id, 'up')}
            disabled={isFirst} title="Move up" aria-label="Move field up">↑</button>
          <button className="reorder-btn" onClick={() => onReorder(field.id, 'down')}
            disabled={isLast} title="Move down" aria-label="Move field down">↓</button>
        </div>
      )}

      <div className="field-name-wrapper">
        {readOnly ? (
          <span className="field-name-readonly">{field.field_name}</span>
        ) : (
          <input
            className={`field-name-input ${error ? 'input-error' : ''}`}
            placeholder="Field name e.g. Rarity"
            value={field.field_name}
            onChange={e => onChange(field.id, 'field_name', e.target.value)}
            aria-label="Field name"
          />
        )}
        {error && <span className="field-error-msg">{error}</span>}
      </div>

      <select className="field-type-select" value={field.field_type}
        onChange={e => onChange(field.id, 'field_type', e.target.value)}
        disabled={readOnly} aria-label="Field type">
        {FIELD_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* === ISSUE #13 START: options input for select fields === */}
      {field.field_type === 'select' && !readOnly && (
        <OptionsInput
          options={field.options}
          onChange={opts => onChange(field.id, 'options', opts)}
        />
      )}
      {field.field_type === 'select' && readOnly && field.options?.length > 0 && (
        <span className="field-options-readonly">{field.options.join(', ')}</span>
      )}
      {/* === ISSUE #13 END === */}

      <label className="field-required-label" title="Mark as required">
        <input type="checkbox" checked={field.is_required}
          onChange={e => onChange(field.id, 'is_required', e.target.checked)}
          disabled={readOnly} />
        <span className="field-required-text">Required</span>
      </label>

      {!readOnly && isNew && onRemove && (
        <button className="field-remove-btn" onClick={() => onRemove(field.id)}
          title="Remove field" aria-label="Remove field">✕</button>
      )}

    </div>
  );
}

/**
 * OptionsInput — local string state so commas can be typed freely.
 * Saves on every keystroke so clicking Next never loses data.
 * Initialises from existing options prop for edit mode.
 */
function OptionsInput({ options, onChange }) {
  const [raw, setRaw] = useState(
    Array.isArray(options) && options.length > 0 ? options.join(', ') : ''
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setRaw(val);
    // Parse and save on every keystroke — clicking Next won't lose data
    onChange(val.split(',').map(s => s.trim()).filter(Boolean));
  };

  return (
    <input
      className="field-options-input"
      placeholder="Options: e.g. Common, Rare, Ultra Rare"
      value={raw}
      onChange={handleChange}
      aria-label="Dropdown options (comma-separated)"
      title="Enter options separated by commas."
    />
  );
}

// === ISSUE #10 END: Template Builder UI ===