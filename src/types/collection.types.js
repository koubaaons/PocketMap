/**
 * @fileoverview Collection schema — validators and factories.
 * Covers Collection, TemplateField, and CardDefinition.
 */

import { generateId } from './utils.js';
import { HOLO_TYPES } from './holoTypes.js';

export { HOLO_TYPES };

// ─── Collection ───────────────────────────────────────────────────────────────

// === MILESTONE 2: userId added to validator ===
export function validateCollection(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (typeof data.is_custom !== 'boolean') errors.push('is_custom must be a boolean');
  if (data.import_source !== null && data.import_source !== undefined && typeof data.import_source !== 'string') errors.push('import_source must be a string or null');
  if (data.cover_image_url !== null && data.cover_image_url !== undefined && typeof data.cover_image_url !== 'string') errors.push('cover_image_url must be a string or null');
  // Both optional — only a provider-imported collection has these at
  // all; a custom collection, or one created before this feature
  // existed, simply won't. external_set_id is the machine-readable id
  // (e.g. "base1") this collection was imported from, used to
  // refetch and diff its current card list later — distinct from
  // import_source, which is a human-readable display label ("Pokémon
  // TCG: Base Set"), not something safe to refetch by.
  // known_external_card_ids tracks every external card id this
  // collection has ever been shown as available (whether actually
  // imported or dismissed), so a dismissed "new card" notification
  // doesn't reappear on every subsequent daily check.
  if (data.external_set_id !== null && data.external_set_id !== undefined && typeof data.external_set_id !== 'string') {
    errors.push('external_set_id must be a string or null');
  }
  // Which provider external_set_id/its cards' external_card_id
  // actually belong to — see this field's own migration comment for
  // why this matters once a provider swap ever happens. Optional for
  // the same reason external_set_id is: only a provider-imported
  // collection has this at all.
  if (data.provider_key !== null && data.provider_key !== undefined && typeof data.provider_key !== 'string') {
    errors.push('provider_key must be a string or null');
  }
  if (data.known_external_card_ids !== undefined && !Array.isArray(data.known_external_card_ids)) {
    errors.push('known_external_card_ids must be an array');
  }
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}
// === END: userId added to validator ===

// === MILESTONE 2: userId added to factory, defaults to local user ===
export function createCollection({ name, is_custom, import_source = null, cover_image_url = null, userId = 'local-user-1', external_set_id = null, known_external_card_ids = [], provider_key = null }) {
  const now = Date.now();
  const collection = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    is_custom: Boolean(is_custom),
    import_source: import_source ?? null,
    cover_image_url: cover_image_url ?? null,
    external_set_id: external_set_id ?? null,
    known_external_card_ids: known_external_card_ids ?? [],
    provider_key: provider_key ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCollection(collection);
  return valid ? { collection, errors: [] } : { collection: null, errors };
}
// === END: userId added to factory ===

// ─── TemplateField ────────────────────────────────────────────────────────────


export function validateTemplateField(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.field_name || typeof data.field_name !== 'string' || !data.field_name.trim()) errors.push('field_name must be a non-empty string');
  if (!['text', 'number', 'boolean', 'select'].includes(data.field_type)) errors.push('field_type must be text | number | boolean | select');
  if (typeof data.is_required !== 'boolean') errors.push('is_required must be a boolean');
  if (!Number.isInteger(data.order) || data.order < 0) errors.push('order must be a non-negative integer');
  // options is required for select fields — must be a non-empty array of strings
  if (data.field_type === 'select') {
    if (!Array.isArray(data.options) || data.options.length === 0) {
      errors.push('options must be a non-empty array for select fields');
    }
  } else {
    // non-select fields can have options as empty array or undefined
    if (data.options !== undefined && !Array.isArray(data.options)) {
      errors.push('options must be an array');
    }
  }
  return { valid: errors.length === 0, errors };
}

