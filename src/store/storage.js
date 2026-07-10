/**
 * @fileoverview Storage Repository — abstracts all persistence concerns.
 * Swap localStorage for AsyncStorage (React Native) by changing only this file.
 *
 * === Issue #115: Supabase API Layer ===
 * Added loadStateFromSupabase() and saveStateToSupabase() alongside the
 * existing localStorage functions. The app now loads from Supabase on
 * startup (via useSupabaseSync.js) and falls back to localStorage if
 * Supabase is unavailable. Issue #116 wires per-entity writes.
 */

import {
  validateBinder,
  validateCollection, validateTemplateField, validateCardDefinition,
  validateInventoryItem, validateBinderSlot,
} from '../types/index.js';
import { supabase } from '../services/supabase.js';

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
    console.info(`[BinderVault] Migrating storage from v${v} → v${v + 1}`);
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
    b.stickers = b.stickers.map(s => (typeof s.size === 'number' ? s : { ...s, size: 17.5 }));
    const { valid, errors } = validateBinder(b);
    if (!valid) console.warn('[BinderVault] Dropping corrupt binder:', errors, b);
    return valid;
  });

  const binderIds = new Set(binders.map(b => b.id));

  const collections = (raw.collections ?? []).filter(c => {
    const { valid, errors } = validateCollection(c);
    if (!valid) console.warn('[BinderVault] Dropping corrupt collection:', errors, c);
    return valid;
  });

  const collectionIds = new Set(collections.map(c => c.id));

  const templateFields = (raw.templateFields ?? []).filter(f => {
    const { valid, errors } = validateTemplateField(f);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt template field:', errors, f); return false; }
    if (!collectionIds.has(f.collectionId)) { console.warn('[BinderVault] Dropping orphan template field:', f.id); return false; }
    return true;
  });

  const cardDefinitions = (raw.cardDefinitions ?? []).filter(cd => {
    const { valid, errors } = validateCardDefinition(cd);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt card definition:', errors, cd); return false; }
    if (!collectionIds.has(cd.collectionId)) { console.warn('[BinderVault] Dropping orphan card definition:', cd.id); return false; }
    return true;
  });

  const cardDefIds = new Set(cardDefinitions.map(cd => cd.id));

  const inventory = (raw.inventory ?? []).filter(inv => {
    const { valid, errors } = validateInventoryItem(inv);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt inventory item:', errors, inv); return false; }
    if (!cardDefIds.has(inv.cardDefId)) { console.warn('[BinderVault] Dropping orphan inventory item:', inv.id); return false; }
    return true;
  });

  const binderSlots = (raw.binderSlots ?? []).filter(s => {
    const { valid, errors } = validateBinderSlot(s);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt binder slot:', errors, s); return false; }
    if (!binderIds.has(s.binderId)) { console.warn('[BinderVault] Dropping orphan binder slot (no binder):', s.id); return false; }
    if (!cardDefIds.has(s.cardDefId)) { console.warn('[BinderVault] Dropping orphan binder slot (no card def):', s.id); return false; }
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

// ── localStorage (existing, unchanged) ────────────────────────────────────────

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

// ── Supabase (Issue #115) ──────────────────────────────────────────────────────

/**
 * Maps a Supabase binder row back to the JS shape the store expects.
 * Supabase uses snake_case column names and timestamptz — we need the
 * same camelCase + numeric timestamps the existing type system uses.
 */
function rowToBinder(row) {
  return {
    id:          row.id,
    userId:      row.user_id,
    name:        row.name,
    rows:        row.rows,
    cols:        row.cols,
    pages:       row.pages,
    cover_color: row.cover_color,
    page_color:  row.page_color,
    stickers:    row.stickers ?? [],
    createdAt:   new Date(row.created_at).getTime(),
    updatedAt:   new Date(row.updated_at).getTime(),
  };
}

function rowToBinderSlot(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    binderId:     row.binder_id,
    cardDefId:    row.card_def_id,
    collectionId: row.collection_id,
    pageNumber:   row.page_number,
    slotIndex:    row.slot_index,
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

function rowToCollection(row) {
  return {
    id:              row.id,
    userId:          row.user_id,
    name:            row.name,
    is_custom:       row.is_custom,
    import_source:   row.import_source,
    cover_image_url: row.cover_image_url,
    createdAt:       new Date(row.created_at).getTime(),
    updatedAt:       new Date(row.updated_at).getTime(),
  };
}

function rowToTemplateField(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    collectionId: row.collection_id,
    fieldName:    row.field_name,
    fieldType:    row.field_type,
    isRequired:   row.is_required,
    order:        row.field_order,
    options:      row.options ?? [],
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

function rowToCardDefinition(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    collectionId: row.collection_id,
    name:         row.name,
    image_url:    row.image_url,
    holoType:     row.holo_type,
    attributes:   row.attributes ?? {},
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

function rowToInventoryItem(row) {
  return {
    id:                 row.id,
    userId:             row.user_id,
    cardDefId:          row.card_def_id,
    collectionId:       row.collection_id,
    is_favorite:        row.is_favorite,
    condition_rating:   row.condition_rating,
    date_acquired:      row.date_acquired,
    notes:              row.notes,
    available_for_trade: row.available_for_trade,
    available_for_sale:  row.available_for_sale,
    createdAt:          new Date(row.created_at).getTime(),
    updatedAt:          new Date(row.updated_at).getTime(),
  };
}

function rowToBinItem(row) {
  return {
    ...row.snapshot,
    _supabaseBinId: row.id,
    _type:          row.entity_type,
    deletedAt:      new Date(row.deleted_at).getTime(),
  };
}

/**
 * Loads ALL user data from Supabase in parallel.
 * Returns the same shape as loadState() so the store can use it directly.
 * Returns null if any fetch fails, so the caller can fall back to localStorage.
 */
export async function loadStateFromSupabase() {
  try {
    const [
      bindersRes,
      slotsRes,
      collectionsRes,
      fieldsRes,
      cardsRes,
      inventoryRes,
      binRes,
    ] = await Promise.all([
      supabase.from('binders').select('*'),
      supabase.from('binder_slots').select('*'),
      supabase.from('collections').select('*'),
      supabase.from('template_fields').select('*'),
      supabase.from('card_definitions').select('*'),
      supabase.from('user_inventory').select('*'),
      supabase.from('bin').select('*'),
    ]);

    // If any fetch errored, bail out and let the caller fall back
    const errors = [bindersRes, slotsRes, collectionsRes, fieldsRes, cardsRes, inventoryRes, binRes]
      .filter(r => r.error)
      .map(r => r.error);

    if (errors.length > 0) {
      console.error('[BinderVault] Supabase load errors:', errors);
      return null;
    }

    return {
      version:         SCHEMA_VERSION,
      binders:         (bindersRes.data ?? []).map(rowToBinder),
      binderSlots:     (slotsRes.data ?? []).map(rowToBinderSlot),
      collections:     (collectionsRes.data ?? []).map(rowToCollection),
      templateFields:  (fieldsRes.data ?? []).map(rowToTemplateField),
      cardDefinitions: (cardsRes.data ?? []).map(rowToCardDefinition),
      inventory:       (inventoryRes.data ?? []).map(rowToInventoryItem),
      bin:             (binRes.data ?? []).map(rowToBinItem),
    };
  } catch (err) {
    console.error('[BinderVault] Supabase load failed:', err);
    return null;
  }
}

/**
 * Converts a JS binder object to the Supabase row shape.
 * Used by the per-entity write functions in Issue #116.
 */
export function binderToRow(binder) {
  return {
    id:          binder.id,
    user_id:     binder.userId,
    name:        binder.name,
    rows:        binder.rows,
    cols:        binder.cols,
    pages:       binder.pages,
    cover_color: binder.cover_color,
    page_color:  binder.page_color,
    stickers:    binder.stickers ?? [],
    updated_at:  new Date().toISOString(),
  };
}

export function binderSlotToRow(slot) {
  return {
    id:            slot.id,
    user_id:       slot.userId,
    binder_id:     slot.binderId,
    card_def_id:   slot.cardDefId,
    collection_id: slot.collectionId,
    page_number:   slot.pageNumber,
    slot_index:    slot.slotIndex,
    updated_at:    new Date().toISOString(),
  };
}

export function collectionToRow(collection) {
  return {
    id:              collection.id,
    user_id:         collection.userId,
    name:            collection.name,
    is_custom:       collection.is_custom,
    import_source:   collection.import_source ?? null,
    cover_image_url: collection.cover_image_url ?? null,
    updated_at:      new Date().toISOString(),
  };
}

export function templateFieldToRow(field) {
  return {
    id:            field.id,
    user_id:       field.userId,
    collection_id: field.collectionId,
    field_name:    field.fieldName,
    field_type:    field.fieldType,
    is_required:   field.isRequired ?? false,
    field_order:   field.order ?? 0,
    options:       field.options ?? [],
    updated_at:    new Date().toISOString(),
  };
}

export function cardDefinitionToRow(cd) {
  return {
    id:            cd.id,
    user_id:       cd.userId,
    collection_id: cd.collectionId,
    name:          cd.name,
    image_url:     cd.image_url ?? null,
    holo_type:     cd.holoType ?? 'none',
    attributes:    cd.attributes ?? {},
    updated_at:    new Date().toISOString(),
  };
}

export function inventoryItemToRow(item) {
  return {
    id:                  item.id,
    user_id:             item.userId,
    card_def_id:         item.cardDefId,
    collection_id:       item.collectionId,
    is_favorite:         item.is_favorite ?? false,
    condition_rating:    item.condition_rating ?? null,
    date_acquired:       item.date_acquired ?? null,
    notes:               item.notes ?? null,
    available_for_trade: item.available_for_trade ?? false,
    available_for_sale:  item.available_for_sale ?? false,
    updated_at:          new Date().toISOString(),
  };
}