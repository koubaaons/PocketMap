/**
 * @fileoverview Binder schema — validator and factory.
 * === ISSUE #81: cover_color ===
 * === ISSUE #82: page_color ===
 */

import { generateId } from './utils.js';

export const BINDER_COLORS = Object.freeze([
  '#e8627a', '#a855f7', '#6366f1', '#3b82f6',
  '#06b6d4', '#22c55e', '#f59e0b', '#ef4444',
]);

export const DEFAULT_BINDER_COLOR = BINDER_COLORS[0];

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
  return { valid: errors.length === 0, errors };
}

export function createBinder({ name, cols, rows, pages, cover_color = DEFAULT_BINDER_COLOR, page_color = 'dark', userId = 'local-user-1' }) {
  const binder = {
    id: generateId(),
    userId,
    name: (name || '').trim(),
    cols:        Number(cols),
    rows:        Number(rows),
    pages:       Number(pages),
    cover_color: cover_color ?? DEFAULT_BINDER_COLOR,
    page_color:  page_color ?? 'dark',
    createdAt:   Date.now(),
  };
  const { valid, errors } = validateBinder(binder);
  return valid ? { binder, errors: [] } : { binder: null, errors };
}