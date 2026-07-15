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

// === REFACTOR5c START: Move CONDITION_LABELS to inventory.types.js ===
/**
 * Display labels for condition ratings.
 * Single source of truth — import anywhere a condition needs displaying.
 */
export const CONDITION_LABELS = Object.freeze({
  mint:      'Mint',
  near_mint: 'Near Mint',
  excellent: 'Excellent',
  good:      'Good',
  played:    'Played',
  poor:      'Poor',
});

/**
 * Returns a human-readable label for a condition rating.
 * Falls back to the raw value if not found.
 * @param {string|null} rating
 * @returns {string}
 */
export function formatConditionRating(rating) {
  if (!rating) return 'Not graded';
  return CONDITION_LABELS[rating] ?? rating.replace('_', ' ');
}
// === REFACTOR5c END ===

/**
 * Valid card languages — covers the common print languages across
 * the TCG franchises this app supports. Per-copy, not per-card (two
 * copies of the same card can genuinely be different languages),
 * same reasoning as condition_rating above.
 */
export const LANGUAGE_OPTIONS = Object.freeze([
  'english',
  'japanese',
  'chinese_simplified',
  'chinese_traditional',
  'korean',
  'german',
  'french',
  'italian',
  'spanish',
  'portuguese',
]);

export const LANGUAGE_LABELS = Object.freeze({
  english:              'English',
  japanese:             'Japanese',
  chinese_simplified:   'Chinese (Simplified)',
  chinese_traditional:  'Chinese (Traditional)',
  korean:               'Korean',
  german:               'German',
  french:               'French',
  italian:              'Italian',
  spanish:              'Spanish',
  portuguese:           'Portuguese',
});

/**
 * Returns a human-readable label for a language code.
 * Falls back to the raw value if not found.
 * @param {string|null} language
 * @returns {string}
 */
export function formatLanguage(language) {
  if (!language) return 'Not set';
  return LANGUAGE_LABELS[language] ?? language.replace('_', ' ');
}

export function validateInventoryItem(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.cardDefId || typeof data.cardDefId !== 'string') errors.push('cardDefId must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (data.condition_rating !== null && data.condition_rating !== undefined && !CONDITION_RATINGS.includes(data.condition_rating)) {
    errors.push(`condition_rating must be one of: ${CONDITION_RATINGS.join(', ')} or null`);
  }
  if (data.language !== null && data.language !== undefined && !LANGUAGE_OPTIONS.includes(data.language)) {
    errors.push(`language must be one of: ${LANGUAGE_OPTIONS.join(', ')} or null`);
  }
  if (typeof data.is_tradeable !== 'boolean') errors.push('is_tradeable must be a boolean');
  if (typeof data.is_sellable !== 'boolean') errors.push('is_sellable must be a boolean');
  if (typeof data.is_favorite !== 'boolean') errors.push('is_favorite must be a boolean');
  if (data.personal_notes !== null && data.personal_notes !== undefined && typeof data.personal_notes !== 'string') {
    errors.push('personal_notes must be a string or null');
  }
  if (data.acquired_at !== null && data.acquired_at !== undefined && typeof data.acquired_at !== 'number') {
    errors.push('acquired_at must be a timestamp or null');
  }
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createInventoryItem({
  cardDefId,
  collectionId,
  userId = 'local-user-1',
  condition_rating = null,
  language = null,
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
    language,
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