/**
 * @fileoverview Supabase storage layer — all Supabase read/write concerns.
 *
 * Extracted from store/storage.js (Issue #123 pre-M12 refactor) so that
 * adding new entity types in Milestone 12 (Pokémon sets, Yu-Gi-Oh, etc.)
 * only touches this file. storage.js keeps only localStorage functions
 * and stays stable across all future milestones.
 *
 * Contains:
 *   - rowTo*    mappers: Supabase snake_case row → JS camelCase entity
 *   - *ToRow    converters: JS entity → Supabase snake_case row
 *   - loadStateFromSupabase: parallel fetch of all 7 tables
 */

import { supabase } from '../services/supabase.js';
import { backfillUnlinkedSlots } from '../utils/backfillUnlinkedSlots.js';

const SCHEMA_VERSION = 2;

// ── rowTo* mappers ────────────────────────────────────────────────────────────
// Convert Supabase snake_case rows back to the JS shape the store expects.

export function rowToBinder(row) {
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

export function rowToBinderSlot(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    binderId:     row.binder_id,
    cardDefId:    row.card_def_id,
    collectionId: row.collection_id,
    pageNumber:   row.page_number,
    slotIndex:    row.slot_index,
    inventoryItemId: row.inventory_item_id,
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

// === Michi Method support: combined slots ===
export function rowToBinderInsert(row) {
  return {
    id:        row.id,
    userId:    row.user_id,
    name:      row.name,
    image_url: row.image_url,
    image_size_bytes: row.image_size_bytes ?? null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function rowToBinderPanel(row) {
  return {
    id:             row.id,
    userId:         row.user_id,
    binderId:       row.binder_id,
    pageNumber:     row.page_number,
    startSlotIndex: row.start_slot_index,
    spanCols:       row.span_cols,
    spanRows:       row.span_rows,
    panelType:      row.panel_type,
    cardDefId:      row.card_def_id,
    insertId:       row.insert_id,
    inventoryItemId: row.inventory_item_id,
    imageX:         row.image_x,
    imageY:         row.image_y,
    imageScale:     row.image_scale,
    createdAt:      new Date(row.created_at).getTime(),
  };
}

export function rowToCollection(row) {
  return {
    id:              row.id,
    userId:          row.user_id,
    name:            row.name,
    is_custom:       row.is_custom,
    import_source:   row.import_source,
    cover_image_url: row.cover_image_url,
    external_set_id: row.external_set_id ?? null,
    known_external_card_ids: row.known_external_card_ids ?? [],
    provider_key:    row.provider_key ?? null,
    createdAt:       new Date(row.created_at).getTime(),
    updatedAt:       new Date(row.updated_at).getTime(),
  };
}

export function rowToTemplateField(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    collectionId: row.collection_id,
    // Keep both naming conventions so existing code works regardless
    fieldName:    row.field_name,
    field_name:   row.field_name,
    fieldType:    row.field_type,
    field_type:   row.field_type,
    isRequired:   row.is_required,
    is_required:  row.is_required,
    order:        row.field_order,
    options:      row.options ?? [],
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

export function rowToCardDefinition(row) {
  return {
    id:           row.id,
    userId:       row.user_id,
    collectionId: row.collection_id,
    name:         row.name,
    image_url:    row.image_url,
    holoType:     row.holo_type,
    rarity:       row.rarity,
    isDecluttered: row.is_decluttered ?? false,
    attributes:   row.attributes ?? {},
    external_card_id: row.external_card_id ?? null,
    image_size_bytes: row.image_size_bytes ?? null,
    createdAt:    new Date(row.created_at).getTime(),
    updatedAt:    new Date(row.updated_at).getTime(),
  };
}

export function rowToInventoryItem(row) {
  return {
    id:                  row.id,
    userId:              row.user_id,
    cardDefId:           row.card_def_id,
    collectionId:        row.collection_id,
    is_favorite:         row.is_favorite,
    condition_rating:    row.condition_rating,
    language:            row.language,
    label:               row.label,
    // Map Supabase column names back to JS field names — keep both
    // naming conventions so existing code reading either still works
    acquired_at:         row.date_acquired,
    personal_notes:      row.notes,
    is_tradeable:        row.available_for_trade,
    is_sellable:         row.available_for_sale,
    date_acquired:       row.date_acquired,
    notes:               row.notes,
    available_for_trade: row.available_for_trade,
    available_for_sale:  row.available_for_sale,
    createdAt:           new Date(row.created_at).getTime(),
    updatedAt:           new Date(row.updated_at).getTime(),
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

// ── loadStateFromSupabase ─────────────────────────────────────────────────────

/**
 * Loads ALL user data from Supabase in parallel.
 * Filters deleted_at IS NULL so soft-deleted rows are invisible to the app.
 * Returns the same shape as loadState() so the store can use it directly.
 * Returns null if any fetch fails — caller falls back to localStorage.
 */
export async function loadStateFromSupabase() {
  try {
    const [
      bindersRes,
      slotsRes,
      insertsRes,
      panelsRes,
      collectionsRes,
      fieldsRes,
      cardsRes,
      inventoryRes,
      binRes,
    ] = await Promise.all([
      supabase.from('binders').select('*').is('deleted_at', null),
      supabase.from('binder_slots').select('*'),
      supabase.from('binder_inserts').select('*').is('deleted_at', null),
      supabase.from('binder_panels').select('*'),
      supabase.from('collections').select('*').is('deleted_at', null),
      supabase.from('template_fields').select('*'),
      supabase.from('card_definitions').select('*').is('deleted_at', null),
      supabase.from('user_inventory').select('*').is('deleted_at', null),
      supabase.from('bin').select('*'),
    ]);

    const errors = [bindersRes, slotsRes, insertsRes, panelsRes, collectionsRes, fieldsRes, cardsRes, inventoryRes, binRes]
      .filter(r => r.error)
      .map(r => r.error);

    if (errors.length > 0) {
      console.error('[SupabaseStorage] Load errors:', errors);
      return null;
    }

    const inventory   = (inventoryRes.data ?? []).map(rowToInventoryItem);
    const rawSlots    = (slotsRes.data ?? []).map(rowToBinderSlot);
    const rawPanels   = (panelsRes.data ?? []).map(rowToBinderPanel);

    // === FIX (real bug reported directly by the user: owned cards
    // turning grey on every refresh) — see backfillUnlinkedSlots.js's
    // own header comment for the full explanation. This is the
    // critical spot for this fix, since this Supabase-backed path is
    // what most users actually load through. ===
    const { binderSlots, binderPanels } = backfillUnlinkedSlots(inventory, rawSlots, rawPanels);

    return {
      version:         SCHEMA_VERSION,
      binders:         (bindersRes.data ?? []).map(rowToBinder),
      binderSlots,
      binderInserts:   (insertsRes.data ?? []).map(rowToBinderInsert),
      binderPanels,
      collections:     (collectionsRes.data ?? []).map(rowToCollection),
      templateFields:  (fieldsRes.data ?? []).map(rowToTemplateField),
      cardDefinitions: (cardsRes.data ?? []).map(rowToCardDefinition),
      inventory,
      bin:             (binRes.data ?? []).map(rowToBinItem),
    };
  } catch (err) {
    console.error('[SupabaseStorage] Load failed:', err);
    return null;
  }
}

// ── *ToRow converters ─────────────────────────────────────────────────────────
// Convert JS entities to Supabase snake_case rows for writes.
// user_id is always injected by supabaseSync.js using getRealUserId()
// rather than trusting whatever userId is stored on the entity.

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
    inventory_item_id: slot.inventoryItemId ?? null,
    updated_at:    new Date().toISOString(),
  };
}

// === Michi Method support: combined slots ===
export function binderInsertToRow(insert) {
  return {
    id:        insert.id,
    user_id:   insert.userId,
    name:      insert.name,
    image_url: insert.image_url,
    image_size_bytes: insert.image_size_bytes ?? null,
  };
}

export function binderPanelToRow(panel) {
  return {
    id:               panel.id,
    user_id:          panel.userId,
    binder_id:        panel.binderId,
    page_number:      panel.pageNumber,
    start_slot_index: panel.startSlotIndex,
    span_cols:        panel.spanCols,
    span_rows:        panel.spanRows,
    panel_type:       panel.panelType,
    card_def_id:      panel.cardDefId,
    insert_id:        panel.insertId,
    inventory_item_id: panel.inventoryItemId ?? null,
    image_x:          panel.imageX,
    image_y:          panel.imageY,
    image_scale:      panel.imageScale,
  };
}

export function collectionToRow(collection) {
  return {
    id:                       collection.id,
    user_id:                  collection.userId,
    name:                     collection.name,
    is_custom:                collection.is_custom,
    import_source:            collection.import_source ?? null,
    cover_image_url:          collection.cover_image_url ?? null,
    external_set_id:          collection.external_set_id ?? null,
    known_external_card_ids:  collection.known_external_card_ids ?? [],
    provider_key:             collection.provider_key ?? null,
    updated_at:               new Date().toISOString(),
  };
}

export function templateFieldToRow(field) {
  return {
    id:            field.id,
    user_id:       field.userId,
    collection_id: field.collectionId,
    // Handle both snake_case (from factory) and camelCase (from older code)
    field_name:    field.field_name ?? field.fieldName,
    field_type:    field.field_type ?? field.fieldType,
    is_required:   field.is_required ?? field.isRequired ?? false,
    field_order:   field.order ?? 0,
    options:       field.options ?? [],
    updated_at:    new Date().toISOString(),
  };
}

export function cardDefinitionToRow(cd) {
  // === ISSUE #125: never write raw base64 to image_url again. The
  // real fix is the upload flow itself (CardDefinitionForm.jsx uploads
  // to Storage and stores the returned URL) — this is just a loud,
  // fail-fast safety net in case some future code path regresses back
  // to setting image_url directly from compressImage()'s base64 output. ===
  if (cd.image_url && cd.image_url.startsWith('data:')) {
    console.error(
      '[Pinder] cardDefinitionToRow received a base64 image_url — this should never happen after Issue #125. ' +
      'Upload the image to Storage first and pass its public URL instead.'
    );
  }

  return {
    id:            cd.id,
    user_id:       cd.userId,
    collection_id: cd.collectionId,
    name:          cd.name,
    image_url:     cd.image_url ?? null,
    holo_type:     cd.holoType ?? 'none',
    rarity:        cd.rarity ?? null,
    is_decluttered: cd.isDecluttered ?? false,
    attributes:    cd.attributes ?? {},
    external_card_id: cd.external_card_id ?? null,
    image_size_bytes: cd.image_size_bytes ?? null,
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
    language:            item.language ?? null,
    label:               item.label ?? null,
    // Handle both JS naming conventions
    date_acquired:       item.acquired_at ?? item.date_acquired ?? null,
    notes:               item.personal_notes ?? item.notes ?? null,
    available_for_trade: item.is_tradeable ?? item.available_for_trade ?? false,
    available_for_sale:  item.is_sellable  ?? item.available_for_sale  ?? false,
    updated_at:          new Date().toISOString(),
  };
}