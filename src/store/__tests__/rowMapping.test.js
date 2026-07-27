/**
 * @fileoverview Tests for the row<->object mapping functions in
 * supabaseStorage.js.
 *
 * Written after a real bug was found and fixed: collectionToRow and
 * cardDefinitionToRow both had field lists that predated
 * external_set_id/known_external_card_ids/provider_key/external_card_id
 * being added to the JS object shape — meaning those fields were
 * computed correctly client-side but silently dropped before ever
 * reaching Supabase, for every collection and card ever imported, not
 * just older ones. The same gap existed on the read side
 * (rowToCollection/rowToCardDefinition), so even a write-side-only fix
 * would have been useless — fixed correctly on save but appearing as
 * undefined again after every reload.
 *
 * That bug was specific to two entities, but the underlying RISK is
 * structural, not a one-off: every entity type has parallel
 * create/toRow/rowTo functions that all have to be manually kept in
 * sync by hand, with nothing enforcing that a new field added to one
 * gets added to the other two. This file now covers every entity
 * that has a toRow/rowTo pair (bin items are the only exception —
 * they reference other entities by id/type rather than storing a full
 * row of their own, so there's no round trip to check), explicitly
 * checking every real field the factory can produce — not just the
 * ones that have broken before — so a future field added to one side
 * and forgotten on the other gets caught here rather than discovered
 * by a user months later.
 */

import { describe, it, expect } from 'vitest';
import {
  collectionToRow, cardDefinitionToRow, rowToCollection, rowToCardDefinition,
  binderToRow, rowToBinder, binderSlotToRow, rowToBinderSlot,
  binderInsertToRow, rowToBinderInsert, binderPanelToRow, rowToBinderPanel,
  templateFieldToRow, rowToTemplateField, inventoryItemToRow, rowToInventoryItem,
} from '../supabaseStorage.js';

describe('collectionToRow', () => {
  const collection = {
    id: 'col-1', userId: 'user-1', name: 'Base Set', is_custom: false,
    import_source: 'Pokémon TCG: Base Set', cover_image_url: 'https://x/logo.png',
    external_set_id: 'base1', known_external_card_ids: ['base1-1', 'base1-2'], provider_key: 'tcgdex',
  };

  it('includes every field on the row, not just the older ones', () => {
    const row = collectionToRow(collection);

    expect(row.id).toBe('col-1');
    expect(row.user_id).toBe('user-1');
    expect(row.name).toBe('Base Set');
    expect(row.is_custom).toBe(false);
    expect(row.import_source).toBe('Pokémon TCG: Base Set');
    expect(row.cover_image_url).toBe('https://x/logo.png');
    expect(row.external_set_id).toBe('base1');
    expect(row.known_external_card_ids).toEqual(['base1-1', 'base1-2']);
    expect(row.provider_key).toBe('tcgdex');
  });

  it('defaults the newer fields sensibly for a custom collection that never had them at all', () => {
    const row = collectionToRow({ id: 'col-2', userId: 'user-1', name: 'My Custom Binder', is_custom: true });

    expect(row.external_set_id).toBe(null);
    expect(row.known_external_card_ids).toEqual([]);
    expect(row.provider_key).toBe(null);
  });
});

describe('rowToCollection', () => {
  const row = {
    id: 'col-1', user_id: 'user-1', name: 'Base Set', is_custom: false,
    import_source: 'Pokémon TCG: Base Set', cover_image_url: 'https://x/logo.png',
    external_set_id: 'base1', known_external_card_ids: ['base1-1', 'base1-2'], provider_key: 'tcgdex',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  };

  it('maps every field back from the row, not just the older ones', () => {
    const collection = rowToCollection(row);

    expect(collection.external_set_id).toBe('base1');
    expect(collection.known_external_card_ids).toEqual(['base1-1', 'base1-2']);
    expect(collection.provider_key).toBe('tcgdex');
  });

  it('defaults the newer fields sensibly when the row genuinely has none (pre-migration data)', () => {
    const collection = rowToCollection({
      id: 'col-2', user_id: 'user-1', name: 'Old Collection', is_custom: false,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });

    expect(collection.external_set_id).toBe(null);
    expect(collection.known_external_card_ids).toEqual([]);
    expect(collection.provider_key).toBe(null);
  });

  it('round-trips a full collection through collectionToRow then rowToCollection without losing any of the newer fields', () => {
    const original = {
      id: 'col-1', userId: 'user-1', name: 'Base Set', is_custom: false,
      import_source: 'Pokémon TCG: Base Set', cover_image_url: null,
      external_set_id: 'base1', known_external_card_ids: ['base1-1'], provider_key: 'tcgdex',
    };
    const asRow = { ...collectionToRow(original), created_at: '2026-01-01T00:00:00Z' };

    const roundTripped = rowToCollection(asRow);

    expect(roundTripped.external_set_id).toBe('base1');
    expect(roundTripped.known_external_card_ids).toEqual(['base1-1']);
    expect(roundTripped.provider_key).toBe('tcgdex');
  });
});

