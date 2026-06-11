/**
 * @fileoverview Types barrel — re-exports all validators, factories, and utilities.
 */

export { validateBinder, createBinder } from './binder.types.js';

// === ISSUE #58 START: Remove Legacy Card System — card types kept for migration only ===
// These are used only in storage.js sanitizer during migration.
// Remove after SCHEMA_VERSION 3 migration drops legacy cards.
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