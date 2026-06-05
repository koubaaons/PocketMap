/**
 * @fileoverview Collection schema — validators and factories.
 * Covers Collection, TemplateField, and CardDefinition.
 */

import { generateId } from './utils.js';

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
// TemplateField belongs to a collection, not directly to a user.
// No userId needed here — cascade delete via collection handles cleanup.

// === ISSUE #9 START: Template Management — add order field to validator ===
export function validateTemplateField(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.field_name || typeof data.field_name !== 'string' || !data.field_name.trim()) errors.push('field_name must be a non-empty string');
  if (!['text', 'number', 'boolean', 'select'].includes(data.field_type)) errors.push('field_type must be text | number | boolean | select');
  if (typeof data.is_required !== 'boolean') errors.push('is_required must be a boolean');
  // order determines display position — required, must be a non-negative integer
  if (!Number.isInteger(data.order) || data.order < 0) errors.push('order must be a non-negative integer');
  return { valid: errors.length === 0, errors };
}

// order is now required — assigned at creation time based on existing field count
export function createTemplateField({ collectionId, field_name, field_type = 'text', is_required = false, order = 0 }) {
  const field = {
    id: generateId(),
    collectionId,
    field_name: (field_name || '').trim(),
    field_type,
    is_required: Boolean(is_required),
    order: Number(order),
  };
  const { valid, errors } = validateTemplateField(field);
  return valid ? { field, errors: [] } : { field: null, errors };
}
// === ISSUE #9 END: Template Management — add order field to validator ===


// ─── CardDefinition ───────────────────────────────────────────────────────────
// CardDefinition belongs to a collection, not directly to a user.
// No userId needed here — ownership is tracked via USER_INVENTORY.

export function validateCardDefinition(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (data.image_url !== null && typeof data.image_url !== 'string') errors.push('image_url must be a string or null');
  if (typeof data.attributes !== 'object' || data.attributes === null) errors.push('attributes must be an object');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createCardDefinition({ collectionId, name, image_url = null, attributes = {} }) {
  const now = Date.now();
  const cardDef = {
    id: generateId(),
    collectionId,
    name: (name || '').trim(),
    image_url: image_url ?? null,
    attributes: attributes ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCardDefinition(cardDef);
  return valid ? { cardDef, errors: [] } : { cardDef: null, errors };
}