/**
 * @fileoverview Tests for tcgdexProvider.js.
 */

import { describe, it, expect } from 'vitest';
import * as tcgdexApi from '../../tcgdexApi.js';
import * as provider from '../tcgdexProvider.js';

describe('tcgdexProvider', () => {
  it('re-exports fetchAllSets/fetchCardsForSet/fetchAllCardsForSet from tcgdexApi.js unchanged', () => {
    expect(provider.fetchAllSets).toBe(tcgdexApi.fetchAllSets);
    expect(provider.fetchCardsForSet).toBe(tcgdexApi.fetchCardsForSet);
    expect(provider.fetchAllCardsForSet).toBe(tcgdexApi.fetchAllCardsForSet);
  });

  it('exposes mapTcgdexCardToDraft under the generic mapCardToDraft name', () => {
    expect(provider.mapCardToDraft).toBe(tcgdexApi.mapTcgdexCardToDraft);
  });

  it('exposes TCGDEX_TEMPLATE_FIELDS under the generic TEMPLATE_FIELDS name', () => {
    expect(provider.TEMPLATE_FIELDS).toBe(tcgdexApi.TCGDEX_TEMPLATE_FIELDS);
  });

  it('labels the game as "Pokémon TCG" — TCGdex is a different data source for the same game, not a different game', () => {
    expect(provider.GAME_LABEL).toBe('Pokémon TCG');
  });

  it('uses a provider key distinct from the previous provider\'s — this is what lets useCollectionUpdateCheck.js tell old-provider collections apart from new ones', () => {
    expect(provider.PROVIDER_KEY).toBe('tcgdex');
    expect(provider.PROVIDER_KEY).not.toBe('pokemon');
  });
});
