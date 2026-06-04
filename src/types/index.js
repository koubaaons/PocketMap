/**
 * @fileoverview Types barrel — re-exports all validators, factories, and utilities.
 *
 * Every file in the app imports from '../../types/index.js'.
 * This barrel means NOTHING else needs to change when we add new type files.
 *
 * To add a new entity type:
 *   1. Create its file e.g. inventory.types.js
 *   2. Add export lines here
 *   Done.
 */

export { validateBinder, createBinder } from './binder.types.js';
export { validateCard, validateBinItem, createCard } from './card.types.js';
export { validateCollection, validateTemplateField, validateCardDefinition, createCollection, createTemplateField, createCardDefinition } from './collection.types.js';
export { generateId, sanitize } from './utils.js';