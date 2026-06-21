/**
 * @fileoverview Types barrel — re-exports all validators, factories, and utilities.
 */

// === ISSUE #81: export BINDER_COLORS and DEFAULT_BINDER_COLOR ===
// === ISSUE #92: export createSticker for the cover customizer ===
export { validateBinder, createBinder, createSticker, BINDER_COLORS, DEFAULT_BINDER_COLOR } from './binder.types.js';

// === ISSUE #58 START: Remove Legacy Card System — card types kept for migration only ===
export { validateCard, validateBinItem, createCard } from './card.types.js';
// === ISSUE #58 END ===

export {
  validateCollection,
  validateTemplateField,
  validateCardDefinition,
  validateOneTemplatePerCollection,
  createCollection,
  createTemplateField,
  createCardDefinition,
} from './collection.types.js';

export {
  validateInventoryItem,
  createInventoryItem,
  CONDITION_RATINGS,
  CONDITION_LABELS,
  formatConditionRating,
} from './inventory.types.js';

// === ISSUE #53 START: Binder Slot Entity ===
export { validateBinderSlot, createBinderSlot } from './binderSlot.types.js';
// === ISSUE #53 END ===

export { generateId, sanitize } from './utils.js';