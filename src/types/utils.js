/**
 * @fileoverview Shared type utilities.
 * Kept separate so all type files can import from here
 * without creating circular dependencies.
 */

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