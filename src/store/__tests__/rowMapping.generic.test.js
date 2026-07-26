/**
 * @fileoverview Generic round-trip test for every *ToRow / rowTo* mapper pair.
 *
 * rowMapping.test.js (the original file) hand-checks the specific fields
 * that broke once (collections, cardDefinitions). That's exactly the gap
 * called out at the time it was written: it only catches a REPEAT of the
 * same known bug, not the same CLASS of bug showing up on a different
 * entity or a different field next time someone adds one.
 *
 * This file is the generic version: for every entity, take a real object
 * fresh out of its own create*() factory, push it through *ToRow then
 * rowTo*, and assert every single key the factory produced survived the
 * round trip with its original value. Nothing here names a specific
 * field — it just diffs whatever the factory happens to produce against
 * whatever comes back out. Add a field to a factory and forget to wire
 * it into both mapper halves, and the very next test run fails here,
 * without anyone having to remember to hand-write a new assertion for it.
 *
 * bin/rowToBinItem is deliberately excluded — it's a snapshot ({ ...row.
 * snapshot, ... }) of whatever entity was soft-deleted into it, not a
 * symmetric createX/XToRow/rowToX triple like the others, so this
 * generic shape doesn't apply to it.
 */

import { describe, it, expect } from 'vitest';
import {
  binderToRow, rowToBinder,
  binderSlotToRow, rowToBinderSlot,
  binderInsertToRow, rowToBinderInsert,
  binderPanelToRow, rowToBinderPanel,
  collectionToRow, rowToCollection,
  templateFieldToRow, rowToTemplateField,
  cardDefinitionToRow, rowToCardDefinition,
  inventoryItemToRow, rowToInventoryItem,
} from '../supabaseStorage.js';
import {
  createBinder,
  createBinderSlot,
  createBinderInsert,
  createBinderPanel,
  createCollection,
  createTemplateField,
  createCardDefinition,
  createInventoryItem,
} from '../../types/index.js';

/**
 * Pushes `original` through toRow() then fromRow(), injecting created_at/
 * updated_at onto the row first (since *ToRow never sets created_at, and
 * some don't set updated_at either — both are normally left to Postgres
 * defaults/triggers on a real insert). Returns the round-tripped object.
 */
function roundTrip(original, toRow, fromRow) {
  const row = {
    ...toRow(original),
    created_at: new Date(original.createdAt ?? Date.now()).toISOString(),
    updated_at: new Date(original.updatedAt ?? original.createdAt ?? Date.now()).toISOString(),
  };
  return fromRow(row);
}

/**
 * The actual generic check: every key present on the freshly-created
 * object must come back out of the round trip with an equal value.
 * This is deliberately NOT a hand-picked field list — it's whatever
 * keys the factory happens to produce today, so a newly-added field
 * is covered automatically without this test file needing an edit.
 */
function expectSurvivesRoundTrip(original, toRow, fromRow) {
  const roundTripped = roundTrip(original, toRow, fromRow);
  for (const key of Object.keys(original)) {
    expect(roundTripped, `field "${key}" did not survive the round trip`).toHaveProperty(key);
    expect(roundTripped[key], `field "${key}" changed value across the round trip`).toEqual(original[key]);
  }
}

describe('generic round-trip: every factory-created entity survives ToRow -> rowTo unchanged', () => {
  it('Binder', () => {
    const { binder, errors } = createBinder({ name: 'Base Set Binder', cols: 3, rows: 3, pages: 10 });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(binder, binderToRow, rowToBinder);
  });

  it('BinderSlot', () => {
    const { slot, errors } = createBinderSlot({
      binderId: 'binder-1', cardDefId: 'cd-1', collectionId: 'col-1',
      pageNumber: 1, slotIndex: 0, inventoryItemId: 'inv-1',
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(slot, binderSlotToRow, rowToBinderSlot);
  });

  it('BinderInsert', () => {
    const { insert, errors } = createBinderInsert({ name: 'Holo Foil Background', image_url: 'https://x/insert.png' });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(insert, binderInsertToRow, rowToBinderInsert);
  });

  it('BinderPanel', () => {
    const { panel, errors } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0,
      spanCols: 2, spanRows: 2, panelType: 'card', cardDefId: 'cd-1', inventoryItemId: 'inv-1',
      imageX: 40, imageY: 60, imageScale: 1.5,
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(panel, binderPanelToRow, rowToBinderPanel);
  });

  it('Collection', () => {
    const { collection, errors } = createCollection({
      name: 'Base Set', is_custom: false, import_source: 'Pokémon TCG: Base Set',
      cover_image_url: 'https://x/logo.png', external_set_id: 'base1',
      known_external_card_ids: ['base1-1', 'base1-2'], provider_key: 'tcgdex',
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(collection, collectionToRow, rowToCollection);
  });

  it('TemplateField', () => {
    const { field, errors } = createTemplateField({
      collectionId: 'col-1', field_name: 'Condition', field_type: 'select',
      is_required: true, order: 2, options: ['Mint', 'Played'],
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(field, templateFieldToRow, rowToTemplateField);
  });

  it('CardDefinition', () => {
    const { cardDef, errors } = createCardDefinition({
      collectionId: 'col-1', name: 'Pikachu', image_url: 'https://x/pikachu.png',
      attributes: { HP: 60 }, holoType: 'foil', rarity: 'Rare', isDecluttered: true,
      external_card_id: 'base1-4',
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(cardDef, cardDefinitionToRow, rowToCardDefinition);
  });

  it('InventoryItem', () => {
    const { item, errors } = createInventoryItem({
      cardDefId: 'cd-1', collectionId: 'col-1', condition_rating: 'near_mint',
      language: 'japanese', label: '1st Edition', is_tradeable: true,
      is_sellable: true, is_favorite: true, personal_notes: 'Slight whitening on back',
      acquired_at: Date.now(),
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(item, inventoryItemToRow, rowToInventoryItem);
  });
});

describe('generic round-trip: an entity created with only its required fields (all optionals at default)', () => {
  // Same idea, but with a minimal/default-heavy object — catches the case
  // where a mapper only handles the "fully populated" shape correctly and
  // silently mishandles nulls/defaults differently on write vs read.
  it('Collection (custom, no provider fields)', () => {
    const { collection, errors } = createCollection({ name: 'My Custom Binder', is_custom: true });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(collection, collectionToRow, rowToCollection);
  });

  it('CardDefinition (custom, no external/holo/rarity data)', () => {
    const { cardDef, errors } = createCardDefinition({ collectionId: 'col-1', name: 'Custom Card' });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(cardDef, cardDefinitionToRow, rowToCardDefinition);
  });

  it('InventoryItem (all optionals defaulted)', () => {
    const { item, errors } = createInventoryItem({ cardDefId: 'cd-1', collectionId: 'col-1' });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(item, inventoryItemToRow, rowToInventoryItem);
  });

  it('BinderPanel (insert type, no image assigned yet)', () => {
    const { panel, errors } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0,
      spanCols: 2, spanRows: 1, panelType: 'insert',
    });
    expect(errors).toEqual([]);
    expectSurvivesRoundTrip(panel, binderPanelToRow, rowToBinderPanel);
  });
});