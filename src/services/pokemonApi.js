/**
 * @fileoverview Pokémon TCG API integration — STUB FILE.
 * === ISSUE #127: API Dependency Spike (Pokémon TCG SDK) ===
 *
 * This is a spike, not the full integration — that's Milestone 13.
 * Everything below is what was actually verified before writing any
 * real import code, per the issue's own goal: catch SDK gotchas in a
 * 30-minute spike, not halfway through building the import screen.
 *
 * === PACKAGE NAME GOTCHA (found immediately) ===
 * The issue says `npm install pokemon-tcg-sdk-javascript` — that
 * package does NOT exist on npm (404). `pokemon-tcg-sdk-javascript`
 * is the GitHub repo name; the actual published npm package is:
 *
 *   npm install pokemontcgsdk
 *
 * (github.com/PokemonTCG/pokemon-tcg-sdk-javascript, published as
 * "pokemontcgsdk" — no hyphens.)
 *
 * === BROWSER COMPATIBILITY: CONFIRMED WORKING, NO WORKAROUND NEEDED ===
 * The SDK's own code only imports axios and qs — no direct Node
 * built-in requires (fs, path, crypto, etc). axios itself DOES use
 * Node's http/https internally, BUT axios's package.json declares a
 * "browser" field that swaps ./lib/adapters/http.js for
 * ./lib/adapters/xhr.js, and Vite respects this automatically.
 * Verified by actually building it (not just reading source):
 *   - `vite build` with the SDK imported from the real entry point
 *     succeeds with zero errors about unresolvable Node built-ins
 *   - grepped the built output for require("http")/require("fs")/
 *     require("path") — zero matches
 *   - grepped for "XMLHttpRequest" — present, confirming the browser
 *     adapter is what actually got bundled
 * No vite.config.js resolve.alias needed. If this SDK is ever
 * upgraded and this stops being true, re-run this same build+grep
 * check before assuming it's still fine.
 *
 * === SECURITY WARNING (found during the spike, not asked for but
 * important) === pokemontcgsdk@2.0.0 pins axios ^0.21.1 — `npm audit`
 * flags 2 high-severity vulnerabilities on this exact dependency
 * chain (SSRF, prototype pollution, credential leakage — see
 * advisories GHSA-wf5p-g6vw-rhxx and others). This is the SDK's own
 * pinned version, not something a normal npm install would fix.
 * Before Milestone 13's full integration, decide: accept the risk
 * (low, since this only ever calls a read-only public API — no user
 * input reaches axios's config), skip the SDK and call the REST API
 * directly with fetch() instead (removes the dependency entirely),
 * or use npm audit fix --force (breaking change, untested here).
 *
 * === API KEY ===
 * Not required. All requests work unauthenticated, per the issue's
 * own numbers: 1,000 requests/day without a key, 20,000/day with one
 * (via the X-Api-Key header). For a spike this size, no key was
 * needed. For Milestone 13's real import volume, get a free key at
 * https://dev.pokemontcg.io and add:
 *
 *   VITE_POKEMON_TCG_API_KEY=your-key-here
 *
 * to .env.local, then pass it via configure({ apiKey: import.meta.env.
 * VITE_POKEMON_TCG_API_KEY }) before making any SDK calls.
 *
 * === RESPONSE SHAPE ===
 * All v2 endpoints wrap results in a top-level "data" property —
 * e.g. GET /v2/sets returns { data: [...] }, not { sets: [...] }.
 * The SDK's own methods (PokemonTCG.card.where(), .set.all(), etc.)
 * already unwrap this for you.
 *
 * A card object (from GET /v2/cards or PokemonTCG.card.find/where)
 * looks like:
 *   {
 *     id: "swsh1-1",                          // set-id + card number
 *     name: "Celebi V",
 *     supertype: "Pokémon",                    // Pokémon | Trainer | Energy
 *     subtypes: ["Basic"],
 *     hp: "180",
 *     types: ["Grass"],
 *     rarity: "Rare Holo V",                   // see mapping below
 *     images: { small: "https://...png", large: "https://...png" },
 *     set: { id: "swsh1", name: "Sword & Shield", series: "...", ... },
 *     attacks: [{ name, cost, damage, text }],
 *     legalities: { unlimited: "Legal", standard: "Legal" },
 *     tcgplayer: { url, prices: {...} },        // USD pricing, optional
 *     cardmarket: { url, prices: {...} },        // EUR pricing, optional
 *     ...
 *   }
 *
 * === FIELD MAPPING for createCardDefinition (Milestone 13) ===
 *   name         ← card.name                                (direct)
 *   image_url    ← card.images.large (or .small for thumbnails) (direct,
 *                  but goes through uploadImageToStorage first — see
 *                  Issue #125 — the API's own URL is NOT what gets
 *                  stored; the image gets fetched and re-uploaded to
 *                  our own card-images bucket so it survives even if
 *                  the API's own image host ever changes/dies)
 *   holoType     ← NOT a direct field. Must be derived from
 *                  card.rarity via a mapping table, since the API's
 *                  rarity strings ("Rare Holo", "Rare Holo VMAX",
 *                  "Rare Rainbow", "Rare Holo GX", "Rare Secret", "Rare
 *                  Ultra", "Common", etc.) don't line up 1:1 with
 *                  Pinder's 8-type holoType enum (regular/holo/galaxy/
 *                  rainbow/gold/v/vstar/off). This mapping table is
 *                  Milestone 13 work, not written here.
 *   attributes   ← derived from card.hp, card.types, card.subtypes,
 *                  card.rarity, card.supertype etc., mapped onto
 *                  whatever template_fields the target collection
 *                  actually has — not a direct 1:1 copy.
 *   collectionId ← NOT from the API at all. This is Pinder's own
 *                  internal collection id, created when a "set" is
 *                  imported as a collection; card.set.id (the API's
 *                  own set identifier, e.g. "swsh1") should be stored
 *                  in collections.import_source for traceability, not
 *                  used as collectionId directly.
 *
 * The full implementation (mapping table, actual import UI, batch
 * upload flow) is Milestone 13. This file is intentionally a stub.
 */

export {};