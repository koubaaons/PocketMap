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
      image_size_bytes: initialCard?.image_size_bytes ?? null,
      // === HOLO: seed from the card's current holoType so editing
      // starts the picker on its real value, not always 'none' — an
      // existing card with no holoType at all (created before this
      // field existed) still correctly defaults to 'none' here. ===
      holoType: initialCard?.holoType ?? 'none',
      // Free text, not a fixed picker like holoType — different TCG
      // franchises use very different rarity naming systems.
      rarity: initialCard?.rarity ?? '',
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

  // === Needed for reusing this hook in an always-mounted context
  // (CardDetailModal's inline editor toggles edit mode on/off without
  // ever unmounting) — buildInitialValues only runs once on mount via
  // useState's lazy initializer, so without an explicit reset,
  // re-entering edit mode after a cancelled edit would show the
  // discarded draft instead of the card's real current values. ===
  const reset = () => {
    setValues(buildInitialValues());
    setErrors({});
  };

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
        image_size_bytes: values.image_size_bytes ?? null,
        attributes,
        // === HOLO: pass the picked holoType through to the factory,
        // which itself clamps any invalid value back to 'none'. ===
        holoType: values.holoType ?? 'none',
        rarity: values.rarity?.trim() || null,
      });
      if (!cardDef) { console.error('Card creation failed:', createErrors); return; }
      onSubmit(cardDef);
    } else {
      onSubmit({
        ...initialCard,
        name: values.name.trim(),
        // === ISSUE #80: include image_url in update ===
        image_url: values.image_url ?? null,
        image_size_bytes: values.image_size_bytes ?? null,
        attributes,
        // === HOLO FIX: this was missing entirely — without it, picking
        // a different holoType while editing an existing card was
        // silently discarded, since ...initialCard's old value would
        // otherwise be the only one present on the update object. ===
        holoType: values.holoType ?? 'none',
        rarity: values.rarity?.trim() || null,
        updatedAt: Date.now(),
      });
    }
  };

  return { values, errors, set, handleSubmit, reset };
}

// === REFACTOR4b END ===