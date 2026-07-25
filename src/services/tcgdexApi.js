/**
 * @fileoverview TCGdex API — real implementation, replacing
 * pokemonApi.js as the active provider's underlying HTTP client.
 *
 * === Why this switch happened ===
 * pokemontcg.io (the previous provider) has been acquired and folded
 * into "Scrydex", a paid multi-TCG platform — multiple independent
 * sources describe the free tier as being actively wound down in
 * favor of the paid successor, with no announced shutdown date but a
 * clear direction. Since this app hadn't been deployed yet, this was
 * the right moment to switch rather than build further on a provider
 * likely to need replacing anyway. TCGdex is free, open source,
 * requires no API key, and has no hard rate limits (per its own FAQ:
 * "please be considerate").
 *
 * === The real architectural tradeoff, confirmed directly against the
 * live docs before writing this file ===
 * Every LIST-shaped response (searching cards, or the card list
 * embedded in a set) only returns brief card objects — id, name,
 * image, local number. Getting the full detail this app actually
 * needs (rarity specifically — it drives holo-effect mapping; also
 * HP) requires a SEPARATE request PER CARD. A typical 150-200 card
 * set means 150-200 individual requests, not the ~2 paginated bulk
 * requests pokemontcg.io needed for the same set. Confirmed
 * deliberately with the user — the plan is to be upfront in the UI
 * that imports take longer because this is a free, open API, rather
 * than trying to engineer the slowness away.
 *
 * One thing genuinely better here: fetching a single set already
 * embeds its ENTIRE brief card list in one request — no pagination
 * needed for that part at all (pokemontcg.io needed paginated
 * requests even just to enumerate a set's cards).
 *
 * === CORS: verified working directly in an actual browser (not a dev
 * proxy assumption) — fetching api.tcgdex.net directly from client-side
 * code succeeds with no CORS error, confirmed via:
 *
 *   fetch('https://api.tcgdex.net/v2/en/sets?pagination:itemsPerPage=1')
 *     .then(r => r.json())
 *     .then(data => console.log('CORS OK:', data))
 *     .catch(err => console.error('CORS or network failure:', err));
 *
 * No proxy needed, unlike pokemontcg.io — a real difference between
 * the two APIs, not just an assumption carried over from the old one.
 */

// === CORS confirmed working directly, no proxy needed ===
// Verified in an actual browser (not just assumed): fetching
// api.tcgdex.net directly from the client, in both dev and a real
// deploy, succeeds with no CORS error at all — unlike pokemontcg.io,
// which genuinely needed a Vite dev-proxy workaround. This file used
// to carry that same dev-proxy pattern over out of caution, routing
// every request through '/api/tcgdex' in dev mode — but since no
// proxy was ever actually configured for that path, every dev-mode
// request was silently hitting Vite's own SPA fallback page instead
// (returning HTML, not JSON) rather than the real API at all. Fixed
// by just using the real URL directly, in every environment, since
// there's no CORS problem here to work around in the first place.
const API_BASE = 'https://api.tcgdex.net/v2/en';

/**
 * Template fields for a TCGdex-imported collection. Same shape
 * Pokémon cards have always used in this app — TCGdex is a different
 * DATA SOURCE for the same game, not a different game, so the
 * template schema itself doesn't need to change.
 */
export const TCGDEX_TEMPLATE_FIELDS = [
  { field_name: 'Pokémon',     field_type: 'text',   is_required: true  },
  { field_name: 'Set',         field_type: 'text',   is_required: true  },
  { field_name: 'HP',          field_type: 'number', is_required: false },
  { field_name: 'Rarity',      field_type: 'select', is_required: true  },
  { field_name: 'Card Number', field_type: 'text',   is_required: false },
];

/**
 * Retries a fetch a few times with increasing delay, for server-side
 * errors only (5xx) — never for 4xx, which retrying would just
 * repeat identically. Same reasoning as pokemonApi.js's version.
 */
async function fetchWithRetry(url, retries = 3, delayMs = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status < 500 || attempt === retries) return res;
    await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
  }
}

// Session cache for the full sets list — doesn't change often enough
// to justify re-fetching every time the sets browser opens. Same
// reasoning as pokemonApi.js's cachedAllSets.
let cachedAllSets = null;

