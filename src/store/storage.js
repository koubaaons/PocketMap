/**
 * @fileoverview localStorage storage layer — local cache and state persistence.
 *
 * This file owns only localStorage concerns. Supabase read/write lives in
 * supabaseStorage.js. Keeping them separate means adding new entity types
 * in Milestone 12 only touches supabaseStorage.js — this file stays stable.
 *
 * Swap localStorage for AsyncStorage (React Native) by changing only this file.
 *
 * === Real bug fixed: every function here used to read/write a single,
 * fixed, global key ('bindervault'), with no user id in it at all —
 * meaning every account signed into the same browser shared the exact
 * same cached state. Switching accounts on the same device could show,
 * and even let you edit, a completely different account's binders and
 * collections under the new account's identity, until a fresh Supabase
 * load happened to overwrite it (and if that load ever failed or was
 * slow, the stale data would just sit there instead). Every function
 * below now takes userId and scopes its key to that specific account,
 * the same fix already applied to useDeclutteredSets.js for the same
 * underlying class of bug. ===
 */

import {
  validateBinder,
  validateCollection, validateTemplateField, validateCardDefinition,
  validateInventoryItem, validateBinderSlot,
  validateBinderInsert, validateBinderPanel,
} from '../types/index.js';

const DEBUG = import.meta.env.DEV;

const STORAGE_KEY_PREFIX = 'bindervault';
const SCHEMA_VERSION = 2;

function storageKeyFor(userId) {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

export const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  user: { id: 'local-user-1', username: 'Collector', createdAt: Date.now() },
  binders: [],
  bin: [],
  collections: [],
  templateFields: [],
  cardDefinitions: [],
  inventory: [],
  binderSlots: [],
  binderInserts: [],
  binderPanels: [],
};

const MIGRATIONS = {
  2: (state) => ({
    ...state,
    binderSlots: state.binderSlots ?? [],
    bin: (state.bin ?? []).map(item => ({
      ...item,
      _type: item._type ?? 'legacy_card',
    })),
    cards: undefined,
    version: 2,
  }),
};

function applyMigrations(state) {
  let current = state;
  let v = current.version ?? 1;
  while (MIGRATIONS[v + 1]) {
    DEBUG && console.info(`[Pinder] Migrating storage from v${v} → v${v + 1}`);
    current = MIGRATIONS[v + 1](current);
    v = current.version;
  }
  return current;
}

export function sanitizeState(raw) {
  const user = (raw.user && raw.user.id && raw.user.username)
    ? raw.user
    : DEFAULT_STATE.user;

  const binders = (raw.binders ?? []).filter(b => {
    if (!b.page_color)  b.page_color  = 'dark';
    if (!b.cover_color) b.cover_color = '#e8627a';
    if (!Array.isArray(b.stickers)) b.stickers = [];
    b.stickers = b.stickers.map(s => (typeof s.scale === 'number' ? s : { ...s, scale: 1 }));
    b.stickers = b.stickers.map(s => (typeof s.size  === 'number' ? s : { ...s, size: 17.5 }));
    const { valid, errors } = validateBinder(b);
    if (!valid) DEBUG && console.warn('[Pinder] Dropping corrupt binder:', errors, b);
    return valid;
  });

  const binderIds = new Set(binders.map(b => b.id));

  const collections = (raw.collections ?? []).filter(c => {
    const { valid, errors } = validateCollection(c);
    if (!valid) DEBUG && console.warn('[Pinder] Dropping corrupt collection:', errors, c);
    return valid;
  });

  const collectionIds = new Set(collections.map(c => c.id));

  const templateFields = (raw.templateFields ?? []).filter(f => {
    const { valid, errors } = validateTemplateField(f);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt template field:', errors, f); return false; }
    if (!collectionIds.has(f.collectionId)) { DEBUG && console.warn('[Pinder] Dropping orphan template field:', f.id); return false; }
    return true;
  });

  const cardDefinitions = (raw.cardDefinitions ?? []).filter(cd => {
    const { valid, errors } = validateCardDefinition(cd);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt card definition:', errors, cd); return false; }
    if (!collectionIds.has(cd.collectionId)) { DEBUG && console.warn('[Pinder] Dropping orphan card definition:', cd.id); return false; }
    return true;
  });

  const cardDefIds = new Set(cardDefinitions.map(cd => cd.id));

  const inventory = (raw.inventory ?? []).filter(inv => {
    const { valid, errors } = validateInventoryItem(inv);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt inventory item:', errors, inv); return false; }
    if (!cardDefIds.has(inv.cardDefId)) { DEBUG && console.warn('[Pinder] Dropping orphan inventory item:', inv.id); return false; }
    return true;
  });

  const binderSlots = (raw.binderSlots ?? []).filter(s => {
    const { valid, errors } = validateBinderSlot(s);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt binder slot:', errors, s); return false; }
    if (!binderIds.has(s.binderId))    { DEBUG && console.warn('[Pinder] Dropping orphan binder slot (no binder):', s.id); return false; }
    if (!cardDefIds.has(s.cardDefId))  { DEBUG && console.warn('[Pinder] Dropping orphan binder slot (no card def):', s.id); return false; }
    return true;
  });

  // === Michi Method support: combined slots ===
  const binderInserts = (raw.binderInserts ?? []).filter(i => {
    const { valid, errors } = validateBinderInsert(i);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt binder insert:', errors, i); return false; }
    return true;
  });

  const binderInsertIds = new Set(binderInserts.map(i => i.id));

  const binderPanels = (raw.binderPanels ?? []).filter(p => {
    const { valid, errors } = validateBinderPanel(p);
    if (!valid) { DEBUG && console.warn('[Pinder] Dropping corrupt binder panel:', errors, p); return false; }
    if (!binderIds.has(p.binderId)) { DEBUG && console.warn('[Pinder] Dropping orphan binder panel (no binder):', p.id); return false; }
    if (p.panelType === 'card' && !cardDefIds.has(p.cardDefId)) { DEBUG && console.warn('[Pinder] Dropping orphan binder panel (no card def):', p.id); return false; }
    if (p.panelType === 'insert' && !binderInsertIds.has(p.insertId)) { DEBUG && console.warn('[Pinder] Dropping orphan binder panel (no insert):', p.id); return false; }
    return true;
  });

  const bin = (raw.bin ?? []).filter(item => {
    if (!item || typeof item !== 'object') return false;
    if (!item.id || typeof item.id !== 'string') return false;
    if (!item._type) return false;
    if (!item.deletedAt || typeof item.deletedAt !== 'number') return false;
    return true;
  });

  return {
    ...raw,
    user,
    binders,
    bin,
    collections,
    templateFields,
    cardDefinitions,
    inventory,
    binderSlots,
    binderInserts,
    binderPanels,
    // nav is never restored from localStorage — always reset to home on load
    nav: undefined,
  };
}

export function loadState(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const migrated = applyMigrations(parsed);
    return sanitizeState(migrated);
  } catch (err) {
    console.error('[Pinder] Failed to load state, using defaults:', err);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state, userId) {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify({ ...state, version: SCHEMA_VERSION }));
    return { success: true };
  } catch (err) {
    console.error('[Pinder] Failed to save state:', err);
    return { success: false, error: err };
  }
}

export function clearState(userId) {
  try { localStorage.removeItem(storageKeyFor(userId)); return { success: true }; }
  catch (err) { return { success: false, error: err }; }
}

export function getStorageUsage(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId)) ?? '';
    return Math.round((raw.length * 2) / 1024);
  } catch { return 0; }
}