describe('cardDefinitionToRow', () => {
  it('includes external_card_id on the row', () => {
    const row = cardDefinitionToRow({
      id: 'cd-1', userId: 'user-1', collectionId: 'col-1', name: 'Pikachu',
      image_url: null, holoType: 'none', rarity: 'Common', isDecluttered: false, attributes: {},
      external_card_id: 'base1-1',
    });

    expect(row.external_card_id).toBe('base1-1');
  });

  it('defaults external_card_id to null for a custom card that never had one', () => {
    const row = cardDefinitionToRow({ id: 'cd-1', userId: 'user-1', collectionId: 'col-1', name: 'Custom Card' });

    expect(row.external_card_id).toBe(null);
  });
});

describe('rowToCardDefinition', () => {
  it('maps external_card_id back from the row', () => {
    const cardDef = rowToCardDefinition({
      id: 'cd-1', user_id: 'user-1', collection_id: 'col-1', name: 'Pikachu',
      external_card_id: 'base1-1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });

    expect(cardDef.external_card_id).toBe('base1-1');
  });

  it('defaults external_card_id to null when the row genuinely has none (pre-migration data)', () => {
    const cardDef = rowToCardDefinition({
      id: 'cd-1', user_id: 'user-1', collection_id: 'col-1', name: 'Custom Card',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    });

    expect(cardDef.external_card_id).toBe(null);
  });

  it('round-trips through cardDefinitionToRow then rowToCardDefinition without losing external_card_id', () => {
    const original = {
      id: 'cd-1', userId: 'user-1', collectionId: 'col-1', name: 'Pikachu',
      image_url: null, holoType: 'none', rarity: 'Common', isDecluttered: false, attributes: {},
      external_card_id: 'base1-1',
    };
    const asRow = { ...cardDefinitionToRow(original), created_at: '2026-01-01T00:00:00Z' };

    const roundTripped = rowToCardDefinition(asRow);

    expect(roundTripped.external_card_id).toBe('base1-1');
  });
});

describe('binder round trip', () => {
  const original = {
    id: 'binder-1', userId: 'user-1', name: 'My Binder', cols: 3, rows: 3, pages: 10,
    cover_color: '#123456', page_color: '#1e1e1e', stickers: [{ id: 's1', image_url: 'x', x: 10, y: 10, scale: 1 }],
  };

  it('carries every field through binderToRow', () => {
    const row = binderToRow(original);
    expect(row).toMatchObject({
      id: 'binder-1', user_id: 'user-1', name: 'My Binder', cols: 3, rows: 3, pages: 10,
      cover_color: '#123456', page_color: '#1e1e1e', stickers: original.stickers,
    });
  });

  it('round-trips every field back through rowToBinder', () => {
    const asRow = { ...binderToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToBinder(asRow);

    expect(roundTripped.userId).toBe('user-1');
    expect(roundTripped.name).toBe('My Binder');
    expect(roundTripped.cols).toBe(3);
    expect(roundTripped.rows).toBe(3);
    expect(roundTripped.pages).toBe(10);
    expect(roundTripped.cover_color).toBe('#123456');
    expect(roundTripped.page_color).toBe('#1e1e1e');
    expect(roundTripped.stickers).toEqual(original.stickers);
  });
});

describe('binderSlot round trip', () => {
  const original = {
    id: 'slot-1', userId: 'user-1', binderId: 'binder-1', cardDefId: 'card-1',
    collectionId: 'col-1', pageNumber: 2, slotIndex: 5, inventoryItemId: 'inv-1',
  };

  it('carries every field through binderSlotToRow', () => {
    const row = binderSlotToRow(original);
    expect(row).toMatchObject({
      id: 'slot-1', user_id: 'user-1', binder_id: 'binder-1', card_def_id: 'card-1',
      collection_id: 'col-1', page_number: 2, slot_index: 5, inventory_item_id: 'inv-1',
    });
  });

  it('round-trips every field back through rowToBinderSlot', () => {
    const asRow = { ...binderSlotToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToBinderSlot(asRow);

    expect(roundTripped.binderId).toBe('binder-1');
    expect(roundTripped.cardDefId).toBe('card-1');
    expect(roundTripped.collectionId).toBe('col-1');
    expect(roundTripped.pageNumber).toBe(2);
    expect(roundTripped.slotIndex).toBe(5);
    expect(roundTripped.inventoryItemId).toBe('inv-1');
  });

  it('round-trips a null inventoryItemId (a missing placeholder, not an owned copy) correctly, not as undefined', () => {
    const asRow = { ...binderSlotToRow({ ...original, inventoryItemId: null }), created_at: '2026-01-01T00:00:00Z' };
    expect(rowToBinderSlot(asRow).inventoryItemId).toBe(null);
  });
});

describe('binderInsert round trip', () => {
  const original = { id: 'insert-1', userId: 'user-1', name: 'My Sticker Sheet', image_url: 'https://x/sheet.jpg' };

  it('carries every field through binderInsertToRow', () => {
    expect(binderInsertToRow(original)).toMatchObject({
      id: 'insert-1', user_id: 'user-1', name: 'My Sticker Sheet', image_url: 'https://x/sheet.jpg',
    });
  });

  it('round-trips every field back through rowToBinderInsert', () => {
    const asRow = { ...binderInsertToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToBinderInsert(asRow);

    expect(roundTripped.name).toBe('My Sticker Sheet');
    expect(roundTripped.image_url).toBe('https://x/sheet.jpg');
  });
});

describe('binderPanel round trip', () => {
  const original = {
    id: 'panel-1', userId: 'user-1', binderId: 'binder-1', pageNumber: 1,
    startSlotIndex: 0, spanCols: 2, spanRows: 1, panelType: 'card',
    cardDefId: 'card-1', insertId: null, inventoryItemId: 'inv-1',
    imageX: 25, imageY: 75, imageScale: 1.5,
  };

  it('carries every field through binderPanelToRow', () => {
    const row = binderPanelToRow(original);
    expect(row).toMatchObject({
      id: 'panel-1', user_id: 'user-1', binder_id: 'binder-1', page_number: 1,
      start_slot_index: 0, span_cols: 2, span_rows: 1, panel_type: 'card',
      card_def_id: 'card-1', insert_id: null, inventory_item_id: 'inv-1',
      image_x: 25, image_y: 75, image_scale: 1.5,
    });
  });

  it('round-trips every field back through rowToBinderPanel', () => {
    const asRow = { ...binderPanelToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToBinderPanel(asRow);

    expect(roundTripped.binderId).toBe('binder-1');
    expect(roundTripped.pageNumber).toBe(1);
    expect(roundTripped.startSlotIndex).toBe(0);
    expect(roundTripped.spanCols).toBe(2);
    expect(roundTripped.spanRows).toBe(1);
    expect(roundTripped.panelType).toBe('card');
    expect(roundTripped.cardDefId).toBe('card-1');
    expect(roundTripped.inventoryItemId).toBe('inv-1');
    expect(roundTripped.imageX).toBe(25);
    expect(roundTripped.imageY).toBe(75);
    expect(roundTripped.imageScale).toBe(1.5);
  });
});

describe('templateField round trip', () => {
  const original = {
    id: 'tf-1', collectionId: 'col-1', field_name: 'Rarity', field_type: 'select',
    is_required: true, order: 2, options: ['Common', 'Rare'],
  };

  it('carries every field through templateFieldToRow', () => {
    const row = templateFieldToRow(original);
    expect(row).toMatchObject({
      id: 'tf-1', collection_id: 'col-1', field_name: 'Rarity', field_type: 'select',
      is_required: true, field_order: 2, options: ['Common', 'Rare'],
    });
  });

  it('round-trips every field back through rowToTemplateField', () => {
    const asRow = { ...templateFieldToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToTemplateField(asRow);

    expect(roundTripped.collectionId).toBe('col-1');
    expect(roundTripped.field_name).toBe('Rarity');
    expect(roundTripped.field_type).toBe('select');
    expect(roundTripped.is_required).toBe(true);
    expect(roundTripped.order).toBe(2);
    expect(roundTripped.options).toEqual(['Common', 'Rare']);
  });
});

describe('inventoryItem round trip', () => {
  // Deliberately uses camelCase-style JS field names (acquired_at,
  // personal_notes, is_tradeable, is_sellable) — this entity's row
  // column names genuinely differ from the JS field names
  // (date_acquired, notes, available_for_trade, available_for_sale),
  // not just a snake_case conversion, so this is exactly the kind of
  // mapping most likely to silently drift if a new field is ever
  // added without updating both sides.
  const original = {
    id: 'inv-1', userId: 'user-1', cardDefId: 'card-1', collectionId: 'col-1',
    condition_rating: 'Near Mint', language: 'English', label: 'Alt Art',
    is_tradeable: true, is_sellable: false, is_favorite: true,
    personal_notes: 'Bought at a show', acquired_at: 1700000000000,
  };

  it('carries every field through inventoryItemToRow, including the renamed ones', () => {
    const row = inventoryItemToRow(original);
    expect(row).toMatchObject({
      id: 'inv-1', user_id: 'user-1', card_def_id: 'card-1', collection_id: 'col-1',
      condition_rating: 'Near Mint', language: 'English', label: 'Alt Art',
      available_for_trade: true, available_for_sale: false, is_favorite: true,
      notes: 'Bought at a show', date_acquired: 1700000000000,
    });
  });

  it('round-trips every field back through rowToInventoryItem, including the renamed ones', () => {
    const asRow = { ...inventoryItemToRow(original), created_at: '2026-01-01T00:00:00Z' };
    const roundTripped = rowToInventoryItem(asRow);

    expect(roundTripped.cardDefId).toBe('card-1');
    expect(roundTripped.collectionId).toBe('col-1');
    expect(roundTripped.condition_rating).toBe('Near Mint');
    expect(roundTripped.language).toBe('English');
    expect(roundTripped.label).toBe('Alt Art');
    expect(roundTripped.is_tradeable).toBe(true);
    expect(roundTripped.is_sellable).toBe(false);
    expect(roundTripped.is_favorite).toBe(true);
    expect(roundTripped.personal_notes).toBe('Bought at a show');
    expect(roundTripped.acquired_at).toBe(1700000000000);
  });
});