/**
 * Fetches every set, enriched with its real releaseDate and cardCount,
 * with Pokémon TCG Pocket sets filtered out entirely.
 *
 * TCGdex's list endpoint never includes releaseDate/cardCount at all
 * (confirmed against the live docs) — server-side sort order alone
 * would be enough for "newest/oldest first", but
 * PokemonSetsBrowser.jsx also shows each set's release YEAR and card
 * count as a badge, and has a "declutter sets before year X" feature,
 * all of which need real values, not just correct relative ordering.
 * Rather than silently break those features, this fetches each set's
 * full detail (one request per set, ~100-150 sets total across
 * Pokémon's whole history) — the same "a free, open API costs time"
 * tradeoff already accepted for full-set card imports, now also
 * applying to this browser's first load per session. Cached
 * afterward, same as before.
 *
 * === Filtering out TCG Pocket (confirmed via TCGdex's own docs,
 * https://tcgdex.dev/tcg-pocket: "All TCG Pocket cards are organized
 * under the tcgp series") ===
 * Pokémon TCG Pocket is a genuinely separate, mobile-only DIGITAL
 * game — no physical cards exist for it at all. Without filtering,
 * every TCG Pocket set (Paldean Wonders, Crimson Blaze, Fantastical
 * Parade, and others) was showing up alongside real physical sets in
 * this browser, meant specifically for tracking a physical
 * collection. Beyond just being out of scope, TCG Pocket uses an
 * entirely different rarity system (diamonds/stars/crowns, not
 * Common/Rare Holo/etc.) that this app's rarity→holoType mapping has
 * no entries for at all, and TCGdex's TCG Pocket asset coverage is
 * evidently less complete than its physical-TCG data (missing set
 * logos were the first symptom that surfaced this whole issue).
 * Filtered in the same per-set full-detail fetch this function
 * already does for releaseDate/cardCount — no extra requests needed.
 */
export async function fetchAllSets() {
  if (cachedAllSets) return cachedAllSets;

  const res = await fetchWithRetry(`${API_BASE}/sets?sort:field=releaseDate&sort:order=DESC`);
  if (!res.ok) throw new Error(`TCGdex API: fetch all sets failed (${res.status})`);
  const briefSets = await res.json();

  const enriched = [];
  for (const brief of briefSets) {
    try {
      const full = await fetchSetWithBriefCards(brief.id);
      if (full.serie?.id === 'tcgp') continue; // TCG Pocket — not a physical set, excluded entirely
      enriched.push({ ...brief, releaseDate: full.releaseDate, cardCount: full.cardCount });
    } catch (err) {
      // A single set's detail failing to load shouldn't lose every
      // other set — keep the brief version (no releaseDate/cardCount)
      // rather than aborting the whole list. Can't filter TCG Pocket
      // here since serie is only known from the detail we just
      // failed to fetch — a rare edge case (this set's OWN request
      // failed) versus the alternative of silently losing an entire
      // physical set from the list.
      console.error(`[tcgdexApi] failed to enrich set "${brief.id}" with release date:`, err);
      enriched.push(brief);
    }
  }

  cachedAllSets = enriched.map(normalizeSet);
  return cachedAllSets;
}

// Cache of full SET responses (each including its own brief card
// list) keyed by set id — avoids re-fetching the set itself on every
// preview/full-import call for the same set.
const cachedSetDetails = new Map();

async function fetchSetWithBriefCards(setId) {
  if (cachedSetDetails.has(setId)) return cachedSetDetails.get(setId);
  const res = await fetchWithRetry(`${API_BASE}/sets/${setId}`);
  if (!res.ok) throw new Error(`TCGdex API: fetch set failed (${res.status})`);
  const data = await res.json();
  cachedSetDetails.set(setId, data);
  return data;
}

// Cache of FULL card detail responses, keyed by card id — a card
// fetched during the preview step must not be re-fetched again during
// the full import, given how much the per-card request cost matters
// here specifically.
const cachedCardDetails = new Map();

async function fetchCardDetail(cardId) {
  if (cachedCardDetails.has(cardId)) return cachedCardDetails.get(cardId);
  const res = await fetchWithRetry(`${API_BASE}/cards/${cardId}`);
  if (!res.ok) throw new Error(`TCGdex API: fetch card failed (${res.status})`);
  const data = await res.json();
  cachedCardDetails.set(cardId, data);
  return data;
}

