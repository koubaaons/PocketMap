/**
 * @fileoverview API sources registry.
 *
 * Currently contains mock data for development.
 * In Milestone 10, replace each entry's data with real API calls
 * without changing anything in the components that consume this.
 *
 * Each source defines:
 *   - id: unique identifier used as import_source on the collection
 *   - name: display name
 *   - category: used for filtering in the UI
 *   - cardCount: approximate total cards (shown in UI)
 *   - templateFields: the field schema this collection uses
 *   - sampleCards: mock card definitions (replaced by real API in Milestone 10)
 */

// === REFACTOR3b START: Move MOCK_API_SOURCES to services layer ===

export const API_SOURCES = [
  {
    id: 'winx-api',
    name: 'Winx Club Cards',
    category: 'Anime',
    cardCount: 406,
    templateFields: [
      { field_name: 'Character',      field_type: 'text',   is_required: true  },
      { field_name: 'Season',         field_type: 'text',   is_required: false },
      { field_name: 'Transformation', field_type: 'text',   is_required: false },
      { field_name: 'Rarity',         field_type: 'select', is_required: true  },
      { field_name: 'Card Number',    field_type: 'text',   is_required: true  },
    ],
    sampleCards: [
      { name: 'Bloom Believix',  attributes: { Character: 'Bloom', Season: 'Season 4', Transformation: 'Believix',  Rarity: 'Rare',       'Card Number': 'WC-001' } },
      { name: 'Flora Enchantix', attributes: { Character: 'Flora', Season: 'Season 3', Transformation: 'Enchantix', Rarity: 'Ultra Rare', 'Card Number': 'WC-002' } },
      { name: 'Musa Concert',    attributes: { Character: 'Musa',  Season: 'Season 2', Transformation: 'Charmix',   Rarity: 'Common',     'Card Number': 'WC-003' } },
    ],
  },
  {
    id: 'yugioh-api',
    name: 'Yu-Gi-Oh! TCG',
    category: 'Trading Cards',
    cardCount: 12458,
    templateFields: [
      { field_name: 'Type',       field_type: 'select', is_required: true  },
      { field_name: 'Attribute',  field_type: 'select', is_required: false },
      { field_name: 'ATK',        field_type: 'number', is_required: false },
      { field_name: 'DEF',        field_type: 'number', is_required: false },
      { field_name: 'Rarity',     field_type: 'select', is_required: true  },
      { field_name: 'Set Number', field_type: 'text',   is_required: true  },
    ],
    sampleCards: [],
  },
];

/**
 * Returns all available API sources.
 * In Milestone 10, this becomes an async fetch to a real registry.
 * @returns {object[]}
 */
export function getApiSources() {
  return API_SOURCES;
}

/**
 * Finds a source by id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getApiSourceById(id) {
  return API_SOURCES.find(s => s.id === id);
}

// === REFACTOR3b END: Move MOCK_API_SOURCES to services layer ===