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
  if (data.import_source !== null && typeof data.import_source !== 'string') errors.push('import_source must be a string or null');
  if (data.cover_image_url !== null && typeof data.cover_image_url !== 'string') errors.push('cover_image_url must be a string or null');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}
// === END: userId added to validator ===

// === MILESTONE 2: userId added to factory, defaults to local user ===
export function createCollection({ name, is_custom, import_source = null, cover_image_url = null, userId = 'local-user-1' }) {
  const now = Date.now();
  const collection = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    is_custom: Boolean(is_custom),
    import_source: import_source ?? null,
    cover_image_url: cover_image_url ?? null,
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
  if (data.image_url !== null && typeof data.image_url !== 'string') errors.push('image_url must be a string or null');
  if (typeof data.attributes !== 'object' || data.attributes === null) errors.push('attributes must be an object');
  // holoType is OPTIONAL — existing cards created before this field
  // existed won't have it at all, and that's valid. Missing/undefined
  // is treated the SAME as 'none' when rendering (BinderSlot etc. use
  // `cardDef.holoType ?? 'none'`) — which, per the semantic change
  // above, means those cards now show Regular Holo by default, not no
  // effect. Only a PRESENT value gets checked against the allowed
  // list, so old stored data is never retroactively invalidated by
  // adding this field.
  if (data.holoType !== undefined && !HOLO_TYPES.includes(data.holoType)) {
    errors.push(`holoType must be one of: ${HOLO_TYPES.join(', ')}`);
  }
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createCardDefinition({ collectionId, name, image_url = null, attributes = {}, holoType = 'none' }) {
  const now = Date.now();
  const cardDef = {
    id: generateId(),
    collectionId,
    name: (name || '').trim(),
    image_url: image_url ?? null,
    attributes: attributes ?? {},
    holoType: HOLO_TYPES.includes(holoType) ? holoType : 'none',
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCardDefinition(cardDef);
  return valid ? { cardDef, errors: [] } : { cardDef: null, errors };
}