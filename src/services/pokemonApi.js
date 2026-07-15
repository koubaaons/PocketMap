/**
 * @fileoverview Pokémon TCG API — real implementation.
 * === ISSUE #130: Pokémon TCG API Integration — Bulk Import ===
 *
 * Builds on the #127 spike. Two decisions made here that weren't yet
 * final in the spike:
 *
 * === DECISION: skip the SDK, use fetch() directly ===
 * #127 flagged that pokemontcgsdk@2.0.0 pins a vulnerable axios
 * version (multiple high-severity CVEs — SSRF, prototype pollution,
 * credential leakage). This API is three simple GET endpoints with
 * query-string params — a raw fetch() wrapper is barely more code
 * than using the SDK, and it removes the vulnerable dependency chain
 * entirely rather than accepting the risk or force-upgrading an
 * untested breaking change. pokemontcgsdk has been uninstalled.
 *
 * === CORS: NOT YET VERIFIED IN AN ACTUAL BROWSER — DO THIS FIRST ===
 * #127's browser-build test only proved the SDK's CODE bundles
 * without Node built-in errors — it did NOT prove the API sends
 * proper CORS headers, since that test never made a real network
 * call from an actual browser tab (CORS is enforced by the browser
 * regardless of which HTTP client makes the call). This has still
 * not been confirmed either way. Before relying on this file, run
 * this directly in the browser console on the running dev server:
 *
 *   fetch('https://api.pokemontcg.io/v2/sets?pageSize=1')
 *     .then(r => r.json())
 *     .then(data => console.log('CORS OK:', data))
 *     .catch(err => console.error('CORS or network failure:', err));
 *
 * If that throws a CORS error (look for "No 'Access-Control-Allow-
 * Origin' header is present" specifically), add a Vite dev-server
 * proxy in vite.config.js, same pattern documented in
 * yugiohApi.js's header comment:
 *
 *   server: {
 *     proxy: {
 *       '/api/pokemontcg': {
 *         target: 'https://api.pokemontcg.io',
 *         changeOrigin: true,
 *         rewrite: (path) => path.replace(/^\/api\/pokemontcg/, '/v2'),
 *       },
 *     },
 *   }
 *
 * — then change API_BASE below to '/api/pokemontcg' and fetch calls
 * become same-origin, sidestepping the browser CORS check entirely.
 * A production deploy needs the equivalent proxy/rewrite on whatever
 * actually serves the built app.
 */

// === ISSUE #130: CORS on this API is genuinely intermittent —
// confirmed via repeated real browser CORS failures on the exact
// same request shape that worked moments earlier, not a one-time
// fluke or something tied to a specific query parameter. In dev,
// route through Vite's own proxy (see vite.config.js) instead of
// hitting the API directly — same-origin from the browser's
// perspective, so no CORS check ever happens; Vite forwards the
// request server-to-server, which browser CORS doesn't apply to.
//
// NOT yet solved for a production build: import.meta.env.DEV is
// false once built/deployed, and Vite's dev proxy doesn't exist
// outside `npm run dev`. Before deploying, this needs an equivalent
// server-side proxy (a small serverless function that fetches this
// API and returns the JSON) — the direct URL below will hit the same
// CORS unreliability in production that dev just worked around.
const API_BASE = import.meta.env.DEV ? '/api/pokemontcg' : 'https://api.pokemontcg.io/v2';

/**
 * Template fields for a Pokémon-imported collection. Used to live in
 * apiSources.js alongside the other (still-mock) sources, but that
 * file is now only for sources without a real implementation yet —
 * this is real, so it lives here with the rest of the actual
 * Pokémon integration instead.
 */
export const POKEMON_TEMPLATE_FIELDS = [
  { field_name: 'Pokémon',     field_type: 'text',   is_required: true  },
  { field_name: 'Set',         field_type: 'text',   is_required: true  },
  { field_name: 'HP',          field_type: 'number', is_required: false },
  { field_name: 'Rarity',      field_type: 'select', is_required: true  },
  { field_name: 'Card Number', field_type: 'text',   is_required: true  },
];

function getHeaders() {
  const apiKey = import.meta.env.VITE_POKEMON_TCG_API_KEY;
  return apiKey ? { 'X-Api-Key': apiKey } : {};
}

