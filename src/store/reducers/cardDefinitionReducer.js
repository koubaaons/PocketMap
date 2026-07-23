/**
 * @fileoverview cardDefinitionReducer — Card definitions — create/update/soft-delete a card, and bulk decluttering.
 *
 * Split out of the monolithic reducer.js (was a single 900+ line, 43-
 * case switch statement) for scalability, matching the domain groups
 * identified during a full code audit. Each domain file still takes
 * and returns the FULL app state, exactly like the original switch
 * cases did — this isn't a classic Redux combineReducers split, since
 * several actions here genuinely need to read/write multiple slices
 * of state at once (e.g. deleting a card definition also has to clean
 * up its binder slots and inventory). The root reducer.js just routes
 * each action type to the right domain file instead of handling
 * everything in one switch.
 */

import { ACTIONS } from '../actionTypes.js';

export function cardDefinitionReducer(state, action) {
  switch (action.type) {


    case ACTIONS.CARD_DEFINITION_ADD:
      return { ...state, cardDefinitions: [...state.cardDefinitions, action.payload] };


    case ACTIONS.CARD_DEFINITION_BULK_ADD:
      return { ...state, cardDefinitions: [...state.cardDefinitions, ...action.payload] };


    case ACTIONS.CARD_DEFINITION_UPDATE:
      return {
        ...state,
        cardDefinitions: state.cardDefinitions.map(cd =>
          cd.id === action.payload.id
            ? { ...cd, ...action.payload, updatedAt: Date.now() }
            : cd
        ),
      };

    // === New: Declutter — hides one or many card definitions
    // everywhere (Owned/Missing/Unorganised/Cards) without touching
    // ownership, binder placement, or anything else about them.
    // Restoring is the exact same action with isDecluttered: false.
    // Batch-shaped from the start (ids: string[]) since this is
    // explicitly meant to be usable via multiselect.
    //
    // === FIX (real bug: decluttered cards stayed in binders): a
    // hidden card definition left its binder_slots/binder_panels
    // rows completely untouched, still pointing at a card that no
    // longer shows up anywhere else — visually it'd look like a
    // regular placed card despite supposedly not existing anymore.
    // Declutter now removes those placements outright (same as
    // permanently deleting a card, below), not just unlinks them —
    // there's no "unowned placeholder" concept that makes sense for a
    // card that's meant to act like it doesn't exist. Restoring
    // (isDecluttered: false) leaves binders alone; there's no
    // reasonable way to know where a placement used to be once it's
    // gone, so restoring only brings the card back to the normal
    // tabs, not back into a binder.

    case ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED: {
      const { ids, isDecluttered } = action.payload;
      const idSet = new Set(ids);
      return {
        ...state,
        cardDefinitions: state.cardDefinitions.map(cd =>
          idSet.has(cd.id) ? { ...cd, isDecluttered, updatedAt: Date.now() } : cd
        ),
        binderSlots: isDecluttered
          ? state.binderSlots.filter(s => !idSet.has(s.cardDefId))
          : state.binderSlots,
        binderPanels: isDecluttered
          ? state.binderPanels.filter(p => !(p.panelType === 'card' && idSet.has(p.cardDefId)))
          : state.binderPanels,
      };
    }

    // === FIX3: save inventory item to bin alongside card def ===

    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload;
      const cardDef = state.cardDefinitions.find(cd => cd.id === cardDefId);
      if (!cardDef) return state;
      // === FIX (real bug, found while writing tests for this: quantity
      // tracking made owning several copies of one card real, but this
      // still only captured ONE via .find() before wiping ALL of them
      // out of active state — deleting a card with 3 owned copies
      // silently, permanently lost 2 of them; restoring only ever
      // brought back 1. Now captures every copy, and BIN_RESTORE_CARD
      // below restores all of them, not just one. ===
      const inventoryItems = state.inventory.filter(inv => inv.cardDefId === cardDefId);
      return {
        ...state,
        inventory:       state.inventory.filter(inv => inv.cardDefId !== cardDefId),
        binderSlots:     state.binderSlots.filter(s => s.cardDefId !== cardDefId),
        binderPanels:    state.binderPanels.filter(p => p.cardDefId !== cardDefId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== cardDefId),
        bin: [...state.bin, {
          ...cardDef,
          _type:           'cardDef',
          deletedAt:       Date.now(),
          _inventoryItems: inventoryItems,
        }],
      };
    }

    // === CHANGED (quantity tracking): this used to reject adding a
    // second inventory row for a card already owned once — that was
    // exactly right when ownership was purely boolean, but now that
    // owning multiple copies is a real, intentional feature (see
    // inventorySelectors.js's buildInventoryGroupMap), this was
    // silently blocking every "Add Another Copy" click, leaving the
    // card looking like it still had only 1 (or even 0, if this was
    // the very first add and something else raced it) copies. Each
    // INVENTORY_ADD is a genuinely new, distinct physical copy now,
    // not a toggle.
    // === FIX (real bug reported directly by the user: "owned and
    // unowned state is totally disconnected from the binders"):
    // owning a card from the Collection view (or really, anywhere
    // other than a specific slot's own hover toggle) used to just
    // create the inventory row with no connection to any existing
    // slot at all. If that card already had an unowned, grey
    // placeholder slot sitting in a binder, it stayed grey forever —
    // nothing ever told it a copy had become available to claim. Now,
    // right after creating the item, this looks for exactly one
    // existing unlinked slot or panel for the same card and links it
    // immediately, so ownership actually shows up wherever the card
    // already has a placeholder waiting for it. ===
    default:
      return state;
  }
}
