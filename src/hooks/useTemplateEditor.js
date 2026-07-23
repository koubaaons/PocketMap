/**
 * @fileoverview useTemplateEditor hook.
 * Encapsulates all template field editing logic.
 */


import { useState } from 'react';

export function useTemplateEditor(initialFields = []) {
  const [fields, setFields] = useState(() => {
    const resolved = typeof initialFields === 'function' ? initialFields() : initialFields;
    return resolved.map(f => ({ ...f }));
  });
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

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
        options: [],
      },
    ]);
    setHasChanges(true);
  };

  const handleChange = (id, key, val) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
    setHasChanges(true);
    if (errors[id]) {
      setErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

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

  // === ISSUE #13 START: Card Definition Management — handleRemove for unsaved fields ===
  // Only fields with id starting with 'new-' can be removed.
  // Persisted fields (real IDs) are protected — no deletion allowed.
  const handleRemove = (id) => {
    if (!id.startsWith('new-')) return; // safety guard
    setFields(prev => prev.filter(f => f.id !== id));
    setHasChanges(true);
    if (errors[id]) {
      setErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };
  // === ISSUE #13 END: Card Definition Management — handleRemove ===

  const validate = () => {
    const newErrors = {};
    fields.forEach(f => {
      if (!f.field_name.trim()) newErrors[f.id] = 'Field name is required';
      // select fields must have at least one option
      if (f.field_type === 'select' && (!f.options || f.options.length === 0)) {
        newErrors[f.id] = 'Dropdown fields must have at least one option';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const reset = (nextFields = []) => {
    setFields(nextFields.map(f => ({ ...f })));
    setErrors({});
    setHasChanges(false);
  };

  const clearErrors = () => setErrors({});

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  return {
    fields: sortedFields,
    errors,
    hasChanges,
    handleAdd,
    handleChange,
    handleReorder,
    handleRemove,
    validate,
    reset,
    clearErrors,
  };
}
