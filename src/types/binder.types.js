/**
 * @fileoverview Binder schema — validator and factory.
 * === ISSUE #81: cover_color ===
 * === ISSUE #82: page_color ===
 * === ISSUE #92 START: Binder close/open animation with sticker customisation ===
 *   stickers: array of { id, image_url, x, y, rotation } placed freely on
 *   the cover. x/y are PERCENTAGES (0-100), not pixels — storing percent
 *   instead of absolute pixel coordinates means sticker positions stay
 *   correct regardless of how large the cover renders on different
 *   screens/zoom levels, since the cover itself can be different sizes
 *   in different places (normal view, fullscreen, customize mode).
 *   rotation is in degrees, image_url is the already-compressed base64
 *   string (same compressImage() utility used for card images).
 */

import { generateId } from './utils.js';

export const BINDER_COLORS = Object.freeze([
  '#e8627a', '#a855f7', '#6366f1', '#3b82f6',
  '#06b6d4', '#22c55e', '#f59e0b', '#ef4444',
]);

export const DEFAULT_BINDER_COLOR = BINDER_COLORS[0];

// === ISSUE #92: sticker validation, used both for the binder-level array
// check and standalone when adding/moving a single sticker ===
function validateSticker(sticker) {
  const errors = [];
  if (!sticker || typeof sticker !== 'object') return ['Sticker must be an object'];
  if (!sticker.id || typeof sticker.id !== 'string') errors.push('sticker.id must be a non-empty string');
  if (!sticker.image_url || typeof sticker.image_url !== 'string') errors.push('sticker.image_url must be a non-empty string');
  if (typeof sticker.x !== 'number' || sticker.x < 0 || sticker.x > 100) errors.push('sticker.x must be a number 0-100 (percentage)');
  if (typeof sticker.y !== 'number' || sticker.y < 0 || sticker.y > 100) errors.push('sticker.y must be a number 0-100 (percentage)');
  if (typeof sticker.rotation !== 'number') errors.push('sticker.rotation must be a number (degrees)');
  return errors;
}

export function validateBinder(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!Number.isInteger(data.cols) || data.cols < 1 || data.cols > 10) errors.push('cols must be integer 1–10');
  if (!Number.isInteger(data.rows) || data.rows < 1 || data.rows > 10) errors.push('rows must be integer 1–10');
  if (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > 500) errors.push('pages must be integer 1–500');
  if (typeof data.cover_color !== 'string' || !data.cover_color.startsWith('#')) errors.push('cover_color must be a hex string');
  if (!['dark', 'light'].includes(data.page_color)) errors.push('page_color must be dark or light');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');

  // === ISSUE #92: stickers must be an array; each entry validated ===
  if (!Array.isArray(data.stickers)) {
    errors.push('stickers must be an array');
  } else {
    data.stickers.forEach((sticker, idx) => {
      validateSticker(sticker).forEach(e => errors.push(`stickers[${idx}]: ${e}`));
    });
  }

  return { valid: errors.length === 0, errors };
}

export function createBinder({
  name, cols, rows, pages,
  cover_color = DEFAULT_BINDER_COLOR,
  page_color = 'dark',
  stickers = [],
  userId = 'local-user-1',
}) {
  const binder = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    cols:        Number(cols),
    rows:        Number(rows),
    pages:       Number(pages),
    cover_color: cover_color ?? DEFAULT_BINDER_COLOR,
    page_color:  page_color ?? 'dark',
    stickers:    Array.isArray(stickers) ? stickers : [],
    createdAt:   Date.now(),
  };
  const { valid, errors } = validateBinder(binder);
  return valid ? { binder, errors: [] } : { binder: null, errors };
}

// === ISSUE #92: factory for a single sticker — used by the cover
// customizer when the person drops a new sticker image onto the cover ===
/**
 * @param {{ image_url: string, x: number, y: number, rotation?: number }} params
 * @returns {{ sticker: object|null, errors: string[] }}
 */
export function createSticker({ image_url, x, y, rotation = 0 }) {
  const sticker = {
    id: generateId(),
    image_url,
    x: Number(x),
    y: Number(y),
    rotation: Number(rotation),
  };
  const errors = validateSticker(sticker);
  return errors.length === 0 ? { sticker, errors: [] } : { sticker: null, errors };
}

// === ISSUE #92 END ===