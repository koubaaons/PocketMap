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

// Shared with binderReducer.js's BINDER_ADD_PAGE guard and
// BinderModals.jsx's create form — a single source of truth so these
// three places can't silently drift out of sync with each other.
export const MAX_BINDER_COLS = 6;
export const MAX_BINDER_ROWS = 6;
export const MAX_BINDER_PAGES = 100;

// === FIX (binder covers looking too saturated/basic — user reference:
// soft pastel covers with a subtle spine + light decorative accent):
// same 8-hue wheel as before, just lightened/desaturated so covers
// read as soft pastel card stock instead of vivid flat color blocks.
// DEFAULT_BINDER_COLOR stays BINDER_COLORS[0] automatically — no
// separate update needed there.
export const BINDER_COLORS = Object.freeze([
  '#f6c9d6', '#d3c6ef', '#c7c9f0', '#bfe0ea',
  '#bfeaea', '#c9e4c5', '#f6dfb8', '#f2c6c6',
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
  // === ISSUE #92 STAGE 3: scale — multiplier on the base 56px display
  // size, defaulting to 1. Bounded 0.4-10: the UI clamps resize to
  // whatever the sticker's current position geometrically allows
  // without clipping the cover's edge (a centered sticker on a typical
  // cover can reach roughly 8x before that happens) — this validator
  // bound is just the outer data-level safety net, set high enough to
  // never be the actual limiting factor in normal use. ===
  if (typeof sticker.scale !== 'number' || sticker.scale < 0.4 || sticker.scale > 10) errors.push('sticker.scale must be a number 0.4-10');
  // === ISSUE #94 FIX: size — PERCENTAGE of the cover's own width, not a
  // fixed pixel value. A fixed 56px looked correct only on the one
  // canvas width (320px) it happened to be tuned for — on the real
  // binder cover (renders up to ~540px+) the same 56px sticker covers
  // proportionally less area, looking smaller; on a 24px mini home-grid
  // preview it would be comically oversized. Storing size as a % of
  // cover width (default 17.5, i.e. 56/320) keeps it visually
  // consistent across every container, the same reasoning already
  // applied to x/y. ===
  if (typeof sticker.size !== 'number' || sticker.size < 5 || sticker.size > 60) errors.push('sticker.size must be a number 5-60 (percentage of cover width)');
  // Optional — used to accurately decrement the per-user storage
  // total when this sticker is later removed. Named distinctly from
  // the existing `size` field, which is the sticker's visual/display
  // size (a percentage of cover width), not a file byte count —
  // reusing that name here would have been a real, confusing collision.
  if (sticker.imageSizeBytes !== undefined && sticker.imageSizeBytes !== null && typeof sticker.imageSizeBytes !== 'number') {
    errors.push('sticker.imageSizeBytes must be a number or null');
  }
  return errors;
}

export function validateBinder(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!Number.isInteger(data.cols) || data.cols < 1 || data.cols > MAX_BINDER_COLS) errors.push(`cols must be integer 1–${MAX_BINDER_COLS}`);
  if (!Number.isInteger(data.rows) || data.rows < 1 || data.rows > MAX_BINDER_ROWS) errors.push(`rows must be integer 1–${MAX_BINDER_ROWS}`);
  if (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > MAX_BINDER_PAGES) errors.push(`pages must be integer 1–${MAX_BINDER_PAGES}`);
  if (typeof data.cover_color !== 'string' || !data.cover_color.startsWith('#')) errors.push('cover_color must be a hex string');
  // Accepts either the old fixed 'dark'/'light' preset strings
  // (existing binders in the database already have these — this
  // isn't a migration, just backward-compatible validation) or any
  // hex color (new binders, and anyone who picks a custom page color
  // going forward).
  const isLegacyPreset = data.page_color === 'dark' || data.page_color === 'light';
  const isHexColor = typeof data.page_color === 'string' && data.page_color.startsWith('#');
  if (!isLegacyPreset && !isHexColor) errors.push('page_color must be a hex string (or legacy dark/light)');
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
  // Was 'dark' (a fixed preset string) — now any hex color, matching
  // cover_color's own pattern. Default hex matches the OLD 'dark'
  // preset's actual color (#1e1e1e) so nothing visually shifts for
  // anyone who hasn't touched this setting.
  page_color = '#1e1e1e',
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
    page_color:  page_color ?? '#1e1e1e',
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
export function createSticker({ image_url, x, y, rotation = 0, scale = 1, size = 17.5, imageSizeBytes = null }) {
  const sticker = {
    id: generateId(),
    image_url,
    x: Number(x),
    y: Number(y),
    rotation: Number(rotation),
    scale: Number(scale),
    size: Number(size),
    imageSizeBytes: imageSizeBytes ?? null,
  };
  const errors = validateSticker(sticker);
  return errors.length === 0 ? { sticker, errors: [] } : { sticker: null, errors };
}

// === ISSUE #92 END ===