export function createTemplateField({
  collectionId,
  field_name,
  field_type = 'text',
  is_required = false,
  order = 0,
  options = [],
}) {
  const field = {
    id: generateId(),
    collectionId,
    field_name: (field_name || '').trim(),
    field_type,
    is_required: Boolean(is_required),
    order: Number(order),
    // options: array of strings for select fields, empty array for all others
    options: Array.isArray(options) ? options.map(o => String(o).trim()).filter(Boolean) : [],
  };
  const { valid, errors } = validateTemplateField(field);
  return valid ? { field, errors: [] } : { field: null, errors };
}
export function validateOneTemplatePerCollection(collectionId, existingFields) {
  const alreadyHasFields = existingFields.some(f => f.collectionId === collectionId);
  if (alreadyHasFields) {
    return {
      valid: false,
      error: 'This collection already has fields configured. Each collection can only have one field schema.',
    };
  }
  return { valid: true };
}

// ─── CardDefinition ───────────────────────────────────────────────────────────
// CardDefinition belongs to a collection, not directly to a user.
// No userId needed here — ownership is tracked via USER_INVENTORY.

// holoType: which holographic visual treatment this card renders with
// inside the binder. See ./holoTypes.js for the full type registry
// (id + label + asset deps) and the rationale for why 'none' is an
// active recipe (Regular Holo) rather than a no-op — 'off' is the
// genuinely-flat value.

export function validateCardDefinition(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (data.image_url !== null && data.image_url !== undefined && typeof data.image_url !== 'string') errors.push('image_url must be a string or null');
  if (typeof data.attributes !== 'object' || data.attributes === null) errors.push('attributes must be an object');
  // holoType is OPTIONAL — existing cards created before this field
  // existed won't have it at all, and that's valid. Missing/undefined
  // is treated the SAME as 'none' when rendering (BinderSlot etc. use
  // `cardDef.holoType ?? 'none'`) — which, per the semantic change
  // above, means those cards now show Regular Holo by default, not no
  // effect. Only a PRESENT value gets checked against the allowed
  // list, so old stored data is never retroactively invalidated by
  // adding this field. Explicit null is treated the same as
  // undefined here too — `?? 'none'` at read-time doesn't
  // distinguish between them, so the validator shouldn't either.
  if (data.holoType !== undefined && data.holoType !== null && !HOLO_TYPES.includes(data.holoType)) {
    errors.push(`holoType must be one of: ${HOLO_TYPES.join(', ')}`);
  }
  // Free text, not a fixed enum — different TCG franchises (Pokémon,
  // Yu-Gi-Oh, One Piece, etc.) use very different rarity naming
  // systems, so a closed list here would be wrong for most of them.
  if (data.rarity !== undefined && data.rarity !== null && typeof data.rarity !== 'string') {
    errors.push('rarity must be a string or null');
  }
  // Optional for the same reason holoType is — existing cards created
  // before decluttering existed won't have this field at all, and
  // that's valid; missing/undefined reads as "not decluttered" via
  // `cardDef.isDecluttered ?? false` at every call site.
  if (data.isDecluttered !== undefined && data.isDecluttered !== null && typeof data.isDecluttered !== 'boolean') {
    errors.push('isDecluttered must be a boolean');
  }
  // Optional — only a provider-imported card has this at all. The
  // stable id this exact card has in the source API (e.g. Pokémon TCG
  // API's "base1-4"), used to reliably tell "a card I already have"
  // apart from "a genuinely new card" when re-checking a set for
  // updates — matching by name alone risks conflating reprints or
  // alternate arts that legitimately share a name.
  if (data.external_card_id !== null && data.external_card_id !== undefined && typeof data.external_card_id !== 'string') {
    errors.push('external_card_id must be a string or null');
  }
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createCardDefinition({ collectionId, name, image_url = null, attributes = {}, holoType = 'none', rarity = null, isDecluttered = false, external_card_id = null }) {
  const now = Date.now();
  const cardDef = {
    id: generateId(),
    collectionId,
    name: (name || '').trim(),
    image_url: image_url ?? null,
    attributes: attributes ?? {},
    holoType: HOLO_TYPES.includes(holoType) ? holoType : 'none',
    rarity: rarity ?? null,
    isDecluttered: Boolean(isDecluttered),
    external_card_id: external_card_id ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCardDefinition(cardDef);
  return valid ? { cardDef, errors: [] } : { cardDef: null, errors };
}