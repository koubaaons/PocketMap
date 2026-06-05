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

export function TemplateManagementView({ collection, templateFields, toast }) {
  const dispatch = useDispatch();

  // Fields belonging to this collection sorted by order
  const collectionFields = useMemo(
    () => templateFields
      .filter(f => f.collectionId === collection.id)
      .sort((a, b) => a.order - b.order),
    [templateFields, collection.id]
  );

  // Local edit state — we stage changes here before dispatching
  const [editFields, setEditFields] = useState(() =>
    collectionFields.map(f => ({ ...f }))
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [mode, setMode] = useState('preview'); // 'preview' | 'edit'
  const [hasChanges, setHasChanges] = useState(false);

  // ── Field change handlers ──────────────────────────────────────────────────

  const handleChange = (id, key, val) => {
    setEditFields(fields => fields.map(f => f.id === id ? { ...f, [key]: val } : f));
    setHasChanges(true);
    // Clear error on change
    if (fieldErrors[id]) setFieldErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const handleReorder = (id, direction) => {
    const sorted = [...editFields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(f => f.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const orderA = sorted[idx].order;
    const orderB = sorted[swapIdx].order;
    setEditFields(fields => fields.map(f => {
      if (f.id === sorted[idx].id) return { ...f, order: orderB };
      if (f.id === sorted[swapIdx].id) return { ...f, order: orderA };
      return f;
    }));
    setHasChanges(true);
  };
  const handleAddField = () => {
    const nextOrder = editFields.length;
    const { field, errors } = createTemplateField({
      collectionId: collection.id,
      field_name: '',
      field_type: 'text',
      is_required: false,
      order: nextOrder,
    });
    // createTemplateField will fail validation because field_name is empty —
    // that's fine, we just need the shape. Build it manually for local state.
    const newField = {
      id: `temp-${Date.now()}`,
      collectionId: collection.id,
      field_name: '',
      field_type: 'text',
      is_required: false,
      order: nextOrder,
      _isNew: true, // flag so we know to dispatch ADD not UPDATE
    };
    setEditFields(f => [...f, newField]);
    setHasChanges(true);
  };

  // ── Save changes ───────────────────────────────────────────────────────────

  const handleSave = () => {
    // Validate all fields
    const errors = {};
    editFields.forEach(f => {
      if (!f.field_name.trim()) errors[f.id] = 'Field name is required';
    });
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    // Dispatch updates and adds
    editFields.forEach((f, idx) => {
      const normalized = { ...f, order: idx }; // normalize order on save

      if (f._isNew) {
        // New field — create properly and dispatch ADD
        const { field } = createTemplateField({
          collectionId: collection.id,
          field_name: f.field_name,
          field_type: f.field_type,
          is_required: f.is_required,
          order: idx,
        });
        if (field) dispatch({ type: ACTIONS.TEMPLATE_FIELD_ADD, payload: field });
      } else {
        // Existing field — dispatch UPDATE
        dispatch({
          type: ACTIONS.TEMPLATE_FIELD_UPDATE,
          payload: { ...normalized, order: idx },
        });
      }
    });

    toast('Fields saved');
    setHasChanges(false);
    setMode('preview');
  };

  const handleDiscard = () => {
    setEditFields(collectionFields.map(f => ({ ...f })));
    setFieldErrors({});
    setHasChanges(false);
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

      {/* === ISSUE #12: Preview mode shows TemplatePreview === */}
      {mode === 'preview' && (
        <TemplatePreview
          fields={collectionFields}
          showValidation={false}
        />
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
            onAdd={handleAddField}
            onReorder={handleReorder}
          />
        </>
      )}

    </div>
  );
}
