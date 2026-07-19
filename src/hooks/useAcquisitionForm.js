/**
 * @fileoverview useAcquisitionForm hook.
 * Extracted from AcquisitionForm.jsx so CardDetailModal.jsx can reuse
 * the same state/validation logic for inline editing, instead of a
 * separate modal — same reasoning as useCardDefinitionForm's reset()
 * addition for the card-editing sub-page.
 */

import { useState } from 'react';

export function useAcquisitionForm({ inventoryItem, onSubmit }) {
  // inventoryItem is null for unowned cards. This hook still has to
  // be called unconditionally (Rules of Hooks) even though the UI
  // that uses it only ever shows for owned cards — falls back to an
  // empty object so buildInitialFields doesn't throw in that case.
  const item = inventoryItem ?? {};

  const buildInitialFields = () => ({
    condition_rating: item.condition_rating ?? '',
    language:         item.language ?? '',
    label:            item.label ?? '',
    personal_notes:   item.personal_notes ?? '',
    is_tradeable:     item.is_tradeable ?? false,
    is_sellable:      item.is_sellable ?? false,
    acquired_at: (() => {
      if (!item.acquired_at) return '';
      const d = new Date(item.acquired_at);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    })(),
  });

  const [fields, setFields] = useState(buildInitialFields);

  const set = (key, val) => setFields(prev => ({ ...prev, [key]: val }));

  // Same reasoning as useCardDefinitionForm's reset() — this hook's
  // instance stays mounted the whole time (edit mode just toggles
  // which UI shows), so re-entering edit mode after a cancelled edit
  // needs an explicit reset back to the real current values.
  const reset = () => setFields(buildInitialFields());

  const handleSubmit = () => {
    let acquired_at = null;
    if (fields.acquired_at) {
      const parsed = new Date(fields.acquired_at).getTime();
      acquired_at = isNaN(parsed) ? null : parsed;
    }

    onSubmit({
      ...inventoryItem,
      condition_rating: fields.condition_rating || null,
      language:         fields.language || null,
      label:            fields.label.trim() || null,
      personal_notes:   fields.personal_notes.trim() || null,
      is_tradeable:     fields.is_tradeable,
      is_sellable:      fields.is_sellable,
      acquired_at,
      updatedAt: Date.now(),
    });
  };

  return { fields, set, handleSubmit, reset };
}