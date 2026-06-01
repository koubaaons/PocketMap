/**
 * @fileoverview Central type definitions and schema validation.
 * All data shapes are defined and validated here.
 * If migrating to TypeScript, replace these with interfaces/types.
 */

// ─── Schema Validators ───────────────────────────────────────────────────────

/**
 * Validates a Binder object shape.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBinder(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!Number.isInteger(data.cols) || data.cols < 1 || data.cols > 10) errors.push('cols must be integer 1–10');
  if (!Number.isInteger(data.rows) || data.rows < 1 || data.rows > 10) errors.push('rows must be integer 1–10');
  if (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > 500) errors.push('pages must be integer 1–500');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Card object shape.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCard(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
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

/**
 * Validates a BinItem object shape.
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBinItem(data) {
  const cardResult = validateCard(data);
  if (!cardResult.valid) return cardResult;
  const errors = [];
  if (typeof data.deletedAt !== 'number') errors.push('deletedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Creates a validated Binder object.
 * @param {{ name: string, cols: number, rows: number, pages: number }} params
 * @returns {{ binder: object|null, errors: string[] }}
 */
export function createBinder({ name, cols, rows, pages }) {
  const binder = {
    id: generateId(),
    name: (name || '').trim(),
    cols: Number(cols),
    rows: Number(rows),
    pages: Number(pages),
    createdAt: Date.now(),
  };
  const { valid, errors } = validateBinder(binder);
  return valid ? { binder, errors: [] } : { binder: null, errors };
}

/**
 * Creates a validated Card object.
 * @param {{ binderId: string, name: string, character?: string, series?: string, page: number, slot: number, favorite?: boolean }} params
 * @returns {{ card: object|null, errors: string[] }}
 */
export function createCard({ binderId, name, character = '', series = '', page, slot, favorite = false }) {
  const card = {
    id: generateId(),
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

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Generates a collision-resistant unique ID */
export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Sanitizes a string for safe HTML insertion */
export function sanitize(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}