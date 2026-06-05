/**
 * @fileoverview TemplateBuilder — reusable field builder component.
 *
 * Used in two places:
 *   1. Collection creation modal (custom path) — building fields before save
 *   2. Collection settings — editing existing fields after creation
 *
 * Receives fields as props, calls onChange/onAdd/onReorder.
 * No dispatch here — parent decides what to do with the data.
 */

// === ISSUE #10 START: Template Builder UI ===

const FIELD_TYPES = [
  { value: 'text',    label: 'Text'     },
  { value: 'number',  label: 'Number'   },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select',  label: 'Dropdown' },
];

/**
 * @param {{
 *   fields: object[],
 *   errors: Record<string, string>,
 *   onChange: (id, key, value) => void,
 *   onAdd: () => void,
 *   onReorder: (id, direction: 'up'|'down') => void,
 *   readOnly?: boolean,
 * }} props
 */
export function TemplateBuilder({ fields, errors = {}, onChange, onAdd, onReorder, readOnly = false }) {
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

// === ISSUE #10: Single row in the builder ===
function TemplateBuilderRow({ field, error, isFirst, isLast, onChange, onReorder, readOnly }) {
  return (
    <div className={`template-field-row ${error ? 'has-error' : ''}`}>

      {/* Up / Down reorder buttons */}
      {!readOnly && (
        <div className="field-reorder-btns">
          <button
            className="reorder-btn"
            onClick={() => onReorder(field.id, 'up')}
            disabled={isFirst}
            title="Move up"
            aria-label="Move field up"
          >
            ↑
          </button>
          <button
            className="reorder-btn"
            onClick={() => onReorder(field.id, 'down')}
            disabled={isLast}
            title="Move down"
            aria-label="Move field down"
          >
            ↓
          </button>
        </div>
      )}

      {/* Field name */}
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

      {/* Field type */}
      <select
        className="field-type-select"
        value={field.field_type}
        onChange={e => onChange(field.id, 'field_type', e.target.value)}
        disabled={readOnly}
        aria-label="Field type"
      >
        {FIELD_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Required toggle */}
      <label className="field-required-label" title="Mark as required">
        <input
          type="checkbox"
          checked={field.is_required}
          onChange={e => onChange(field.id, 'is_required', e.target.checked)}
          disabled={readOnly}
        />
        <span className="field-required-text">Required</span>
      </label>

    </div>
  );
}

// === ISSUE #10 END: Template Builder UI ===