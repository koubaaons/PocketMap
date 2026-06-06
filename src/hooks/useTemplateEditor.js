/**
 * @fileoverview useTemplateEditor hook.
 *
 * Encapsulates all template field editing logic so it can be reused
 * in both CollectionModals (creation) and TemplateManagementView (editing).
 *
 * Responsibilities:
 * - Local field state
 * - Add field
 * - Change field value
 * - Reorder field (up/down)
 * - Validate all fields
 * - Reset to initial state
 *
 * No dispatch here — callers decide what to do with the final field data.
 *
 * Usage:
 *   const { fields, errors, handleAdd, handleChange, handleReorder, validate, reset } =
 *     useTemplateEditor(initialFields);
 */

// === REFACTOR3a START: Extract useTemplateEditor hook ===

import { useState } from 'react';

/**
 * @param {object[]} initialFields - starting fields (empty array for creation flow)
 * @returns {{
 *   fields: object[],
 *   errors: Record<string, string>,
 *   hasChanges: boolean,
 *   handleAdd: () => void,
 *   handleChange: (id, key, value) => void,
 *   handleReorder: (id, direction: 'up'|'down') => void,
 *   validate: () => boolean,
 *   reset: (fields?: object[]) => void,
 *   clearErrors: () => void,
 * }}
 */
export function useTemplateEditor(initialFields = []) {
  const [fields, setFields] = useState(() => initialFields.map(f => ({ ...f })));
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // ── Add a new empty field ─────────────────────────────────────────────────

  const handleAdd = () => {
    const nextOrder = fields.length;
    setFields(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        field_name: '',
        field_type: 'text',
        is_required: false,
        order: nextOrder,
        _isNew: true,
      },
    ]);
    setHasChanges(true);
  };

  // ── Update a field property ───────────────────────────────────────────────

  const handleChange = (id, key, val) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
    setHasChanges(true);
    // Clear the error for this field as soon as the user changes it
    if (errors[id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // ── Reorder a field up or down ────────────────────────────────────────────

  const handleReorder = (id, direction) => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(f => f.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const orderA = sorted[idx].order;
    const orderB = sorted[swapIdx].order;

    setFields(prev => prev.map(f => {
      if (f.id === sorted[idx].id) return { ...f, order: orderB };
      if (f.id === sorted[swapIdx].id) return { ...f, order: orderA };
      return f;
    }));
    setHasChanges(true);
  };

  // ── Validate all fields ───────────────────────────────────────────────────

  /**
   * Validates all fields. Sets errors state.
   * @returns {boolean} true if valid, false if there are errors
   */
  const validate = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (!f.field_name.trim()) newErrors[f.id] = 'Field name is required';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Reset to a new set of fields ──────────────────────────────────────────

  /**
   * Resets the editor to a given field list (or empty if none provided).
   * Used when discarding changes.
   * @param {object[]} [nextFields]
   */
  const reset = (nextFields = []) => {
    setFields(nextFields.map(f => ({ ...f })));
    setErrors({});
    setHasChanges(false);
  };

  const clearErrors = () => setErrors({});

  // Return sorted by order so consumers always get a consistent view
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  return {
    fields: sortedFields,
    errors,
    hasChanges,
    handleAdd,
    handleChange,
    handleReorder,
    validate,
    reset,
    clearErrors,
  };
}

// === REFACTOR3a END: Extract useTemplateEditor hook ===