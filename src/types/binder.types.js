/**
 * @fileoverview Binder schema — validator and factory.
 * === ISSUE #81: added cover_color field ===
 */

import { generateId } from './utils.js';

// === ISSUE #81 START: Binder Color Picker — preset palette ===
export const BINDER_COLORS = Object.freeze([
  '#e8627a', // pink (default — Pinder accent)
  '#a855f7', // purple
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // teal
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
]);

export const DEFAULT_BINDER_COLOR = BINDER_COLORS[0];
// === ISSUE #81 END ===

export function validateBinder(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!Number.isInteger(data.cols) || data.cols < 1 || data.cols > 10) errors.push('cols must be integer 1–10');
  if (!Number.isInteger(data.rows) || data.rows < 1 || data.rows > 10) errors.push('rows must be integer 1–10');
  if (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > 500) errors.push('pages must be integer 1–500');
  // === ISSUE #81: validate cover_color ===
  if (typeof data.cover_color !== 'string' || !data.cover_color.startsWith('#')) {
    errors.push('cover_color must be a hex color string');
  }
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createBinder({ name, cols, rows, pages, cover_color = DEFAULT_BINDER_COLOR, userId = 'local-user-1' }) {
  const binder = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    cols:  Number(cols),
    rows:  Number(rows),
    pages: Number(pages),
    // === ISSUE #81: cover_color with default ===
    cover_color: cover_color ?? DEFAULT_BINDER_COLOR,
    createdAt: Date.now(),
  };
  const { valid, errors } = validateBinder(binder);
  return valid ? { binder, errors: [] } : { binder: null, errors };
}