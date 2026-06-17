/**
 * @fileoverview useCardDefinitionForm hook.
 * === ISSUE #80: image_url included in form state and submit ===
 */

// === REFACTOR4b START: Extract useCardDefinitionForm hook ===

import { useState } from 'react';
import { createCardDefinition } from '../types/index.js';

export function useCardDefinitionForm({ collection, sortedFields, initialCard, mode, onSubmit }) {

  const buildInitialValues = () => {
    const values = {
      name: initialCard?.name ?? '',
      // === ISSUE #80: include image_url in initial values ===
      image_url: initialCard?.image_url ?? null,
    };
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

  const set = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

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

  const handleSubmit = () => {
    if (!validate()) return;

    const attributes = {};
    sortedFields.forEach(f => { attributes[f.field_name] = values[f.field_name]; });

    if (mode === 'create') {
      const { cardDef, errors: createErrors } = createCardDefinition({
        collectionId: collection.id,
        name: values.name.trim(),
        // === ISSUE #80: pass image_url to factory ===
        image_url: values.image_url ?? null,
        attributes,
      });
      if (!cardDef) { console.error('Card creation failed:', createErrors); return; }
      onSubmit(cardDef);
    } else {
      onSubmit({
        ...initialCard,
        name: values.name.trim(),
        // === ISSUE #80: include image_url in update ===
        image_url: values.image_url ?? null,
        attributes,
        updatedAt: Date.now(),
      });
    }
  };

  return { values, errors, set, handleSubmit };
}

// === REFACTOR4b END ===