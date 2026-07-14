/**
 * @fileoverview Types barrel — re-exports all validators, factories, and utilities.
 */

// === ISSUE #81: export BINDER_COLORS and DEFAULT_BINDER_COLOR ===
// === ISSUE #92: export createSticker for the cover customizer ===
export { validateBinder, createBinder, createSticker, BINDER_COLORS, DEFAULT_BINDER_COLOR } from './binder.types.js';

// === ISSUE #58 START: Remove Legacy Card System — card types kept for migration only ===
// === ISSUE #58 END ===

// === HOLO: HOLO_TYPES still re-exported from collection.types.js
// (which itself now imports it from holoTypes.js, the actual single
// source of truth) since it's part of CardDefinition's schema. The
// rest of the registry — labels and the full metadata list — comes
// directly from holoTypes.js, so the form's picker reads labels from
// the same place the validator reads allowed ids from. ===
export {
  validateCollection,
  validateTemplateField,
  validateCardDefinition,
  validateOneTemplatePerCollection,
  createCollection,
  createTemplateField,
  createCardDefinition,
  HOLO_TYPES,
} from './collection.types.js';

export { HOLO_LABELS, HOLO_TYPE_REGISTRY } from './holoTypes.js';

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

// === Michi Method support: combined slots ===
export { validateBinderInsert, createBinderInsert } from './binderInsert.types.js';
export { validateBinderPanel, createBinderPanel } from './binderPanel.types.js';

export { generateId, sanitize } from './utils.js';