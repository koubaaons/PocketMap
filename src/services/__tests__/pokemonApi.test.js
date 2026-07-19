/**
 * @fileoverview Tests for pokemonApi.js's mapRarityToHoloType.
 *
 * The specific bug this exists to guard against: the API sends
 * inconsistent formatting for the same rarity concept across
 * different requests — e.g. "MEGA_ATTACK_RARE" (all caps, underscores)
 * for a rarity already mapped as "Mega Attack Rare" (title case,
 * spaces) in RARITY_TO_HOLO_TYPE. The lookup used to be a direct
 * object-key comparison, so any casing/formatting mismatch silently
 * fell through to the "unrecognized" default ('none') even though the
 * rarity WAS mapped, just under a differently-formatted key.
 */

import { describe, it, expect, vi } from 'vitest';
import { mapRarityToHoloType, mapPokemonCardToDraft } from '../pokemonApi.js';

describe('mapRarityToHoloType', () => {
  it('maps a rarity exactly as written in the table', () => {
    expect(mapRarityToHoloType('Rare Holo')).toBe('holo');
  });

  it('normalizes casing/underscore formatting differences — the actual bug this guards against', () => {
    // Confirmed via a real console warning during use: the API sent
    // this exact format for a rarity that WAS already mapped, just
    // under "Mega Attack Rare" instead.
    expect(mapRarityToHoloType('MEGA_ATTACK_RARE')).toBe('holo');
    expect(mapRarityToHoloType('mega_attack_rare')).toBe('holo');
    expect(mapRarityToHoloType('Mega-Attack-Rare')).toBe('holo');
    expect(mapRarityToHoloType('  Mega   Attack   Rare  ')).toBe('holo');
  });

  it('is fully case-insensitive for every mapped rarity, not just this one example', () => {
    expect(mapRarityToHoloType('RARE HOLO')).toBe('holo');
    expect(mapRarityToHoloType('rare holo')).toBe('holo');
    expect(mapRarityToHoloType('rare_holo')).toBe('holo');
  });

  it('returns "none" and logs a warning for a genuinely unrecognized rarity', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapRarityToHoloType('Some Brand New Rarity Nobody Has Seen')).toBe('none');
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('returns "none" for null/undefined/empty without warning (no rarity data at all is expected sometimes)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapRarityToHoloType(null)).toBe('none');
    expect(mapRarityToHoloType(undefined)).toBe('none');
    expect(mapRarityToHoloType('')).toBe('none');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('maps every documented rarity tier correctly', () => {
    expect(mapRarityToHoloType('Common')).toBe('none');
    expect(mapRarityToHoloType('Rare Holo Galaxy')).toBe('galaxy');
    expect(mapRarityToHoloType('Rare Rainbow')).toBe('rainbow');
    expect(mapRarityToHoloType('Hyper Rare')).toBe('gold');
    expect(mapRarityToHoloType('Rare Holo V')).toBe('v');
    expect(mapRarityToHoloType('Rare Holo VSTAR')).toBe('vstar');
  });
});

describe('mapPokemonCardToDraft', () => {
  function makeApiCard(overrides = {}) {
    return {
      name: 'Pikachu',
      images: { large: 'https://example.com/large.png', small: 'https://example.com/small.png' },
      rarity: 'Rare Holo',
      set: { name: 'Base Set' },
      hp: '60',
      number: '25',
      ...overrides,
    };
  }

  it('maps a complete API card to the expected draft shape', () => {
    const draft = mapPokemonCardToDraft(makeApiCard());
    expect(draft.name).toBe('Pikachu');
    expect(draft.sourceImageUrl).toBe('https://example.com/large.png');
    expect(draft.holoType).toBe('holo');
    expect(draft.rarity).toBe('Rare Holo');
    expect(draft.attributes['Pokémon']).toBe('Pikachu');
    expect(draft.attributes['Set']).toBe('Base Set');
    expect(draft.attributes['HP']).toBe(60);
    expect(draft.attributes['Rarity']).toBe('Rare Holo');
    expect(draft.attributes['Card Number']).toBe('25');
  });

  it('falls back to the small image when large is missing', () => {
    const draft = mapPokemonCardToDraft(makeApiCard({ images: { small: 'https://example.com/small.png' } }));
    expect(draft.sourceImageUrl).toBe('https://example.com/small.png');
  });

  it('sourceImageUrl is null when there are no images at all', () => {
    const draft = mapPokemonCardToDraft(makeApiCard({ images: {} }));
    expect(draft.sourceImageUrl).toBeNull();
  });

  it('rarity is null (not an empty string) when the API sends no rarity', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const draft = mapPokemonCardToDraft(makeApiCard({ rarity: undefined }));
    expect(draft.rarity).toBeNull();
    expect(draft.holoType).toBe('none'); // no rarity -> no mapping -> the safe default
    warnSpy.mockRestore();
  });

  it('HP is converted to a real number, not left as a string', () => {
    const draft = mapPokemonCardToDraft(makeApiCard({ hp: '120' }));
    expect(draft.attributes['HP']).toBe(120);
    expect(typeof draft.attributes['HP']).toBe('number');
  });

  it('HP is null when the API sends none', () => {
    const draft = mapPokemonCardToDraft(makeApiCard({ hp: undefined }));
    expect(draft.attributes['HP']).toBeNull();
  });

  it('handles a missing set name gracefully (empty string, not a crash)', () => {
    const draft = mapPokemonCardToDraft(makeApiCard({ set: undefined }));
    expect(draft.attributes['Set']).toBe('');
  });
});