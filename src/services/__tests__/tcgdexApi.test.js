/**
 * @fileoverview Tests for tcgdexApi.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

describe('mapRarityToHoloType', () => {
  it('maps common tiers to none', async () => {
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');
    expect(mapRarityToHoloType('Common')).toBe('none');
    expect(mapRarityToHoloType('Rare')).toBe('none');
  });

  it('maps TCGdex\'s "Holo Rare" (reversed word order from pokemontcg.io\'s "Rare Holo") to holo', async () => {
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');
    expect(mapRarityToHoloType('Holo Rare')).toBe('holo');
  });

  it('maps TCGdex-specific rarities that had no prior equivalent', async () => {
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');
    expect(mapRarityToHoloType('Classic Collection')).toBe('gold');
    expect(mapRarityToHoloType('Full Art Trainer')).toBe('holo');
    expect(mapRarityToHoloType('Radiant Rare')).toBe('v');
  });

  it('is case and whitespace insensitive', async () => {
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');
    expect(mapRarityToHoloType('double rare')).toBe('v');
    expect(mapRarityToHoloType('DOUBLE RARE')).toBe('v');
  });

  it('falls back to none and warns for a genuinely unrecognized rarity', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');

    const result = mapRarityToHoloType('Some Brand New Rarity Nobody Has Seen');

    expect(result).toBe('none');
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('returns none for a missing rarity without warning', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mapRarityToHoloType } = await import('../tcgdexApi.js');

    expect(mapRarityToHoloType(null)).toBe('none');
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});

describe('mapTcgdexCardToDraft', () => {
  it('appends the quality/format suffix TCGdex image URLs require', async () => {
    const { mapTcgdexCardToDraft } = await import('../tcgdexApi.js');
    const draft = mapTcgdexCardToDraft({ id: 'swsh3-136', name: 'Furret', image: 'https://assets.tcgdex.net/en/swsh/swsh3/136', rarity: 'Uncommon' });
    expect(draft.sourceImageUrl).toBe('https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp');
  });

  it('leaves sourceImageUrl null when the card has no image at all', async () => {
    const { mapTcgdexCardToDraft } = await import('../tcgdexApi.js');
    const draft = mapTcgdexCardToDraft({ id: 'c1', name: 'Furret', image: null, rarity: 'Uncommon' });
    expect(draft.sourceImageUrl).toBe(null);
  });

  it('carries the external card id through for later matching', async () => {
    const { mapTcgdexCardToDraft } = await import('../tcgdexApi.js');
    const draft = mapTcgdexCardToDraft({ id: 'swsh3-136', name: 'Furret', rarity: 'Uncommon' });
    expect(draft.externalCardId).toBe('swsh3-136');
  });

  it('maps localId to the Card Number attribute (TCGdex uses localId, not number)', async () => {
    const { mapTcgdexCardToDraft } = await import('../tcgdexApi.js');
    const draft = mapTcgdexCardToDraft({ id: 'swsh3-136', name: 'Furret', localId: '136', rarity: 'Uncommon' });
    expect(draft.attributes['Card Number']).toBe('136');
  });

  it('converts hp to a number when present, null when absent', async () => {
    const { mapTcgdexCardToDraft } = await import('../tcgdexApi.js');
    const withHp = mapTcgdexCardToDraft({ id: 'c1', name: 'Furret', hp: 110, rarity: 'Uncommon' });
    const withoutHp = mapTcgdexCardToDraft({ id: 'c2', name: 'Energy Card', rarity: 'Common' });
    expect(withHp.attributes.HP).toBe(110);
    expect(withoutHp.attributes.HP).toBe(null);
  });
});

describe('fetchAllSets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('filters out Pokémon TCG Pocket sets entirely — a genuinely separate, mobile-only digital game with no physical cards', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'swsh3', name: 'Darkness Ablaze' }, { id: 'A1', name: 'Genetic Apex' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'swsh3', releaseDate: '2020-08-14', cards: [], serie: { id: 'swsh', name: 'Sword & Shield' } }))
      .mockResolvedValueOnce(jsonResponse({ id: 'A1', releaseDate: '2024-10-30', cards: [], serie: { id: 'tcgp', name: 'TCG Pocket' } }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    expect(sets).toHaveLength(1);
    expect(sets[0].id).toBe('swsh3');
    vi.unstubAllGlobals();
  });

  it('keeps a set whose enrichment fails, even though its serie is unknown at that point — a rare edge case weighed against silently losing an entire physical set', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'swsh3', name: 'Darkness Ablaze' }]))
      .mockResolvedValue(jsonResponse(null, false, 500));
    vi.stubGlobal('fetch', mockFetch);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const resultPromise = fetchAllSets();
    await vi.runAllTimersAsync();
    const sets = await resultPromise;

    expect(sets).toHaveLength(1);
    expect(sets[0].id).toBe('swsh3');
    consoleError.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('enriches each brief set with its real releaseDate from the full set detail', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'base1', name: 'Base Set' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', name: 'Base Set', releaseDate: '1999-01-09', cards: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    expect(sets[0].releaseDate).toBe('1999-01-09');
    vi.unstubAllGlobals();
  });

  it('keeps the brief set (without a release date) if enriching it fails, rather than losing the whole list', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'base1', name: 'Base Set' }]))
      .mockResolvedValue(jsonResponse(null, false, 500)); // every retry attempt also fails
    vi.stubGlobal('fetch', mockFetch);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const resultPromise = fetchAllSets();
    await vi.runAllTimersAsync(); // fast-forward through the retry backoff delays
    const sets = await resultPromise;

    expect(sets[0].id).toBe('base1');
    expect(sets[0].name).toBe('Base Set');
    expect(sets[0].releaseDate).toBeUndefined(); // enrichment failed — no release date available
    consoleError.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('normalizes each set to include images.logo/images.symbol — the actual fix for a real bug where these silently failed to render, since TCGdex\'s raw shape uses flat logo/symbol fields, not the images.{logo,symbol} shape the UI expects', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'base1', name: 'Base Set', logo: 'https://assets.tcgdex.net/en/base/base1/logo', symbol: 'https://assets.tcgdex.net/en/base/base1/symbol' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', releaseDate: '1999-01-09', cardCount: { official: 102 }, cards: new Array(102).fill({ id: 'x' }) }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    expect(sets[0].images.logo).toBe('https://assets.tcgdex.net/en/base/base1/logo.webp');
    expect(sets[0].images.symbol).toBe('https://assets.tcgdex.net/en/base/base1/symbol.webp');
    expect(sets[0].total).toBe(102);
    vi.unstubAllGlobals();
  });

  it('total reflects the real number of catalogued cards, not cardCount.official, when the two disagree — the actual live bug: a set advertised as 84 cards can have secret rares or extras bringing its real catalogued count to 120', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'set-1', name: 'Pitch Black' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'set-1', releaseDate: '2026-01-01', cardCount: { official: 84 }, cards: new Array(120).fill({ id: 'x' }) }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    // The real catalogued count (120) wins, not the official print-run
    // figure (84) — so the set tile's advertised count always matches
    // what the import actually delivers.
    expect(sets[0].total).toBe(120);
    vi.unstubAllGlobals();
  });

  it('a genuinely empty set (0 real cards catalogued, like a promo set with none added yet) still shows 0, not the official count', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'promo-1', name: 'MEP Black Star Promos' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'promo-1', releaseDate: '2025-01-01', cardCount: { official: 0 }, cards: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    expect(sets[0].total).toBe(0);
    vi.unstubAllGlobals();
  });

  it('normalizes to null images and 0 total when a set genuinely has no logo/symbol/card count data', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'base1', name: 'Base Set' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', releaseDate: '1999-01-09', cards: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    const sets = await fetchAllSets();

    expect(sets[0].images).toEqual({ logo: null, symbol: null });
    expect(sets[0].total).toBe(0);
    vi.unstubAllGlobals();
  });

  it('caches the result — a second call does not hit the network again', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'base1', name: 'Base Set' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', releaseDate: '1999-01-09', cards: [] }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchAllSets } = await import('../tcgdexApi.js');
    await fetchAllSets();
    const callCountAfterFirst = mockFetch.mock.calls.length;
    await fetchAllSets();

    expect(mockFetch.mock.calls.length).toBe(callCountAfterFirst); // no new calls
    vi.unstubAllGlobals();
  });
});

describe('fetchCardsForSet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('slices the requested page from the set\'s embedded brief card list, then fetches full detail for just that slice', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: 'base1', cardCount: { official: 3 },
        cards: [{ id: 'base1-1' }, { id: 'base1-2' }, { id: 'base1-3' }],
      }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-1', name: 'Alakazam' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-2', name: 'Blastoise' }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchCardsForSet } = await import('../tcgdexApi.js');
    const result = await fetchCardsForSet('base1', 1, 2);

    expect(result.cards).toHaveLength(2);
    expect(result.cards.map(c => c.name)).toEqual(['Alakazam', 'Blastoise']);
    expect(result.totalCount).toBe(3);
    vi.unstubAllGlobals();
  });

  it('normalizes each card to include images.small/images.large — the actual fix for a real bug where card thumbnails silently failed to render in the import preview, since TCGdex\'s raw shape uses a flat image field, not images.{small,large}', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', cardCount: { official: 1 }, cards: [{ id: 'base1-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-1', name: 'Alakazam', image: 'https://assets.tcgdex.net/en/base/base1/1' }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchCardsForSet } = await import('../tcgdexApi.js');
    const result = await fetchCardsForSet('base1', 1, 1);

    expect(result.cards[0].images.small).toBe('https://assets.tcgdex.net/en/base/base1/1/high.webp');
    expect(result.cards[0].images.large).toBe('https://assets.tcgdex.net/en/base/base1/1/high.webp');
    vi.unstubAllGlobals();
  });

  it('normalizes to null images when a card genuinely has no image at all', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', cardCount: { official: 1 }, cards: [{ id: 'base1-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-1', name: 'Energy Card' }));
    vi.stubGlobal('fetch', mockFetch);

    const { fetchCardsForSet } = await import('../tcgdexApi.js');
    const result = await fetchCardsForSet('base1', 1, 1);

    expect(result.cards[0].images).toEqual({ small: null, large: null });
    vi.unstubAllGlobals();
  });
});

describe('fetchAllCardsForSet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fetches full detail for every card in the set and reports progress', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'base1', cards: [{ id: 'base1-1' }, { id: 'base1-2' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-1', name: 'Alakazam' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'base1-2', name: 'Blastoise' }));
    vi.stubGlobal('fetch', mockFetch);
    const onProgress = vi.fn();

    const { fetchAllCardsForSet } = await import('../tcgdexApi.js');
    const cards = await fetchAllCardsForSet('base1', onProgress);

    expect(cards.map(c => c.name)).toEqual(['Alakazam', 'Blastoise']);
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    vi.unstubAllGlobals();
  });
});