/**
 * @fileoverview Binder slot schema — validator and factory.
 *
 * A BINDER_SLOT references a CARD_DEFINITION directly.
 * Existence of a slot = card is organised in a binder.
 * The slot exists independently of ownership:
 *   - Owned card in slot   = colored card
 *   - Unowned card in slot = grey placeholder
 */

// === ISSUE #53 START: Binder Slot Entity ===

import { generateId } from './utils.js';

export function validateBinderSlot(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.binderId || typeof data.binderId !== 'string') errors.push('binderId must be a non-empty string');
  if (!data.cardDefId || typeof data.cardDefId !== 'string') errors.push('cardDefId must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!Number.isInteger(data.pageNumber) || data.pageNumber < 1) errors.push('pageNumber must be a positive integer');
  if (!Number.isInteger(data.slotIndex) || data.slotIndex < 0) errors.push('slotIndex must be a non-negative integer');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

/**
 * Creates a validated binder slot.
 * @param {{
 *   binderId: string,
 *   cardDefId: string,
 *   collectionId: string,
 *   pageNumber: number,
 *   slotIndex: number,
 *   userId?: string,
 * }} params
 */
export function createBinderSlot({
  binderId,
  cardDefId,
  collectionId,
  pageNumber,
  slotIndex,
  userId = 'local-user-1',
}) {
  const slot = {
    id: generateId(),
    userId,
    binderId,
    cardDefId,
    collectionId,
    pageNumber: Number(pageNumber),
    slotIndex:  Number(slotIndex),
    createdAt:  Date.now(),
  };
  const { valid, errors } = validateBinderSlot(slot);
  return valid ? { slot, errors: [] } : { slot: null, errors };
}

// === ISSUE #53 END: Binder Slot Entity ===