// === Session cache for fetchAllSets — the full set list doesn't
// change often enough to justify re-fetching it every single time
// the sets browser is opened. Cached in memory for the life of the
// page (cleared on a real page reload), not persisted anywhere more
// durable, since staleness beyond one session isn't a real concern
// here. ===
let cachedAllSets = null;

/**
 * Fetches every set in one request, for the full-page set browser
 * (not the old modal search flow). Total set count across Pokémon
 * TCG's whole history is comfortably under the API's 250 pageSize
 * cap, so one request covers everything — no pagination needed here.
 * Enables genuinely instant, client-side filtering as the user types
 * (a plain array filter, not a network round-trip per keystroke,
 * which is what made the old modal's "live" search still feel
 * laggy — it was re-hitting the API on every debounce tick).
 *
 * Cached after the first successful fetch — opening the browser
 * again in the same session reuses it instantly instead of hitting
 * the network again.
 */
// Only these fields are ever actually displayed for a set tile
// (name, series, card count, logo image) — trims out legalities,
// ptcgoCode, releaseDate, updatedAt, none of which the UI shows.
// === REVERTED: select appears to trigger a CORS failure on this
// API for at least some requests — reliability over payload size,
// see fetchCardsForSet below for the same reversion and reasoning. ===

export async function fetchAllSets() {
  if (cachedAllSets) return cachedAllSets;
  const res = await fetchWithRetry(`${API_BASE}/sets?orderBy=-releaseDate&pageSize=250`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Pokemon TCG API: fetch all sets failed (${res.status})`);
  const { data } = await res.json();
  cachedAllSets = data;
  return data;
}

/**
 * Searches sets by name. Returns the raw set objects from the API
 * (id, name, series, images.symbol/logo, releaseDate, total, etc).
 *
 * Uses a wildcard substring match (name:*query*), not an exact
 * phrase match — the API's actual set names don't always match what
 * a user might guess (e.g. "Scarlet & Violet Base" isn't necessarily
 * the literal stored name), so requiring an exact phrase was
 * returning zero results for perfectly reasonable searches.
 * @param {string} query - e.g. "Scarlet"
 */
export async function searchSets(query) {
  const q = encodeURIComponent(`name:*${query}*`);
  const res = await fetchWithRetry(`${API_BASE}/sets?q=${q}&orderBy=-releaseDate`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Pokemon TCG API: set search failed (${res.status})`);
  const { data } = await res.json();
  return data;
}

/**
 * Returns the most recent sets with no search filter at all — for a
 * "browse all" option so users aren't purely dependent on guessing
 * an exact or partial set name.
 */
