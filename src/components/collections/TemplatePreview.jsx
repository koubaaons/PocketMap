/**
 * @fileoverview TemplatePreview — read-only preview of a collection's field schema.
 *
 * Used in:
 *   1. Final step of collection creation modal (Review & Create)
 *   2. Collection settings — overview of current fields
 *
 * Shows fields in order, highlights required ones,
 * and surfaces a validation warning if no fields exist.
 */

// === ISSUE #12 START: Template Review & Preview ===

/**
 * @param {{
 *   fields: object[],
 *   showValidation?: boolean,
 * }} props
 *
 * showValidation: when true, shows an error if there are no fields
 * or no required fields. Used before save to surface issues.
 */
export function TemplatePreview({ fields, showValidation = false }) {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const hasFields = sorted.length > 0;
  const hasRequired = sorted.some(f => f.is_required);

  return (
    <div className="template-preview">

      {/* Validation warnings — shown before save if needed */}
      {showValidation && !hasFields && (
        <div className="template-preview-warning">
          ⚠ At least one field is required before saving.
        </div>
      )}
      {showValidation && hasFields && !hasRequired && (
        <div className="template-preview-hint">
          ℹ Consider marking at least one field as required (e.g. Card Name or Number).
        </div>
      )}

      {/* Field list */}
      {hasFields ? (
        <div className="template-preview-fields">
          {sorted.map((field, idx) => (
            <div key={field.id} className="template-preview-row">
              <span className="preview-field-order">{idx + 1}</span>
              <span className="preview-field-name">{field.field_name}</span>
              <span className="preview-field-type">{field.field_type}</span>
              {field.is_required && (
                <span className="preview-field-required">required</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="template-preview-empty">No fields defined yet.</p>
      )}

      {/* Summary */}
      {hasFields && (
        <p className="template-preview-summary">
          {sorted.length} field{sorted.length !== 1 ? 's' : ''} ·{' '}
          {sorted.filter(f => f.is_required).length} required
        </p>
      )}

    </div>
  );
}

// === ISSUE #12 END: Template Review & Preview ===