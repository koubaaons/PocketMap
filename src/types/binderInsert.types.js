/**
 * @fileoverview Binder insert schema — validator and factory.
 * === Michi Method support ===
 *
 * A BINDER_INSERT is a decorative image — art, a themed background,
 * a placeholder — used to fill a combined slot (see binderPanel.types.js).
 * Deliberately NOT a card: no rarity, no collection, no template
 * fields, no ownership. Just a name and an image, kept in its own
 * small library separate from card_definitions/collections entirely.
 */

import { generateId } from './utils.js';

export function validateBinderInsert(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!data.image_url || typeof data.image_url !== 'string') errors.push('image_url must be a non-empty string');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  // Optional — undefined/null both mean "not deleted" (see BinderSlot/
  // library usages of `insert.deletedAt ?? null`), matching the same
  // pattern already used for holoType/isDecluttered elsewhere.
  if (data.deletedAt !== undefined && data.deletedAt !== null && typeof data.deletedAt !== 'number') {
    errors.push('deletedAt must be a timestamp or null');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * @param {{ name: string, image_url: string, userId?: string }} params
 */
export function createBinderInsert({ name, image_url, userId = 'local-user-1' }) {
  const insert = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    image_url,
    createdAt: Date.now(),
  };
  const { valid, errors } = validateBinderInsert(insert);
  return valid ? { insert, errors: [] } : { insert: null, errors };
}