/**
 * Fetches one "page" of full card details for a set — in practice,
 * slices the set's already-fetched brief card list client-side (the
 * set's full brief list comes in one request regardless of page),
 * then fetches full detail for just that slice. Used by the import
 * modal's preview step specifically so previewing a set doesn't
 * require fetching detail for every card in it up front.
 * @returns {{ cards: object[], page: number, pageSize: number, totalCount: number }}
 */
export async function fetchCardsForSet(setId, page = 1, pageSize = 24) {
  const set = await fetchSetWithBriefCards(setId);
  const briefCards = set.cards ?? [];
  const start = (page - 1) * pageSize;
  const slice = briefCards.slice(start, start + pageSize);

  // Sequential, not parallel — deliberate, given the API's own "be
  // considerate" guidance and the sheer number of these requests a
  // full set import already generates.
  const cards = [];
  for (const brief of slice) {
    cards.push(await fetchCardDetail(brief.id));
  }

  return { cards: cards.map(normalizeCard), page, pageSize, totalCount: set.cardCount?.official ?? briefCards.length };
}

/**
 * Fetches full detail for every card in a set. This is the expensive
 * path — one request per card, after the one request to get the
 * set's brief card list — sequential to stay considerate of the API,
 * at the direct cost of import time. Reusing whatever's already
 * cached (e.g. from the preview step) avoids re-fetching those.
 */
export async function fetchAllCardsForSet(setId, onProgress) {
  const set = await fetchSetWithBriefCards(setId);
  const briefCards = set.cards ?? [];

  const allCards = [];
  for (let i = 0; i < briefCards.length; i++) {
    allCards.push(await fetchCardDetail(briefCards[i].id));
    onProgress?.(i + 1, briefCards.length);
  }
  return allCards.map(normalizeCard);
}

// === Rarity → holoType mapping ===
// Pinder's holoType enum (see src/types/holoTypes.js) has 8 values:
// off, none, holo, galaxy, rainbow, gold, v, vstar.
//
// TCGdex's rarity strings are NOT the same as pokemontcg.io's in
// every case — confirmed directly against TCGdex's own source
// (cards-database/interfaces.d.ts doc comments), which lists real
// examples including "Holo Rare" (not "Rare Holo" — reversed word
// order from pokemontcg.io) and several rarities with no equivalent
// in the original table at all (Classic Collection, Full Art Trainer,
// Radiant Rare). Unlike the original table — which was reviewed and
// finalized directly with the user against a reference project — this
// port is a best-effort adaptation, NOT independently re-verified the
// same rigorous way. Anything genuinely wrong will surface via the
// existing "unrecognized rarity" console.warn below once real TCGdex
// data flows through the app; treat that warning as the signal to
// come back and correct this table, not as a sign something is broken.
const RARITY_TO_HOLO_TYPE = {
  // Regular — no special foil/holo treatment
  'Common':   'none',
  'Uncommon': 'none',
  'Rare':     'none',
  'Promo':    'none',
  'None':     'none',

  // Holo — textured/premium but not the top gold/rainbow tier.
  // TCGdex uses "Holo Rare" (reversed word order from pokemontcg.io's
  // "Rare Holo") — both forms kept here since real data might use
  // either depending on source/era.
  'Holo Rare':          'holo',
  'Rare Holo':          'holo',
  'Rare Holo EX':       'holo',
  'Rare Holo GX':       'holo',
  'Rare Holo LV.X':     'holo',
  'Rare Holo Star':     'holo',
  'Rare Prime':         'holo',
  'Rare Prism Star':    'holo',
  'ACE SPEC Rare':      'holo',
  'Rare BREAK':         'holo',
  'LEGEND':             'holo',
  'Rare Shining':       'holo',
  'Rare Shiny':         'holo',
  'Rare Shiny GX':      'holo',
  'Illustration Rare':  'holo',
  'Illustration rare':  'holo', // TCGdex's own casing, kept explicit since normalization should already cover this but the source data is inconsistent enough to be worth being explicit
  'Full Art Trainer':   'holo', // not in the original table — best-effort guess, not independently confirmed
  'Black White Rare':   'holo',
  'Special Illustration Rare': 'holo',

  // Galaxy
  'Rare Holo Galaxy': 'galaxy',

  // Rainbow
  'Rare Rainbow':  'rainbow',
  'Amazing Rare':  'rainbow',

  // Gold — all-gold foil/border treatment
  'Rare Secret':      'gold',
  'Rare Ultra':       'gold',
  'Ultra Rare':       'gold',
  'Hyper Rare':       'gold',
  'Hyper rare':       'gold', // TCGdex's own casing, explicit for the same reason as Illustration rare above
  'Mega Hyper Rare':  'gold',
  'Classic Collection': 'gold', // not in the original table — best-effort guess, not independently confirmed

  // V tier — modern "ex"/Double Rare cards structurally replaced V,
  // so grouped together; Radiant Rare guessed here too (a single-per-
  // deck spotlight rarity, closer to V-tier prominence than a plain
  // holo) — this one especially is a guess, worth watching for
  // real-card confirmation
  'Rare Holo V':     'v',
  'Holo Rare V':     'v',
  'Rare Holo VMAX':  'v',
  'Holo Rare VMAX':  'v',
  'Double Rare':     'v',
  'Double rare':     'v', // TCGdex's own casing, explicit for the same reason as above
  'Radiant Rare':    'v', // not in the original table — best-effort guess, not independently confirmed

  // VSTAR
  'Rare Holo VSTAR': 'vstar',
  'Holo Rare VSTAR': 'vstar',
};

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
  console.warn(`[tcgdexApi] Unrecognized rarity "${rarity}" — defaulting holoType to 'none'. Add this to RARITY_TO_HOLO_TYPE if it's common enough to matter.`);
  return 'none';
}

