/**
 * @fileoverview Card schema — validators and factory.
 * Covers cards in binders and bin items.
 */

import { generateId } from './utils.js';

// === MILESTONE 2: userId added to validator ===
export function validateCard(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.binderId || typeof data.binderId !== 'string') errors.push('binderId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (data.character !== undefined && typeof data.character !== 'string') errors.push('character must be a string');
  if (data.series !== undefined && typeof data.series !== 'string') errors.push('series must be a string');
  if (!Number.isInteger(data.page) || data.page < 1) errors.push('page must be a positive integer');
  if (!Number.isInteger(data.slot) || data.slot < 1) errors.push('slot must be a positive integer');
  if (typeof data.favorite !== 'boolean') errors.push('favorite must be a boolean');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}
// === END: userId added to validator ===

export function validateBinItem(data) {
  const cardResult = validateCard(data);
  if (!cardResult.valid) return cardResult;
  const errors = [];
  if (typeof data.deletedAt !== 'number') errors.push('deletedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

// === MILESTONE 2: userId added to factory, defaults to local user ===
export function createCard({ binderId, name, character = '', series = '', page, slot, favorite = false, userId = 'local-user-1' }) {
  const card = {
    id: generateId(),
    userId,
    binderId,
    name: (name || '').trim(),
    character: (character || '').trim(),
    series: (series || '').trim(),
    page: Number(page),
    slot: Number(slot),
    favorite: Boolean(favorite),
    createdAt: Date.now(),
  };
  const { valid, errors } = validateCard(card);
  return valid ? { card, errors: [] } : { card: null, errors };
}
// === END: userId added to factory ===