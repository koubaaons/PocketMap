/**
 * @fileoverview Binder panel schema — validator and factory.
 * === Michi Method support ===
 *
 * A BINDER_PANEL represents one combined-slot group: a rectangular
 * block of slots (startSlotIndex + spanCols/spanRows) merged into one
 * larger space, holding EITHER a real card (panelType 'card' — e.g. a
 * Jumbo/oversized promo that genuinely needs more than one slot's
 * worth of space, still a real ownable card with rarity etc.) OR a
 * decorative insert (panelType 'insert' — art, not a card at all, see
 * binderInsert.types.js).
 *
 * binder_slots itself is untouched by this — a panel is an additive,
 * separate concept. When building a page's grid, slot positions
 * covered by a panel (other than its own start position) are simply
 * not rendered as individual slots; the panel's own span covers that
 * visual space instead. See BinderPage.jsx.
 */

import { generateId } from './utils.js';

export function validateBinderPanel(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.userId || typeof data.userId !== 'string') errors.push('userId must be a non-empty string');
  if (!data.binderId || typeof data.binderId !== 'string') errors.push('binderId must be a non-empty string');
  if (!Number.isInteger(data.pageNumber) || data.pageNumber < 1) errors.push('pageNumber must be a positive integer');
  if (!Number.isInteger(data.startSlotIndex) || data.startSlotIndex < 0) errors.push('startSlotIndex must be a non-negative integer');
  if (!Number.isInteger(data.spanCols) || data.spanCols < 1) errors.push('spanCols must be a positive integer');
  if (!Number.isInteger(data.spanRows) || data.spanRows < 1) errors.push('spanRows must be a positive integer');
  if (data.spanCols === 1 && data.spanRows === 1) errors.push('a panel must span more than one slot (spanCols and spanRows are both 1 — that\'s just a normal slot)');
  if (!['card', 'insert'].includes(data.panelType)) errors.push('panelType must be "card" or "insert"');
  if (data.panelType === 'card' && !data.cardDefId) errors.push('cardDefId is required when panelType is "card"');
  if (data.panelType === 'insert' && !data.insertId) errors.push('insertId is required when panelType is "insert"');
  // === Drag/resize positioning within the combined space — same
  // percentage-based approach as binder cover stickers (see
  // binder.types.js's validateSticker), so the image can be
  // repositioned/scaled independently of its own natural aspect
  // ratio, rather than being force-cropped to fill the space. ===
  if (typeof data.imageX !== 'number' || data.imageX < 0 || data.imageX > 100) errors.push('imageX must be a number 0-100 (percentage)');
  if (typeof data.imageY !== 'number' || data.imageY < 0 || data.imageY > 100) errors.push('imageY must be a number 0-100 (percentage)');
  if (typeof data.imageScale !== 'number' || data.imageScale < 0.2 || data.imageScale > 10) errors.push('imageScale must be a number 0.2-10');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

/**
 * @param {{
 *   binderId: string,
 *   pageNumber: number,
 *   startSlotIndex: number,
 *   spanCols: number,
 *   spanRows: number,
 *   panelType: 'card' | 'insert',
 *   cardDefId?: string,
 *   insertId?: string,
 *   userId?: string,
 * }} params
 */
export function createBinderPanel({
  binderId,
  pageNumber,
  startSlotIndex,
  spanCols,
  spanRows,
  panelType,
  cardDefId = null,
  insertId = null,
  imageX = 50,
  imageY = 50,
  imageScale = 1,
  userId = 'local-user-1',
}) {
  const panel = {
    id: generateId(),
    userId,
    binderId,
    pageNumber:     Number(pageNumber),
    startSlotIndex: Number(startSlotIndex),
    spanCols:       Number(spanCols),
    spanRows:       Number(spanRows),
    panelType,
    cardDefId: panelType === 'card' ? cardDefId : null,
    insertId:  panelType === 'insert' ? insertId : null,
    imageX:     Number(imageX),
    imageY:     Number(imageY),
    imageScale: Number(imageScale),
    createdAt: Date.now(),
  };
  const { valid, errors } = validateBinderPanel(panel);
  return valid ? { panel, errors: [] } : { panel: null, errors };
}