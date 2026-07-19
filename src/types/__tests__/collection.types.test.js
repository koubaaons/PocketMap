/**
 * @fileoverview Tests for collection.types.js's card definition
 * validator/factory.
 *
 * Found two real bugs while writing this — same undefined-vs-null
 * class as inventory.types.js's, just not yet caught here:
 *   - image_url only checked `!== null`, rejecting undefined too
 *   - holoType only checked `!== undefined`, rejecting explicit null
 *     too — inconsistent with how it's actually read elsewhere
 *     (`cardDef.holoType ?? 'none'`, which treats both the same)
 * Both fixed alongside adding these tests.
 */

import { describe, it, expect } from 'vitest';
import { validateCardDefinition, createCardDefinition, validateTemplateField, createTemplateField, validateOneTemplatePerCollection } from '../collection.types.js';
import { HOLO_TYPES } from '../holoTypes.js';

function validBaseCard(overrides = {}) {
  return {
    id: 'card-1',
    collectionId: 'coll-1',
    name: 'Pikachu',
    image_url: null,
    attributes: {},
    holoType: 'none',
    rarity: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('validateCardDefinition', () => {
  it('accepts a fully valid card', () => {
    const { valid, errors } = validateCardDefinition(validBaseCard());
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  describe('the undefined-vs-null bug class', () => {
    it('image_url: undefined is valid (missing entirely)', () => {
      const card = validBaseCard();
      delete card.image_url;
      expect(validateCardDefinition(card).valid).toBe(true);
    });

    it('image_url: explicit null is valid', () => {
      expect(validateCardDefinition(validBaseCard({ image_url: null })).valid).toBe(true);
    });

    it('holoType: undefined is valid (older cards created before this field existed)', () => {
      const card = validBaseCard();
      delete card.holoType;
      expect(validateCardDefinition(card).valid).toBe(true);
    });

    it('holoType: explicit null is ALSO valid (matches how it is actually read: ?? "none")', () => {
      expect(validateCardDefinition(validBaseCard({ holoType: null })).valid).toBe(true);
    });

    it('rarity: undefined is valid', () => {
      const card = validBaseCard();
      delete card.rarity;
      expect(validateCardDefinition(card).valid).toBe(true);
    });

    it('rarity: explicit null is valid', () => {
      expect(validateCardDefinition(validBaseCard({ rarity: null })).valid).toBe(true);
    });
  });

  it('rejects a non-string, non-null image_url', () => {
    expect(validateCardDefinition(validBaseCard({ image_url: 12345 })).valid).toBe(false);
  });

  it('accepts every real holo type', () => {
    for (const type of HOLO_TYPES) {
      expect(validateCardDefinition(validBaseCard({ holoType: type })).valid).toBe(true);
    }
  });

  it('rejects an invalid holoType value (not just missing)', () => {
    const { valid, errors } = validateCardDefinition(validBaseCard({ holoType: 'not-a-real-type' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('holoType'))).toBe(true);
  });

  it('accepts any non-empty string for rarity (free text, not an enum)', () => {
    expect(validateCardDefinition(validBaseCard({ rarity: 'Some Made-Up Rarity From A New Set' })).valid).toBe(true);
  });

  it('rejects a non-string, non-null rarity', () => {
    expect(validateCardDefinition(validBaseCard({ rarity: 42 })).valid).toBe(false);
  });

  it('requires a non-empty, non-whitespace-only name', () => {
    expect(validateCardDefinition(validBaseCard({ name: '' })).valid).toBe(false);
    expect(validateCardDefinition(validBaseCard({ name: '   ' })).valid).toBe(false);
  });

  it('requires attributes to be an object, not null/array/primitive', () => {
    expect(validateCardDefinition(validBaseCard({ attributes: null })).valid).toBe(false);
    expect(validateCardDefinition(validBaseCard({ attributes: 'nope' })).valid).toBe(false);
  });

  it('rejects non-object input entirely', () => {
    expect(validateCardDefinition(null).valid).toBe(false);
    expect(validateCardDefinition(undefined).valid).toBe(false);
  });
});

describe('createCardDefinition', () => {
  it('creates a valid card with just the required fields', () => {
    const { cardDef, errors } = createCardDefinition({ collectionId: 'coll-1', name: 'Charizard' });
    expect(errors).toEqual([]);
    expect(cardDef).not.toBeNull();
    expect(cardDef.name).toBe('Charizard');
    expect(cardDef.holoType).toBe('none'); // documented default: Regular Holo, not "off"
    expect(cardDef.rarity).toBeNull();
  });

  it('trims whitespace from the name', () => {
    const { cardDef } = createCardDefinition({ collectionId: 'coll-1', name: '  Charizard  ' });
    expect(cardDef.name).toBe('Charizard');
  });

  it('clamps an invalid holoType to "none" rather than rejecting the whole card', () => {
    const { cardDef, errors } = createCardDefinition({ collectionId: 'coll-1', name: 'Charizard', holoType: 'not-real' });
    expect(errors).toEqual([]);
    expect(cardDef.holoType).toBe('none');
  });

  it('accepts an explicit rarity string', () => {
    const { cardDef } = createCardDefinition({ collectionId: 'coll-1', name: 'Charizard', rarity: 'Rare Holo' });
    expect(cardDef.rarity).toBe('Rare Holo');
  });

  it('returns null cardDef and real errors when name is empty', () => {
    const { cardDef, errors } = createCardDefinition({ collectionId: 'coll-1', name: '' });
    expect(cardDef).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

function validTemplateField(overrides = {}) {
  return { id: 'field-1', collectionId: 'coll-1', field_name: 'Rarity', field_type: 'text', is_required: false, order: 0, ...overrides };
}

describe('validateTemplateField', () => {
  it('accepts a valid text field', () => {
    expect(validateTemplateField(validTemplateField()).valid).toBe(true);
  });

  it('requires field_type to be one of the known types', () => {
    expect(validateTemplateField(validTemplateField({ field_type: 'not-a-real-type' })).valid).toBe(false);
    for (const type of ['text', 'number', 'boolean', 'select']) {
      const overrides = type === 'select' ? { field_type: type, options: ['a', 'b'] } : { field_type: type };
      expect(validateTemplateField(validTemplateField(overrides)).valid).toBe(true);
    }
  });

  it('requires a non-empty options array for select fields specifically', () => {
    expect(validateTemplateField(validTemplateField({ field_type: 'select', options: [] })).valid).toBe(false);
    expect(validateTemplateField(validTemplateField({ field_type: 'select' /* no options at all */ })).valid).toBe(false);
    expect(validateTemplateField(validTemplateField({ field_type: 'select', options: ['a'] })).valid).toBe(true);
  });

  it('does not require options for non-select fields, but allows an empty array', () => {
    expect(validateTemplateField(validTemplateField({ field_type: 'text' })).valid).toBe(true);
    expect(validateTemplateField(validTemplateField({ field_type: 'text', options: [] })).valid).toBe(true);
  });

  it('rejects a non-array options value even for non-select fields', () => {
    expect(validateTemplateField(validTemplateField({ field_type: 'text', options: 'not-an-array' })).valid).toBe(false);
  });

  it('requires order to be a non-negative integer', () => {
    expect(validateTemplateField(validTemplateField({ order: -1 })).valid).toBe(false);
    expect(validateTemplateField(validTemplateField({ order: 1.5 })).valid).toBe(false);
    expect(validateTemplateField(validTemplateField({ order: 0 })).valid).toBe(true);
  });

  it('requires a non-empty field_name', () => {
    expect(validateTemplateField(validTemplateField({ field_name: '' })).valid).toBe(false);
    expect(validateTemplateField(validTemplateField({ field_name: '   ' })).valid).toBe(false);
  });
});

describe('createTemplateField', () => {
  it('creates a valid text field with defaults', () => {
    const { field, errors } = createTemplateField({ collectionId: 'coll-1', field_name: 'Rarity' });
    expect(errors).toEqual([]);
    expect(field.field_type).toBe('text');
    expect(field.is_required).toBe(false);
    expect(field.options).toEqual([]);
  });

  it('trims and filters blank entries out of options', () => {
    const { field } = createTemplateField({ collectionId: 'coll-1', field_name: 'Rarity', field_type: 'select', options: ['  Common ', '', 'Rare', '   '] });
    expect(field.options).toEqual(['Common', 'Rare']);
  });

  it('returns null field for a select field with no usable options after trimming', () => {
    const { field, errors } = createTemplateField({ collectionId: 'coll-1', field_name: 'Rarity', field_type: 'select', options: ['', '   '] });
    expect(field).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateOneTemplatePerCollection', () => {
  it('is valid when the collection has no existing fields yet', () => {
    expect(validateOneTemplatePerCollection('coll-1', []).valid).toBe(true);
  });

  it('is invalid once the collection already has at least one field', () => {
    const result = validateOneTemplatePerCollection('coll-1', [validTemplateField()]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('only checks fields belonging to the SAME collection', () => {
    const result = validateOneTemplatePerCollection('coll-2', [validTemplateField({ collectionId: 'coll-1' })]);
    expect(result.valid).toBe(true);
  });
});