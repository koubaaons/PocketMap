// ─── Existing validators (unchanged) ─────────────────────────────────────────

export function validateBinder(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (!Number.isInteger(data.cols) || data.cols < 1 || data.cols > 10) errors.push('cols must be integer 1–10');
  if (!Number.isInteger(data.rows) || data.rows < 1 || data.rows > 10) errors.push('rows must be integer 1–10');
  if (!Number.isInteger(data.pages) || data.pages < 1 || data.pages > 500) errors.push('pages must be integer 1–500');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function validateCard(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.binderId || typeof data.binderId !== 'string') errors.push('binderId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (data.character !== undefined && typeof data.character !== 'string') errors.push('character must be a string');
  if (data.series !== undefined && typeof data.series !== 'string') errors.push('series must be a string');
  if (!Number.isInteger(data.page) || data.page < 1) errors.push('page must be a positive integer');
  if (!Number.isInteger(data.slot) || data.slot < 1) errors.push('slot must be a positive integer');
  if (typeof data.favorite !== 'boolean') errors.push('favorite must be a boolean');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function validateBinItem(data) {
  const cardResult = validateCard(data);
  if (!cardResult.valid) return cardResult;
  const errors = [];
  if (typeof data.deletedAt !== 'number') errors.push('deletedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

export function createBinder({ name, cols, rows, pages }) {
  const binder = {
    id: generateId(),
    name: (name || '').trim(),
    cols: Number(cols),
    rows: Number(rows),
    pages: Number(pages),
    createdAt: Date.now(),
  };
  const { valid, errors } = validateBinder(binder);
  return valid ? { binder, errors: [] } : { binder: null, errors };
}

export function createCard({ binderId, name, character = '', series = '', page, slot, favorite = false }) {
  const card = {
    id: generateId(),
    binderId,
    name: (name || '').trim(),
    character: (character || '').trim(),
    series: (series || '').trim(),
    page: Number(page),
    slot: Number(slot),
    favorite: Boolean(favorite),
    createdAt: Date.now(),
  };
  const { valid, errors } = validateCard(card);
  return valid ? { card, errors: [] } : { card: null, errors };
}




/**
 * Validates a Collection object.
 * No description field — keep it lean, add later if needed.
 */
export function validateCollection(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (typeof data.is_custom !== 'boolean') errors.push('is_custom must be a boolean');
  if (data.import_source !== null && typeof data.import_source !== 'string') errors.push('import_source must be a string or null');
  if (data.cover_image_url !== null && typeof data.cover_image_url !== 'string') errors.push('cover_image_url must be a string or null');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a TemplateField object.
 * Blueprint for what fields every card in a collection has.
 */
export function validateTemplateField(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.field_name || typeof data.field_name !== 'string' || !data.field_name.trim()) errors.push('field_name must be a non-empty string');
  if (!['text', 'number', 'boolean', 'select'].includes(data.field_type)) errors.push('field_type must be text | number | boolean | select');
  if (typeof data.is_required !== 'boolean') errors.push('is_required must be a boolean');
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a CardDefinition object.
 * Actual card in a collection — values stored in attributes JSONB.
 */
export function validateCardDefinition(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['Must be an object'] };
  if (!data.id || typeof data.id !== 'string') errors.push('id must be a non-empty string');
  if (!data.collectionId || typeof data.collectionId !== 'string') errors.push('collectionId must be a non-empty string');
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) errors.push('name must be a non-empty string');
  if (data.image_url !== null && typeof data.image_url !== 'string') errors.push('image_url must be a string or null');
  if (typeof data.attributes !== 'object' || data.attributes === null) errors.push('attributes must be an object');
  if (typeof data.createdAt !== 'number') errors.push('createdAt must be a timestamp');
  if (typeof data.updatedAt !== 'number') errors.push('updatedAt must be a timestamp');
  return { valid: errors.length === 0, errors };
}

/**
 * Creates a validated Collection.
 * Custom collections: is_custom=true, import_source=null
 * API collections:    is_custom=false, import_source='winx-api' etc.
 */
export function createCollection({ name, is_custom, import_source = null, cover_image_url = null }) {
  const now = Date.now();
  const collection = {
    id: generateId(),
    name: (name || '').trim(),
    is_custom: Boolean(is_custom),
    import_source: import_source ?? null,
    cover_image_url: cover_image_url ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCollection(collection);
  return valid ? { collection, errors: [] } : { collection: null, errors };
}

/**
 * Creates a validated TemplateField.
 */
export function createTemplateField({ collectionId, field_name, field_type = 'text', is_required = false }) {
  const field = {
    id: generateId(),
    collectionId,
    field_name: (field_name || '').trim(),
    field_type,
    is_required: Boolean(is_required),
  };
  const { valid, errors } = validateTemplateField(field);
  return valid ? { field, errors: [] } : { field: null, errors };
}

/**
 * Creates a validated CardDefinition.
 */
export function createCardDefinition({ collectionId, name, image_url = null, attributes = {} }) {
  const now = Date.now();
  const cardDef = {
    id: generateId(),
    collectionId,
    name: (name || '').trim(),
    image_url: image_url ?? null,
    attributes: attributes ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const { valid, errors } = validateCardDefinition(cardDef);
  return valid ? { cardDef, errors: [] } : { cardDef: null, errors };
}




// ─── Shared utilities ─────────────────────────────────────────────────────────

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sanitize(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}