export async function browseSets() {
  const res = await fetchWithRetry(`${API_BASE}/sets?orderBy=-releaseDate&pageSize=50`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Pokemon TCG API: browse sets failed (${res.status})`);
  const { data } = await res.json();
  return data;
}

/**
 * Fetches one page of cards for a given set id. Pagination is
 * required, not optional — a full base set can be 100-250+ cards,
 * and the API caps pageSize (250 max) regardless of what's asked for.
 *
 * === REVERTED select parameter: adding it (to trim the response to
 * only used fields) appeared to trigger a CORS failure on this API —
 * "No 'Access-Control-Allow-Origin' header is present" — for at
 * least some requests, confirmed via a real browser console error,
 * not assumed. A slower request that actually loads beats a faster
 * one that sometimes doesn't load at all. If field-trimming is worth
 * revisiting later, verify CORS behavior with select present in an
 * actual browser first, on its own, before adding it back here. ===
 * @param {string} setId - e.g. "sv1"
 * @param {number} page - 1-indexed
 * @param {number} pageSize
 * @returns {{ cards: object[], page: number, pageSize: number, totalCount: number }}
 */
/**
 * Retries a fetch a few times with increasing delay, but only for
 * server-side errors (5xx — the server's own problem, worth retrying)
 * — never for 4xx (a client mistake like a bad query, which retrying
 * would just repeat identically). A 504 specifically means the API's
 * own server took too long to respond; this is a genuine reliability
 * gap in a free third-party API, not something fixable by changing
 * our own request — retrying is the standard, correct response to it.
 */
async function fetchWithRetry(url, options, retries = 3, delayMs = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (res.status < 500 || attempt === retries) return res; // don't retry 4xx, or out of attempts
    await new Promise(r => setTimeout(r, delayMs * (attempt + 1))); // 1s, 2s, 3s...
  }
}

/**
 * Fetches one page of cards for a given set id. Pagination is
 * required, not optional — a full base set can be 100-250+ cards,
 * and the API caps pageSize (250 max) regardless of what's asked for.
 *
 * Default pageSize lowered from 250 to 100 — a smaller request is
 * less likely to hit the API's own server-side timeout (the actual
 * cause of a 504) than one giant 250-card request, at the cost of
 * needing more pages for very large sets.
 * @param {string} setId - e.g. "sv1"
 * @param {number} page - 1-indexed
 * @param {number} pageSize
 * @returns {{ cards: object[], page: number, pageSize: number, totalCount: number }}
 */
export async function fetchCardsForSet(setId, page = 1, pageSize = 100) {
  const q = encodeURIComponent(`set.id:${setId}`);
  const res = await fetchWithRetry(
    `${API_BASE}/cards?q=${q}&page=${page}&pageSize=${pageSize}`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error(`Pokemon TCG API: card fetch failed (${res.status})`);
  const json = await res.json();
  return {
    cards: json.data,
    page: json.page,
    pageSize: json.pageSize,
    totalCount: json.totalCount,
  };
}

// Cached per set id, same reasoning as cachedAllSets above.
const cachedCardsBySetId = new Map();

/**
 * Fetches every card in a set across all pages. For a spike-sized
 * test this is fine as one function; for very large sets (rare, but
 * some promo/reprint "sets" span thousands of cards across formats)
 * this makes multiple sequential requests — sequential, not
 * parallel, to stay well under the rate limit rather than bursting.
 *
 * Cached per set id after the first successful fetch — previewing
 * the same set again in the same session reuses it instantly.
 */
export async function fetchAllCardsForSet(setId, onProgress) {
  if (cachedCardsBySetId.has(setId)) return cachedCardsBySetId.get(setId);

  const allCards = [];
  let page = 1;
  let totalCount = Infinity;

  while (allCards.length < totalCount) {
    const result = await fetchCardsForSet(setId, page, 100);
    allCards.push(...result.cards);
    totalCount = result.totalCount;
    onProgress?.(allCards.length, totalCount);
    page++;
  }

  cachedCardsBySetId.set(setId, allCards);
  return allCards;
}

// === Rarity → holoType mapping ===
// Pinder's holoType enum (see src/types/holoTypes.js) has 8 values:
// off, none (= subtle default sheen, NOT "no effect" — see that
// file's own note on this), holo, galaxy, rainbow, gold, v, vstar.
//
// Reviewed and finalized directly with the user against a reference
// project (simeydotme/pokemon-cards-css) that recreates real Pokémon
// TCG holo effects in CSS, confirming rarity strings this table's
// first version had missed entirely — most notably "Rare Holo Galaxy"
// (a real, standalone rarity, not an empty/unused category as
// originally assumed) and several newer Scarlet & Violet / Mega
// Evolution era terms (Double Rare, Illustration Rare, Special
// Illustration Rare, Hyper Rare, Mega Hyper Rare, Mega Attack Rare)
// that didn't exist when this table was first built. This is why a
// Mega Hyper Rare card was showing up as "Regular" before this
// revision — it simply wasn't in the table at all, so it silently
// fell through to the 'none' default.
//
// Anything still not in this table falls through to 'none' with a
// console.warn, so genuinely new/unseen rarity strings surface
// instead of silently defaulting forever.
const RARITY_TO_HOLO_TYPE = {
  // Regular — no special foil/holo treatment
  'Common':   'none',
  'Uncommon': 'none',
  'Rare':     'none',
  'Promo':    'none',

  // Holo — textured/premium but not the top gold/rainbow tier
  'Rare Holo':                 'holo',
  'Rare Holo EX':               'holo',
  'Rare Holo GX':               'holo',
  'Rare Holo LV.X':             'holo',
  'Rare Holo Star':             'holo',
  'Rare Prime':                 'holo',
  'Rare Prism Star':            'holo',
  'Rare ACE':                   'holo',
  'Rare BREAK':                 'holo',
  'LEGEND':                     'holo',
  'Rare Shining':               'holo',
  'Rare Shiny':                 'holo',
  'Rare Shiny GX':              'holo',
  'Illustration Rare':          'holo',
  'Mega Attack Rare':           'holo',
  'ACE SPEC Rare':              'holo',
  'Black White Rare':           'holo',
  'Special Illustration Rare':  'holo',

  // Galaxy — confirmed real (not an empty category), a specific
  // cosmos/galaxy-textured holo pattern
  'Rare Holo Galaxy': 'galaxy',

  // Rainbow — vibrant, scene-breaking full-art foil
  'Rare Rainbow':  'rainbow',
  'Amazing Rare':  'rainbow',

  // Gold — all-gold foil/border treatment
  'Rare Secret':     'gold',
  'Rare Ultra':       'gold',
  'Ultra Rare':       'gold',
  'Hyper Rare':       'gold',
  'Mega Hyper Rare':  'gold',

  // V — modern "ex" cards (Double Rare) structurally replaced V as
  // the mid-premium tier in current sets, so grouped together
  'Rare Holo V':     'v',
  'Rare Holo VMAX':  'v',
  'Double Rare':     'v',

  // VSTAR — has its own dedicated type, unlike VMAX
  'Rare Holo VSTAR': 'vstar',
};

/**
 * Maps an API rarity string to a Pinder holoType. Never throws —
 * always returns a valid holoType, defaulting to 'none' for anything
 * unrecognized (and logging it, so real gaps get noticed instead of
 * silently defaulting forever).
 */
// Normalizes a rarity string for comparison — lowercase, underscores/
// hyphens become spaces, collapse repeated whitespace, trim. Built
// once from RARITY_TO_HOLO_TYPE's own keys so the table above stays
// exactly as written (human-readable, "Mega Attack Rare" etc.) while
// still matching whatever casing/format the API actually sends
// (confirmed varies — e.g. "MEGA_ATTACK_RARE" for the same rarity).
function normalizeRarityKey(str) {
  return str.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const NORMALIZED_RARITY_TO_HOLO_TYPE = Object.fromEntries(
  Object.entries(RARITY_TO_HOLO_TYPE).map(([key, value]) => [normalizeRarityKey(key), value])
);

export function mapRarityToHoloType(rarity) {
  if (!rarity) return 'none';
  const mapped = NORMALIZED_RARITY_TO_HOLO_TYPE[normalizeRarityKey(rarity)];
  if (mapped) return mapped;
  console.warn(`[pokemonApi] Unrecognized rarity "${rarity}" — defaulting holoType to 'none'. Add this to RARITY_TO_HOLO_TYPE if it's common enough to matter.`);
  return 'none';
}

/**
 * Maps one raw API card object into the shape createCardDefinition
 * expects, MINUS image_url — the image itself still needs to be
 * fetched and uploaded to Storage (see Issue #125's
 * uploadImageToStorage), which is async and best done in the calling
 * import flow where upload progress can be shown per-card, not
 * buried inside a pure mapping function.
 */
export function mapPokemonCardToDraft(apiCard) {
  return {
    name: apiCard.name,
    sourceImageUrl: apiCard.images?.large ?? apiCard.images?.small ?? null,
    holoType: mapRarityToHoloType(apiCard.rarity),
    // Dedicated field (card_definitions.rarity) — the raw rarity
    // string this card was actually printed with, used for the new
    // sort-by-rarity feature and the rarity badge. Kept alongside the
    // attributes-based "Rarity" entry below for backward
    // compatibility with existing template-field displays, even
    // though they're now the same value stored two ways.
    rarity: apiCard.rarity ?? null,
    attributes: {
      'Pokémon':     apiCard.name,
      'Set':         apiCard.set?.name ?? '',
      'HP':          apiCard.hp ? Number(apiCard.hp) : null,
      'Rarity':      apiCard.rarity ?? '',
      'Card Number': apiCard.number ?? '',
    },
  };
}