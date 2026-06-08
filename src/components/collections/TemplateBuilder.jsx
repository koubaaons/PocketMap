/**
 * @fileoverview TemplateBuilder — reusable field builder component.
 */

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
  // === ISSUE #13 START: Card Definition Management — cancel button for new fields ===
  const isNew = field.id.startsWith('new-');
  // === ISSUE #13 END ===

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

      {/* === ISSUE #13 START: Card Definition Management — options input for select fields === */}
      {field.field_type === 'select' && !readOnly && (
        <input
          className="field-options-input"
          placeholder="Options: e.g. Common, Rare, Ultra Rare"
          value={Array.isArray(field.options) ? field.options.join(', ') : ''}
          onChange={e => {
            const parsed = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            onChange(field.id, 'options', parsed);
          }}
          aria-label="Dropdown options (comma-separated)"
          title="Enter options separated by commas"
        />
      )}
      {field.field_type === 'select' && readOnly && field.options?.length > 0 && (
        <span className="field-options-readonly">{field.options.join(', ')}</span>
      )}
      {/* === ISSUE #13 END: Card Definition Management — options input === */}

      <label className="field-required-label" title="Mark as required">
        <input type="checkbox" checked={field.is_required}
          onChange={e => onChange(field.id, 'is_required', e.target.checked)}
          disabled={readOnly} />
        <span className="field-required-text">Required</span>
      </label>

      {/* === ISSUE #13 START: Card Definition Management — remove button for new fields === */}
      {!readOnly && isNew && onRemove && (
        <button
          className="field-remove-btn"
          onClick={() => onRemove(field.id)}
          title="Remove field"
          aria-label="Remove field"
        >
          ✕
        </button>
      )}
      {/* === ISSUE #13 END: Card Definition Management — remove button === */}

    </div>
  );
}
