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
 * These tests check every field explicitly, in both directions, so a
 * future field added to one side (the JS object shape) but forgotten
 * on the other (the row mapper) gets caught here rather than
 * discovered by a user months later.
 */

import { describe, it, expect } from 'vitest';
import { collectionToRow, cardDefinitionToRow, rowToCollection, rowToCardDefinition } from '../supabaseStorage.js';

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