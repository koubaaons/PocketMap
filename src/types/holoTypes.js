/**
 * @fileoverview Holographic card type registry — single source of
 * truth for every holo type's id, display label, and real image
 * asset dependencies.
 *
 * === Why this file exists ===
 * Before this, a type's id lived in collection.types.js's HOLO_TYPES
 * array, and its display label lived SEPARATELY in
 * CardDefinitionForm.jsx's HOLO_LABELS object — two files, two lists,
 * nothing keeping them in sync. Adding a type meant remembering to
 * touch both; forgetting the label would silently render `undefined`
 * as a button's text with no error anywhere. This file consolidates
 * id + label + asset info into ONE list; everything else derives from
 * it instead of maintaining a parallel copy.
 *
 * === Adding a new type ===
 * Add one entry here with id/label/images, then write its actual CSS
 * recipe in card-holo.css under that id (see card-holo.css's own
 * comment block for the per-type CSS conventions: variable prefixing,
 * which selectors to target, etc). Nothing else needs to change —
 * HOLO_TYPES and the form's button list both read from this file.
 *
 * `images` is informational (lets this file double as a manifest of
 * which /public/img/ assets a given type expects), not something the
 * runtime code currently enforces or validates against.
 */

/**
 * === SEMANTIC NOTE on 'off' vs 'none' ===
 * 'none' USED TO mean "no effect at all" (the picker's reset option,
 * and the factory default for every card). It now means Regular Holo
 * — every TCG card has at least a subtle holo sheen in real life, so
 * 'none' became an ACTIVE recipe (the lightest one — just a single
 * generic glare layer) rather than a no-op, and is still the factory
 * default in collection.types.js's createCardDefinition — meaning
 * every card, including ones already in storage from before this
 * change, shows this subtle shine by default, by explicit decision.
 *
 * 'off' is the genuinely-flat value, for a card with literally no
 * shine at all. It's the ONLY id that BinderSlot.jsx / CardDetailModal
 * .jsx / CardDefinitionForm.jsx treat as "don't render any holo
 * overlay" — every other id, including 'none', activates the effect
 * machinery (pointer tracking, the two overlay elements, etc).
 */
export const HOLO_TYPE_REGISTRY = [
  { id: 'off', label: 'Off', images: [] },
  { id: 'none', label: 'Regular', images: [] },
  { id: 'holo', label: 'Holo', images: [] },
  { id: 'galaxy', label: 'Galaxy', images: ['cosmos-bottom.png', 'cosmos-middle-trans.png', 'cosmos-top-trans.png'] },
  { id: 'rainbow', label: 'Rainbow', images: ['glitter.png'] },
  { id: 'gold', label: 'Gold', images: ['glitter.png', 'geometric.png'] },
  { id: 'v', label: 'V', images: ['grain.webp'] },
  { id: 'vstar', label: 'VStar', images: ['ancient.png'] },
];

// Plain id list, derived — this is what collection.types.js's
// validator and createCardDefinition's clamping actually check
// against. Never hand-maintain a second copy of this list elsewhere.
export const HOLO_TYPES = HOLO_TYPE_REGISTRY.map(t => t.id);

// id -> label lookup, derived — this is what CardDefinitionForm.jsx's
// picker reads instead of keeping its own HOLO_LABELS object.
export const HOLO_LABELS = HOLO_TYPE_REGISTRY.reduce((acc, t) => {
  acc[t.id] = t.label;
  return acc;
}, {});