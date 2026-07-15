/**
 * @fileoverview CardDefinitionFields — the Holo/Name/Rarity/Dynamic
 * fields shared between CardDefinitionForm.jsx (standalone create/edit
 * modal) and CardDetailModal.jsx's inline edit sub-page.
 *
 * Extracted because these were genuinely duplicated — identical
 * fields, identical logic, just typed out twice in two different
 * files with slightly different id attributes. The image upload UI
 * itself is NOT included here — that layout differs structurally
 * between the two callers (see useCardImageUpload.js's own header
 * comment for why), so each caller still renders its own image UI,
 * just sharing the upload hook's logic underneath it.
 *
 * @param {{
 *   values: object, errors: object, set: (key: string, value: any) => void,
 *   sortedFields: object[],
 *   nameFieldId?: string, rarityFieldId?: string,
 * }} props
 * nameFieldId/rarityFieldId let each caller keep distinct, valid HTML
 * ids for their own <label htmlFor> (CardDefinitionForm's modal and
 * CardDetailModal's inline panel both render at once in some flows,
 * so duplicate ids would be invalid HTML even though only one is ever
 * visible at a time).
 */

import { HolographicPicker, DynamicField } from './CardDefinitionForm.jsx';

export function CardDefinitionFields({
  values,
  errors,
  set,
  sortedFields,
  nameFieldId = 'card-def-name',
  rarityFieldId = 'card-def-rarity',
}) {
  return (
    <>
      <div className="form-group">
        <label>Holographic Effect</label>
        <HolographicPicker value={values.holoType} onChange={(v) => set('holoType', v)} />
      </div>

      <div className="form-group">
        <label htmlFor={nameFieldId}>Card Name *</label>
        <input
          id={nameFieldId}
          className={`form-input ${errors.name ? 'input-error' : ''}`}
          placeholder="e.g. Bloom Believix"
          value={values.name}
          onChange={e => set('name', e.target.value)}
          autoFocus
        />
        {errors.name && <span className="field-error-msg">{errors.name}</span>}
      </div>

      {/* Rarity — free text rather than a fixed picker, since
          different TCG franchises use very different rarity naming
          systems (Pokémon, Yu-Gi-Oh, One Piece, etc.) */}
      <div className="form-group">
        <label htmlFor={rarityFieldId}>Rarity</label>
        <input
          id={rarityFieldId}
          className="form-input"
          placeholder="e.g. Rare Holo, Ultra Rare, Secret Rare…"
          value={values.rarity}
          onChange={e => set('rarity', e.target.value)}
        />
      </div>

      {sortedFields.map(field => (
        <DynamicField
          key={field.id}
          field={field}
          value={values[field.field_name]}
          error={errors[field.field_name]}
          onChange={(val) => set(field.field_name, val)}
        />
      ))}
    </>
  );
}