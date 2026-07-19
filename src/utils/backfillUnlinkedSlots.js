/**
 * @fileoverview backfillUnlinkedSlots.
 *
 * Fixes a real, significant bug reported directly by the user: cards
 * genuinely owned were showing as unowned/grey in a binder after
 * every refresh, even though the Collection view correctly showed
 * them as owned. Root cause: the binder's own "is this slot owned"
 * check was made strict (see BinderPage.jsx) to correctly support
 * independent copies — a slot only counts as owned if it's linked to
 * a SPECIFIC, still-existing copy, with no fallback to "is this card
 * owned anywhere". That's correct for genuinely independent copies,
 * but any slot that was never linked at all — most commonly, one
 * placed before per-copy linking existed as a feature — has no way
 * to know it should show as owned under this stricter rule.
 *
 * This pairs up any unlinked slot/panel with an available copy of the
 * same card (one not already linked to a different slot/panel),
 * self-healing existing data every time state loads rather than
 * requiring a one-time migration script. Used by both storage.js
 * (localStorage path) and supabaseStorage.js (the main, Supabase-
 * backed path) — extracted here since both need the identical logic
 * and neither should import from the other.
 *
 * @param {object[]} inventory
 * @param {object[]} binderSlots
 * @param {object[]} binderPanels
 * @returns {{ binderSlots: object[], binderPanels: object[] }}
 */
export function backfillUnlinkedSlots(inventory, binderSlots, binderPanels) {
  const linkedIds = new Set([
    ...binderSlots.filter(s => s.inventoryItemId).map(s => s.inventoryItemId),
    ...binderPanels.filter(p => p.panelType === 'card' && p.inventoryItemId).map(p => p.inventoryItemId),
  ]);

  const availableByCard = {};
  inventory.forEach(inv => {
    if (!linkedIds.has(inv.id)) (availableByCard[inv.cardDefId] ??= []).push(inv);
  });

  const backfilledSlots = binderSlots.map(s => {
    if (s.inventoryItemId) return s;
    const pool = availableByCard[s.cardDefId];
    if (!pool || pool.length === 0) return s;
    const claimed = pool.shift();
    return { ...s, inventoryItemId: claimed.id };
  });

  const backfilledPanels = binderPanels.map(p => {
    if (p.panelType !== 'card' || p.inventoryItemId) return p;
    const pool = availableByCard[p.cardDefId];
    if (!pool || pool.length === 0) return p;
    const claimed = pool.shift();
    return { ...p, inventoryItemId: claimed.id };
  });

  return { binderSlots: backfilledSlots, binderPanels: backfilledPanels };
}