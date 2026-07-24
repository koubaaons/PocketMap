/**
 * @fileoverview Tests for tcgImport.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchAllCardsForSet = vi.fn();
const mockMapCardToDraft = vi.fn();
vi.mock('../activeProvider.js', () => ({
  fetchAllCardsForSet: (...args) => mockFetchAllCardsForSet(...args),
  mapCardToDraft: (...args) => mockMapCardToDraft(...args),
  TEMPLATE_FIELDS: [
    { field_name: 'Pokémon', field_type: 'text', is_required: true },
    { field_name: 'Set', field_type: 'text', is_required: true },
  ],
  GAME_LABEL: 'Pokémon TCG',
  PROVIDER_KEY: 'pokemon',
}));

const mockUploadSharedImageIfMissing = vi.fn();
vi.mock('../../utils/supabaseImageUpload.js', () => ({
  uploadSharedImageIfMissing: (...args) => mockUploadSharedImageIfMissing(...args),
}));

const SET = { id: 'set-1', name: 'Base Set', images: { logo: 'https://x/logo.png' } };

function apiCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', rarity: 'Common', hp: '40', number: '1', set: { name: 'Base Set' }, ...overrides };
}

describe('buildCollectionFromSet', () => {
  beforeEach(() => {
    mockFetchAllCardsForSet.mockReset();
    mockMapCardToDraft.mockReset();
    mockUploadSharedImageIfMissing.mockReset();
  });

  it('creates a collection using GAME_LABEL and the set name, marked non-custom', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    const result = await buildCollectionFromSet(SET, { cards: [apiCard()] });

    expect(result.collection.name).toBe('Base Set');
    expect(result.collection.is_custom).toBe(false);
    expect(result.collection.import_source).toBe('Pokémon TCG: Base Set');
    expect(result.collection.cover_image_url).toBe('https://x/logo.png');
  });

  it('stamps the collection with the active provider\'s key, so a future provider swap can tell old collections apart from new ones', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    const result = await buildCollectionFromSet(SET, { cards: [apiCard()] });

    expect(result.collection.provider_key).toBe('pokemon');
  });

  it('creates one template field per entry in TEMPLATE_FIELDS', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    const result = await buildCollectionFromSet(SET, { cards: [apiCard()] });

    expect(result.templateFields).toHaveLength(2);
    expect(result.templateFields.map(f => f.field_name)).toEqual(['Pokémon', 'Set']);
  });

  it('fetches all cards itself when no cards are passed in', async () => {
    mockFetchAllCardsForSet.mockResolvedValue([apiCard()]);
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    await buildCollectionFromSet(SET);

    expect(mockFetchAllCardsForSet).toHaveBeenCalledWith('set-1');
  });

  it('uses already-fetched cards instead of re-fetching when cards are passed in', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    await buildCollectionFromSet(SET, { cards: [apiCard()] });

    expect(mockFetchAllCardsForSet).not.toHaveBeenCalled();
  });

  it('uploads each card\'s image via the shared (not per-user) path, namespaced by PROVIDER_KEY', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: 'https://cdn/pikachu.png', holoType: 'none', rarity: 'Common', attributes: {} });
    mockUploadSharedImageIfMissing.mockResolvedValue('https://storage/pikachu.jpg');
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    await buildCollectionFromSet(SET, { cards: [apiCard({ id: 'card-99' })] });

    expect(mockUploadSharedImageIfMissing).toHaveBeenCalledWith(expect.any(Function), 'pokemon-cache/card-99.jpg');
  });

  it('skips the image upload entirely when a card has no source image', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    const result = await buildCollectionFromSet(SET, { cards: [apiCard()] });

    expect(mockUploadSharedImageIfMissing).not.toHaveBeenCalled();
    expect(result.cardDefinitions[0].image_url).toBe(null);
  });

  it('calls onProgress once per card, with the running count and total', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const onProgress = vi.fn();
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    await buildCollectionFromSet(SET, { cards: [apiCard({ id: 'c1' }), apiCard({ id: 'c2' })], onProgress });

    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('continues past a card that fails, collecting it as a failure rather than aborting the whole import', async () => {
    mockMapCardToDraft
      .mockImplementationOnce(() => { throw new Error('bad card data'); })
      .mockImplementationOnce(() => ({ name: 'Raichu', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} }));
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    const result = await buildCollectionFromSet(SET, {
      cards: [apiCard({ id: 'c1', name: 'Broken Card' }), apiCard({ id: 'c2', name: 'Raichu' })],
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].name).toBe('Broken Card');
    expect(result.cardDefinitions).toHaveLength(1);
    expect(result.cardDefinitions[0].name).toBe('Raichu');
  });

  it('throws if the collection itself fails validation, without attempting any cards', async () => {
    const { buildCollectionFromSet } = await import('../tcgImport.js');

    await expect(buildCollectionFromSet({ id: 'set-1', name: '' })).rejects.toThrow();
    expect(mockMapCardToDraft).not.toHaveBeenCalled();
  });
});

describe('importNewCardsForCollection', () => {
  it('creates a card definition for each given card, into the given existing collection', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', externalCardId: 'card-1', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { importNewCardsForCollection } = await import('../tcgImport.js');

    const result = await importNewCardsForCollection('existing-col-1', [apiCard()]);

    expect(result.cardDefinitions).toHaveLength(1);
    expect(result.cardDefinitions[0].collectionId).toBe('existing-col-1');
    expect(result.cardDefinitions[0].external_card_id).toBe('card-1');
  });

  it('creates every card unowned — no inventory item or binder placement is part of this at all', async () => {
    mockMapCardToDraft.mockReturnValue({ name: 'Pikachu', externalCardId: 'card-1', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} });
    const { importNewCardsForCollection } = await import('../tcgImport.js');

    const result = await importNewCardsForCollection('existing-col-1', [apiCard()]);

    // Nothing in the returned shape references inventory or slots at all
    expect(result).not.toHaveProperty('inventory');
    expect(Object.keys(result)).toEqual(['cardDefinitions', 'failures']);
  });

  it('continues past a card that fails, same partial-failure handling as buildCollectionFromSet', async () => {
    mockMapCardToDraft
      .mockImplementationOnce(() => { throw new Error('bad card'); })
      .mockImplementationOnce(() => ({ name: 'Raichu', externalCardId: 'card-2', sourceImageUrl: null, holoType: 'none', rarity: 'Common', attributes: {} }));
    const { importNewCardsForCollection } = await import('../tcgImport.js');

    const result = await importNewCardsForCollection('existing-col-1', [
      apiCard({ id: 'card-1', name: 'Broken' }), apiCard({ id: 'card-2', name: 'Raichu' }),
    ]);

    expect(result.failures).toHaveLength(1);
    expect(result.cardDefinitions).toHaveLength(1);
    expect(result.cardDefinitions[0].name).toBe('Raichu');
  });

  it('returns empty results for an empty card list, without error', async () => {
    const { importNewCardsForCollection } = await import('../tcgImport.js');

    const result = await importNewCardsForCollection('existing-col-1', []);

    expect(result.cardDefinitions).toEqual([]);
    expect(result.failures).toEqual([]);
  });
});