/**
 * TCGdex CARD image URLs come without a file extension OR quality
 * suffix by design — the caller appends both, e.g. ".../136/high.webp".
 * "high" + "webp" is used for the best available image at a
 * reasonable file size.
 */
function fullCardImageUrl(baseImageUrl) {
  if (!baseImageUrl) return null;
  return `${baseImageUrl}/high.webp`;
}

/**
 * TCGdex ASSET images (set logos/symbols) come without a file
 * extension too, but — unlike card images — take just a format
 * suffix directly, no quality subdirectory (confirmed against the
 * live Set object docs: "you can add .(webp|png|jpg) to customize
 * the format").
 */
function fullAssetUrl(baseAssetUrl) {
  if (!baseAssetUrl) return null;
  return `${baseAssetUrl}.webp`;
}

/**
 * === Normalization: the actual fix for a real bug found during
 * testing — set logos, card thumbnails, and card counts were all
 * silently missing in the UI after switching to TCGdex. The cause:
 * TCGdex's raw response shape genuinely differs from pokemontcg.io's
 * in exactly the fields the existing UI (PokemonSetsBrowser.jsx,
 * PokemonImportModal.jsx) reads directly — set.images.logo/symbol
 * (nested) vs TCGdex's flat set.logo/set.symbol; set.total (flat) vs
 * TCGdex's nested set.cardCount.official; card.images.small/large
 * (nested) vs TCGdex's flat card.image. Since those checks used
 * optional chaining, the shape mismatch failed completely silently —
 * no error, just missing images and blank counts.
 *
 * Normalizing here, at the provider boundary, is what actually keeps
 * the "swap providers without touching UI" promise — these functions
 * ADD the shape the UI expects alongside the raw TCGdex fields
 * (never removing them), so mapTcgdexCardToDraft and anything else
 * reading the raw fields directly keeps working unchanged.
 */
function normalizeSet(rawSet) {
  return {
    ...rawSet,
    total: rawSet.cardCount?.official ?? rawSet.cardCount?.total ?? 0,
    images: {
      logo: fullAssetUrl(rawSet.logo),
      symbol: fullAssetUrl(rawSet.symbol),
    },
  };
}

function normalizeCard(rawCard) {
  return {
    ...rawCard,
    images: {
      small: fullCardImageUrl(rawCard.image),
      large: fullCardImageUrl(rawCard.image),
    },
  };
}

/**
 * Maps one raw TCGdex card object into the shape createCardDefinition
 * expects, MINUS image_url — the image itself still needs to be
 * fetched and uploaded to Storage in the calling import flow.
 */
export function mapTcgdexCardToDraft(apiCard) {
  return {
    name: apiCard.name,
    externalCardId: apiCard.id,
    sourceImageUrl: fullCardImageUrl(apiCard.image),
    holoType: mapRarityToHoloType(apiCard.rarity),
    rarity: apiCard.rarity ?? null,
    attributes: {
      'Pokémon':     apiCard.name,
      'Set':         apiCard.set?.name ?? '',
      'HP':          apiCard.hp ? Number(apiCard.hp) : null,
      'Rarity':      apiCard.rarity ?? '',
      'Card Number': apiCard.localId ?? '',
    },
  };
}