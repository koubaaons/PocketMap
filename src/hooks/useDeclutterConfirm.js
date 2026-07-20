/**
 * @fileoverview useDeclutterConfirm — gates a declutter action behind
 * a confirmation step whenever any of the cards being decluttered are
 * currently placed somewhere in a binder.
 *
 * Decluttering removes those placements outright (see reducer.js's
 * CARD_DEFINITION_BULK_SET_DECLUTTERED for why) — silently doing that
 * without warning would be a surprising, easy-to-regret way to lose a
 * binder layout, so every tab that offers "Declutter" checks first
 * and only proceeds straight away when nothing would actually be
 * affected.
 */

import { useState } from 'react';
import { getOrganisedCardDefIds } from '../selectors/binderSelectors.js';

export function useDeclutterConfirm({ binderSlots = [], binderPanels = [], onDeclutter }) {
  const [pendingIds, setPendingIds] = useState(null); // null = nothing awaiting confirmation

  const requestDeclutter = (ids) => {
    if (ids.length === 0) return;
    const placedSet = new Set(getOrganisedCardDefIds(binderSlots, binderPanels));
    const anyPlaced = ids.some(id => placedSet.has(id));
    if (anyPlaced) {
      setPendingIds(ids);
    } else {
      onDeclutter(ids);
    }
  };

  const confirmDeclutter = () => {
    if (pendingIds) onDeclutter(pendingIds);
    setPendingIds(null);
  };

  const cancelDeclutter = () => setPendingIds(null);

  return { pendingIds, requestDeclutter, confirmDeclutter, cancelDeclutter };
}