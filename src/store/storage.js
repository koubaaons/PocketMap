/**
 * @fileoverview localStorage storage layer — local cache and state persistence.
 *
 * This file owns only localStorage concerns. Supabase read/write lives in
 * supabaseStorage.js. Keeping them separate means adding new entity types
 * in Milestone 12 only touches supabaseStorage.js — this file stays stable.
 *
 * Swap localStorage for AsyncStorage (React Native) by changing only this file.
 */

import {
  validateBinder,
  validateCollection, validateTemplateField, validateCardDefinition,
  validateInventoryItem, validateBinderSlot,
} from '../types/index.js';

const DEBUG = import.meta.env.DEV;

const STORAGE_KEY    = 'bindervault';
const SCHEMA_VERSION = 2;

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
    DEBUG && console.info(`[BinderVault] Migrating storage from v${v} → v${v + 1}`);
    current = MIGRATIONS[v + 1](current);
    v = current.version;
  }
  return current;
}

function sanitizeState(raw) {
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
    if (!valid) DEBUG && console.warn('[BinderVault] Dropping corrupt binder:', errors, b);
    return valid;
  });

  const binderIds = new Set(binders.map(b => b.id));

  const collections = (raw.collections ?? []).filter(c => {
    const { valid, errors } = validateCollection(c);
    if (!valid) DEBUG && console.warn('[BinderVault] Dropping corrupt collection:', errors, c);
    return valid;
  });

  const collectionIds = new Set(collections.map(c => c.id));

  const templateFields = (raw.templateFields ?? []).filter(f => {
    const { valid, errors } = validateTemplateField(f);
    if (!valid) { DEBUG && console.warn('[BinderVault] Dropping corrupt template field:', errors, f); return false; }
    if (!collectionIds.has(f.collectionId)) { DEBUG && console.warn('[BinderVault] Dropping orphan template field:', f.id); return false; }
    return true;
  });

  const cardDefinitions = (raw.cardDefinitions ?? []).filter(cd => {
    const { valid, errors } = validateCardDefinition(cd);
    if (!valid) { DEBUG && console.warn('[BinderVault] Dropping corrupt card definition:', errors, cd); return false; }
    if (!collectionIds.has(cd.collectionId)) { DEBUG && console.warn('[BinderVault] Dropping orphan card definition:', cd.id); return false; }
    return true;
  });

  const cardDefIds = new Set(cardDefinitions.map(cd => cd.id));

  const inventory = (raw.inventory ?? []).filter(inv => {
    const { valid, errors } = validateInventoryItem(inv);
    if (!valid) { DEBUG && console.warn('[BinderVault] Dropping corrupt inventory item:', errors, inv); return false; }
    if (!cardDefIds.has(inv.cardDefId)) { DEBUG && console.warn('[BinderVault] Dropping orphan inventory item:', inv.id); return false; }
    return true;
  });

  const binderSlots = (raw.binderSlots ?? []).filter(s => {
    const { valid, errors } = validateBinderSlot(s);
    if (!valid) { DEBUG && console.warn('[BinderVault] Dropping corrupt binder slot:', errors, s); return false; }
    if (!binderIds.has(s.binderId))    { DEBUG && console.warn('[BinderVault] Dropping orphan binder slot (no binder):', s.id); return false; }
    if (!cardDefIds.has(s.cardDefId))  { DEBUG && console.warn('[BinderVault] Dropping orphan binder slot (no card def):', s.id); return false; }
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
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const migrated = applyMigrations(parsed);
    return sanitizeState(migrated);
  } catch (err) {
    console.error('[BinderVault] Failed to load state, using defaults:', err);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }));
    return { success: true };
  } catch (err) {
    console.error('[BinderVault] Failed to save state:', err);
    return { success: false, error: err };
  }
}

export function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); return { success: true }; }
  catch (err) { return { success: false, error: err }; }
}

export function getStorageUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    return Math.round((raw.length * 2) / 1024);
  } catch { return 0; }
}