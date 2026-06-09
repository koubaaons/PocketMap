/**
 * @fileoverview Inventory schema — validator and factory.
 *
 * USER_INVENTORY = a card the user owns.
 * Existence of a record = owned. No record = not owned.
 * No boolean "owned" flag needed.
 *
 * condition_rating is nullable — users may not want to grade every card.
 */

// === ISSUE #35 START: Create Inventory Entity — model ===

import { generateId } from './utils.js';

/**
 * Valid condition ratings.
 * Stored as lowercase strings for consistent filtering.
 */
export const CONDITION_RATINGS = Object.freeze([
  'mint',
  'near_mint',
  'excellent',
  'good',
  'played',
  'poor',
]);

/**
 * Validates an inventory item.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInventoryItem(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.cardDefId || typeof data.cardDefId !== 'string') errors.push('cardDefId must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');

  // condition_rating is nullable
  if (data.condition_rating !== null && !CONDITION_RATINGS.includes(data.condition_rating)) {
    errors.push(`condition_rating must be one of: ${CONDITION_RATINGS.join(', ')} or null`);
  }

  if (typeof data.is_tradeable !== 'boolean') errors.push('is_tradeable must be a boolean');
  if (typeof data.is_sellable !== 'boolean') errors.push('is_sellable must be a boolean');
  if (typeof data.is_favorite !== 'boolean') errors.push('is_favorite must be a boolean');

  // personal_notes is nullable string
  if (data.personal_notes !== null && typeof data.personal_notes !== 'string') {
    errors.push('personal_notes must be a string or null');
  }

  // acquired_at is nullable timestamp
  if (data.acquired_at !== null && typeof data.acquired_at !== 'number') {
    errors.push('acquired_at must be a timestamp or null');
  }

  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a validated inventory item.
 * Represents a user owning a copy of a card definition.
 *
 * @param {{
 *   cardDefId: string,
 *   collectionId: string,
 *   userId?: string,
 *   condition_rating?: string | null,
 *   is_tradeable?: boolean,
 *   is_sellable?: boolean,
 *   is_favorite?: boolean,
 *   personal_notes?: string | null,
 *   acquired_at?: number | null,
 * }} params
 */
export function createInventoryItem({
  cardDefId,
  collectionId,
  userId = 'local-user-1',
  condition_rating = null,
  is_tradeable = false,
  is_sellable = false,
  is_favorite = false,
  personal_notes = null,
  acquired_at = null,
}) {
  const now = Date.now();
  const item = {
    id: generateId(),
    userId,
    cardDefId,
    collectionId,
    condition_rating,
    is_tradeable: Boolean(is_tradeable),
    is_sellable: Boolean(is_sellable),
    is_favorite: Boolean(is_favorite),
    personal_notes: personal_notes ?? null,
    acquired_at: acquired_at ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateInventoryItem(item);
  return valid ? { item, errors: [] } : { item: null, errors };
}

// === ISSUE #35 END: Create Inventory Entity — model ===