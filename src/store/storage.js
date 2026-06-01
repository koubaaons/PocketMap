

import { validateBinder, validateCard, validateBinItem } from '../types/index.js';

const STORAGE_KEY = 'bindervault';
const SCHEMA_VERSION = 1;

// ─── Default state shape ──────────────────────────────────────────────────────

const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  binders: [],
  cards: [],
  bin: [],
};

// ─── Migration registry ───────────────────────────────────────────────────────
// Add a function here for each version bump, e.g.:
//   2: (state) => ({ ...state, newField: defaultValue, version: 2 })

const MIGRATIONS = {
  // 2: (state) => ({ ...state, version: 2 }),
};

function applyMigrations(state) {
  let current = state;
  let v = current.version ?? 0;
  while (MIGRATIONS[v + 1]) {
    console.info(`[BinderVault] Migrating storage from v${v} → v${v + 1}`);
    current = MIGRATIONS[v + 1](current);
    v = current.version;
  }
  return current;
}

// Sanitize loaded data ─────────────────────────────────────────────────────
// Filters out corrupt records so one bad entry never breaks the whole app.

function sanitizeState(raw) {
  const binders = (raw.binders ?? []).filter(b => {
    const { valid, errors } = validateBinder(b);
    if (!valid) console.warn('[BinderVault] Dropping corrupt binder:', errors, b);
    return valid;
  });

  const binderIds = new Set(binders.map(b => b.id));

  const cards = (raw.cards ?? []).filter(c => {
    const { valid, errors } = validateCard(c);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt card:', errors, c); return false; }
    if (!binderIds.has(c.binderId)) { console.warn('[BinderVault] Dropping orphan card (no binder):', c.id); return false; }
    return true;
  });

  const bin = (raw.bin ?? []).filter(c => {
    const { valid, errors } = validateBinItem(c);
    if (!valid) { console.warn('[BinderVault] Dropping corrupt bin item:', errors, c); return false; }
    return true;
  });

  return { ...raw, binders, cards, bin };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads state from storage. Returns DEFAULT_STATE on any failure.
 * @returns {{ version: number, binders: object[], cards: object[], bin: object[] }}
 */
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

/**
 * Persists state to storage.
 * @param {object} state
 * @returns {{ success: boolean, error?: Error }}
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: SCHEMA_VERSION }));
    return { success: true };
  } catch (err) {
    console.error('[BinderVault] Failed to save state:', err);
    return { success: false, error: err };
  }
}

/**
 * Wipes all stored data. Used for testing or user-requested reset.
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Returns estimated storage usage in KB.
 */
export function getStorageUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    return Math.round((raw.length * 2) / 1024); // UTF-16 = 2 bytes/char
  } catch {
    return 0;
  }
}