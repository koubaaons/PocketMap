/**
 * @fileoverview TemplateManagementView — manage fields for an existing collection.
 *
 * Accessed via Collection Settings → Edit Fields.
 * The concept of "template" is never shown to the user — they see "Fields."
 *
 * Rules enforced here:
 *   - Fields can be added and edited
 *   - Fields cannot be deleted (soft delete in future version)
 *   - One field schema per collection (enforced at reducer level too)
 *   - Changes are saved field by field via TEMPLATE_FIELD_UPDATE
 *   - New fields are added via TEMPLATE_FIELD_ADD
 */

import { useState, useMemo } from 'react';
import { Button } from '../ui/index.jsx';
import { TemplateBuilder } from '../collections/TemplateBuilder.jsx';
import { TemplatePreview } from '../collections/TemplatePreview.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { createTemplateField } from '../../types/index.js';

// === REFACTOR3a START: use useTemplateEditor hook ===
import { useTemplateEditor } from '../../hooks/useTemplateEditor.js';
// === REFACTOR3a END ===

export function TemplateManagementView({ collection, templateFields, toast }) {
  const dispatch = useDispatch();
  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'

  const collectionFields = useMemo(
    () => templateFields
      .filter(f => f.collectionId === collection.id)
      .sort((a, b) => a.order - b.order),
    [templateFields, collection.id]
  );

  // === REFACTOR3a START: replace duplicated field logic with hook ===
  const {
    fields: editFields,
    errors: fieldErrors,
    hasChanges,
    handleAdd,
    handleChange,
    handleReorder,
    validate,
    reset,
  } = useTemplateEditor(collectionFields);
  // === REFACTOR3a END ===

  // === REFACTOR3c START: separate existingFields and newFields — no _isNew flag ===
  // New fields have ids starting with 'new-' assigned by useTemplateEditor.handleAdd
  // Existing fields have real persisted ids from the store
  const existingFields = editFields.filter(f => !f.id.startsWith('new-'));
  const newFields = editFields.filter(f => f.id.startsWith('new-'));
  // === REFACTOR3c END ===

  // ── Save changes ───────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!validate()) return;

    // === REFACTOR3c START: dispatch ADD for new, UPDATE for existing — no _isNew flag needed ===
    existingFields.forEach((f) => {
      dispatch({
        type: ACTIONS.TEMPLATE_FIELD_UPDATE,
        payload: { ...f },
      });
    });

    newFields.forEach((f) => {
      const { field } = createTemplateField({
        collectionId: collection.id,
        field_name: f.field_name,
        field_type: f.field_type,
        is_required: f.is_required,
        order: f.order,
      });
      if (field) dispatch({ type: ACTIONS.TEMPLATE_FIELD_ADD, payload: field });
    });
    // === REFACTOR3c END ===

    toast('Fields saved');
    setMode('preview');
  };

  const handleDiscard = () => {
    reset(collectionFields);
    setMode('preview');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="template-management-view">

      <div className="template-management-header">
        <div>
          <h3 className="template-management-title">Card Fields</h3>
          <p className="template-management-subtitle">
            {collection.is_custom
              ? 'Define what information each card in this collection stores.'
              : `Fields imported from ${collection.import_source}. You can add custom fields.`}
          </p>
        </div>

        {mode === 'preview' ? (
          <Button variant="ghost" size="sm" onClick={() => setMode('edit')}>
            Edit Fields
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={handleDiscard}>Discard</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!hasChanges}>
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {mode === 'preview' && (
        <TemplatePreview fields={collectionFields} showValidation={false} />
      )}

      {mode === 'edit' && (
        <>
          <p className="template-no-delete-hint">
            ℹ Fields cannot be deleted — only added or edited.
          </p>
          <TemplateBuilder
            fields={editFields}
            errors={fieldErrors}
            onChange={handleChange}
            onAdd={handleAdd}
            onReorder={handleReorder}
          />
        </>
      )}

    </div>
  );
}