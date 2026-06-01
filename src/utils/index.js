/**
 * @fileoverview Pure utility functions.
 * No imports from the app. No side effects. Fully unit-testable.
 */

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Returns cards matching a search query.
 * Searches name, character, and series (case-insensitive).
 * Sorted by relevance: name match first, then character, then series.
 *
 * @param {object[]} cards
 * @param {string} query
 * @returns {object[]}
 */
export function searchCards(cards, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return cards
    .map(card => {
      const name = card.name.toLowerCase();
      const char = (card.character ?? '').toLowerCase();
      const series = (card.series ?? '').toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (char.includes(q)) score = 40;
      else if (series.includes(q)) score = 20;
      return { card, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ card }) => card);
}

// ─── Binder helpers ───────────────────────────────────────────────────────────

/**
 * Returns total slot capacity for a binder.
 * @param {{ rows: number, cols: number, pages: number }} binder
 * @returns {number}
 */
export function binderCapacity(binder) {
  return binder.rows * binder.cols * binder.pages;
}

/**
 * Returns the number of cards in a binder.
 * @param {object[]} cards
 * @param {string} binderId
 * @returns {number}
 */
export function binderCardCount(cards, binderId) {
  return cards.filter(c => c.binderId === binderId).length;
}

/**
 * Returns cards on a specific binder page.
 * @param {object[]} cards
 * @param {string} binderId
 * @param {number} page
 * @returns {object[]}
 */
export function cardsOnPage(cards, binderId, page) {
  return cards.filter(c => c.binderId === binderId && c.page === page);
}

/**
 * Checks if a slot is occupied on a given page.
 * @param {object[]} cards
 * @param {string} binderId
 * @param {number} page
 * @param {number} slot
 * @param {string} [excludeCardId] - Ignore this card (for edit operations)
 * @returns {boolean}
 */
export function isSlotOccupied(cards, binderId, page, slot, excludeCardId = null) {
  return cards.some(
    c => c.binderId === binderId &&
         c.page === page &&
         c.slot === slot &&
         c.id !== excludeCardId
  );
}

/**
 * Returns available (unoccupied) slots for a given page.
 * @param {object[]} cards
 * @param {{ id: string, rows: number, cols: number }} binder
 * @param {number} page
 * @returns {number[]}
 */
export function availableSlots(cards, binder, page) {
  const totalSlots = binder.rows * binder.cols;
  const occupied = new Set(
    cards.filter(c => c.binderId === binder.id && c.page === page).map(c => c.slot)
  );
  return Array.from({ length: totalSlots }, (_, i) => i + 1).filter(s => !occupied.has(s));
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a timestamp as a relative date string.
 * @param {number} timestamp
 * @returns {string}
 */
export function relativeDate(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Debounces a function call.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Clamps a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}