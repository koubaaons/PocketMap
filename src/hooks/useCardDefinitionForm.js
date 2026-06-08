/**
 * @fileoverview useCardDefinitionForm hook.
 *
 * Extracts all form logic from CardDefinitionForm so the component
 * is responsible only for rendering.
 *
 * Handles:
 * - Building initial values from template fields
 * - Field value state
 * - Validation (name required, required fields enforced)
 * - Building the final card definition object on submit
 *
 * Usage:
 *   const { values, errors, set, handleSubmit } = useCardDefinitionForm({
 *     collection, sortedFields, initialCard, mode, onSubmit
 *   });
 */

// === REFACTOR4b START: Extract useCardDefinitionForm hook ===

import { useState } from 'react';
import { createCardDefinition } from '../types/index.js';

/**
 * @param {{
 *   collection: object,
 *   sortedFields: object[],
 *   initialCard?: object,
 *   mode: 'create' | 'edit',
 *   onSubmit: (cardDef) => void,
 * }} params
 */
export function useCardDefinitionForm({ collection, sortedFields, initialCard, mode, onSubmit }) {

  // ── Build initial values from template fields ─────────────────────────────

  const buildInitialValues = () => {
    const values = { name: initialCard?.name ?? '' };
    sortedFields.forEach(f => {
      const existing = initialCard?.attributes?.[f.field_name];
      if (existing !== undefined) {
        values[f.field_name] = existing;
      } else {
        switch (f.field_type) {
          case 'boolean': values[f.field_name] = false; break;
          case 'number':  values[f.field_name] = '';    break;
          default:        values[f.field_name] = '';
        }
      }
    });
    return values;
  };

  const [values, setValues] = useState(buildInitialValues);
  const [errors, setErrors] = useState({});

  // ── Set a single field value ──────────────────────────────────────────────

  const set = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    // Clear error for this field on change
    if (errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  // ── Validate ──────────────────────────────────────────────────────────────

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

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!validate()) return;

    const attributes = {};
    sortedFields.forEach(f => { attributes[f.field_name] = values[f.field_name]; });

    if (mode === 'create') {
      const { cardDef, errors: createErrors } = createCardDefinition({
        collectionId: collection.id,
        name: values.name.trim(),
        attributes,
      });
      if (!cardDef) { console.error('Card creation failed:', createErrors); return; }
      onSubmit(cardDef);
    } else {
      onSubmit({
        ...initialCard,
        name: values.name.trim(),
        attributes,
        updatedAt: Date.now(),
      });
    }
  };

  return { values, errors, set, handleSubmit };
}

// === REFACTOR4b END: Extract useCardDefinitionForm hook ===