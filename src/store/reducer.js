/**
 * @fileoverview Pure reducer — all state transitions live here.
 * No side effects. No localStorage, no DOM, no fetch.
 */

import { validateOneTemplatePerCollection } from '../types/index.js';
import { isSlotPositionFree } from '../selectors/binderSelectors.js';

export const ACTIONS = Object.freeze({
  BINDER_ADD:      'BINDER_ADD',
  BINDER_UPDATE:   'BINDER_UPDATE',
  BINDER_DELETE:   'BINDER_DELETE',
  BINDER_ADD_PAGE: 'BINDER_ADD_PAGE',
  BIN_RESTORE_BINDER:     'BIN_RESTORE_BINDER',
  BIN_RESTORE_COLLECTION: 'BIN_RESTORE_COLLECTION',
  BIN_RESTORE_CARD:       'BIN_RESTORE_CARD',
  BIN_RESTORE_INVENTORY_ITEM: 'BIN_RESTORE_INVENTORY_ITEM',
  BIN_DELETE_ITEM:        'BIN_DELETE_ITEM',
  BIN_EMPTY:              'BIN_EMPTY',
  NAV_SET:  'NAV_SET',
  AUTH_SET: 'AUTH_SET',
  HYDRATE:  'HYDRATE',
  COLLECTION_ADD:    'COLLECTION_ADD',
  COLLECTION_UPDATE: 'COLLECTION_UPDATE',
  COLLECTION_DELETE: 'COLLECTION_DELETE',
  TEMPLATE_FIELD_ADD:      'TEMPLATE_FIELD_ADD',
  TEMPLATE_FIELD_BULK_ADD: 'TEMPLATE_FIELD_BULK_ADD',
  TEMPLATE_FIELD_UPDATE:   'TEMPLATE_FIELD_UPDATE',
  TEMPLATE_FIELD_REORDER:  'TEMPLATE_FIELD_REORDER',
  CARD_DEFINITION_ADD:      'CARD_DEFINITION_ADD',
  CARD_DEFINITION_BULK_ADD: 'CARD_DEFINITION_BULK_ADD',
  CARD_DEFINITION_UPDATE:   'CARD_DEFINITION_UPDATE',
  CARD_DEFINITION_DELETE:   'CARD_DEFINITION_DELETE',
  INVENTORY_ADD:    'INVENTORY_ADD',
  INVENTORY_UPDATE: 'INVENTORY_UPDATE',
  INVENTORY_DELETE: 'INVENTORY_DELETE',
  BINDER_SLOT_ADD:    'BINDER_SLOT_ADD',
  BINDER_SLOT_REMOVE: 'BINDER_SLOT_REMOVE',
  BINDER_SLOT_MOVE:   'BINDER_SLOT_MOVE',
  // === Michi Method support: combined slots ===
  BINDER_INSERT_ADD:    'BINDER_INSERT_ADD',
  BINDER_INSERT_DELETE: 'BINDER_INSERT_DELETE',
  BINDER_PANEL_ADD:     'BINDER_PANEL_ADD',
  BINDER_PANEL_UPDATE:  'BINDER_PANEL_UPDATE',
  BINDER_PANEL_REMOVE:  'BINDER_PANEL_REMOVE',
});

export function reducer(state, action) {
  switch (action.type) {

    case ACTIONS.BINDER_ADD:
      return { ...state, binders: [...state.binders, action.payload] };

    case ACTIONS.BINDER_UPDATE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };

    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload;
      const binder = state.binders.find(b => b.id === binderId);
      if (!binder) return state;
      return {
        ...state,
        binders: state.binders.filter(b => b.id !== binderId),
        binderSlots: state.binderSlots.filter(s => s.binderId !== binderId),
        binderPanels: state.binderPanels.filter(p => p.binderId !== binderId),
        bin: [...state.bin, { ...binder, _type: 'binder', deletedAt: Date.now() }],
        nav: state.nav.currentView === 'binder' && state.nav.currentBinderId === binderId
          ? { ...state.nav, currentView: 'home', currentBinderId: null, currentPage: 1 }
          : state.nav,
      };
    }

    case ACTIONS.BINDER_ADD_PAGE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.binderId ? { ...b, pages: b.pages + 1 } : b
        ),
      };

    // ── Bin ───────────────────────────────────────────────────────────────────

    case ACTIONS.BIN_RESTORE_BINDER: {
      const { itemId } = action.payload;
      const item = state.bin.find(b => b.id === itemId && b._type === 'binder');
      if (!item) return state;
      const { _type, deletedAt, ...binder } = item;
      return {
        ...state,
        binders: [...state.binders, binder],
        bin: state.bin.filter(b => b.id !== itemId),
      };
    }

    // === FIX4: restore collection with all cards, fields, and inventory ===
    case ACTIONS.BIN_RESTORE_COLLECTION: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'collection');
      if (!item) return state;
      const { _type, deletedAt, _cardDefs, _templateFields, _inventoryItems, ...collection } = item;
      return {
        ...state,
        collections:     [...state.collections, collection],
        cardDefinitions: _cardDefs       ? [...state.cardDefinitions, ..._cardDefs]      : state.cardDefinitions,
        templateFields:  _templateFields ? [...state.templateFields,  ..._templateFields] : state.templateFields,
        inventory:       _inventoryItems ? [...state.inventory,        ..._inventoryItems] : state.inventory,
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    // === FIX3: restore card with owned and favorite state ===
    case ACTIONS.BIN_RESTORE_CARD: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'cardDef');
      if (!item) return state;
      const { _type, deletedAt, _inventoryItem, ...cardDef } = item;
      return {
        ...state,
        cardDefinitions: [...state.cardDefinitions, cardDef],
        inventory: _inventoryItem
          ? [...state.inventory, _inventoryItem]
          : state.inventory,
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    // === Quantity tracking: restore a single removed copy ===
    case ACTIONS.BIN_RESTORE_INVENTORY_ITEM: {
      const { itemId } = action.payload;
      const item = state.bin.find(i => i.id === itemId && i._type === 'inventoryItem');
      if (!item) return state;
      const { _type, deletedAt, cardName, hadPlacementRemoved, _removedSlot, _removedPanel, ...inventoryItem } = item;

      // === Handles the edge case flagged directly by the user: if
      // the old slot/panel position has since been taken by a
      // DIFFERENT card, don't overwrite it — just restore ownership
      // of this copy without its old placement. The UI predicts this
      // same outcome itself (useBinActions.js) using the identical
      // check, right before dispatching, to show an accurate message.
      let binderSlots  = state.binderSlots;
      let binderPanels = state.binderPanels;

      const binderStillExists = (binderId) => state.binders.some(b => b.id === binderId);

      if (_removedSlot && binderStillExists(_removedSlot.binderId) &&
          isSlotPositionFree(state.binderSlots, _removedSlot.binderId, _removedSlot.pageNumber, _removedSlot.slotIndex)) {
        binderSlots = [...state.binderSlots, { ..._removedSlot, inventoryItemId: inventoryItem.id }];
      } else if (_removedPanel && binderStillExists(_removedPanel.binderId)) {
        // Panels don't share binder_slots' simple per-position
        // occupancy check — a panel is "free" if nothing (slot or
        // panel) currently covers any of the cells its own span
        // would occupy. Kept simple here: only re-add if literally
        // nothing currently starts at that exact position.
        const positionTaken = state.binderPanels.some(
          p => p.binderId === _removedPanel.binderId && p.pageNumber === _removedPanel.pageNumber && p.startSlotIndex === _removedPanel.startSlotIndex
        ) || !isSlotPositionFree(state.binderSlots, _removedPanel.binderId, _removedPanel.pageNumber, _removedPanel.startSlotIndex);
        if (!positionTaken) {
          binderPanels = [...state.binderPanels, { ..._removedPanel, inventoryItemId: inventoryItem.id }];
        }
      }

      return {
        ...state,
        inventory: [...state.inventory, inventoryItem],
        binderSlots,
        binderPanels,
        bin: state.bin.filter(i => i.id !== itemId),
      };
    }

    case ACTIONS.BIN_DELETE_ITEM: {
      // === FIX (real gap): this used to only clear state.bin itself,
      // leaving cardDefinitions/binderSlots/binders/collections
      // completely untouched locally — the server-side cascade (see
      // supabaseSync.js) is correct, but local state relied entirely
      // on an eventual realtime-triggered hydrate to catch up. Any
      // gap in that timing left orphaned binderSlots in memory,
      // referencing a card that's already gone — rendering blank but
      // still "occupying" that position (see the orphan-aware fix on
      // BINDER_SLOT_ADD above, which is the defensive half of this
      // same fix). This is the proactive half: mirror what
      // CARD_DEFINITION_DELETE already does correctly, immediately,
      // rather than waiting on a network round-trip to fix it.
      const { itemId } = action.payload;
      const binItem = state.bin.find(b => b.id === itemId);
      if (!binItem) return { ...state, bin: state.bin.filter(b => b.id !== itemId) };

      if (binItem._type === 'cardDef') {
        return {
          ...state,
          inventory:       state.inventory.filter(inv => inv.cardDefId !== itemId),
          binderSlots:     state.binderSlots.filter(s => s.cardDefId !== itemId),
          binderPanels:    state.binderPanels.filter(p => p.cardDefId !== itemId),
          cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== itemId),
          bin:             state.bin.filter(b => b.id !== itemId),
        };
      }
      if (binItem._type === 'binder') {
        return {
          ...state,
          binderSlots:  state.binderSlots.filter(s => s.binderId !== itemId),
          binderPanels: state.binderPanels.filter(p => p.binderId !== itemId),
          binders:      state.binders.filter(b => b.id !== itemId),
          bin:          state.bin.filter(b => b.id !== itemId),
        };
      }
      if (binItem._type === 'collection') {
        const cardIdsInCollection = state.cardDefinitions
          .filter(cd => cd.collectionId === itemId)
          .map(cd => cd.id);
        return {
          ...state,
          inventory:       state.inventory.filter(inv => !cardIdsInCollection.includes(inv.cardDefId)),
          binderSlots:     state.binderSlots.filter(s => !cardIdsInCollection.includes(s.cardDefId)),
          binderPanels:    state.binderPanels.filter(p => !cardIdsInCollection.includes(p.cardDefId)),
          cardDefinitions: state.cardDefinitions.filter(cd => cd.collectionId !== itemId),
          templateFields:  state.templateFields.filter(f => f.collectionId !== itemId),
          collections:     state.collections.filter(c => c.id !== itemId),
          bin:             state.bin.filter(b => b.id !== itemId),
        };
      }
      return { ...state, bin: state.bin.filter(b => b.id !== itemId) };
    }

    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };

    case ACTIONS.NAV_SET:
      return { ...state, nav: { ...state.nav, ...action.payload } };

    case ACTIONS.AUTH_SET:
      return { ...state, user: action.payload };

    case ACTIONS.HYDRATE:
      return {
        ...state,
        binders:         action.payload.binders         ?? state.binders,
        binderSlots:     action.payload.binderSlots     ?? state.binderSlots,
        binderInserts:   action.payload.binderInserts   ?? state.binderInserts,
        binderPanels:    action.payload.binderPanels    ?? state.binderPanels,
        collections:     action.payload.collections     ?? state.collections,
        templateFields:  action.payload.templateFields  ?? state.templateFields,
        cardDefinitions: action.payload.cardDefinitions ?? state.cardDefinitions,
        inventory:       action.payload.inventory       ?? state.inventory,
        bin:             action.payload.bin             ?? state.bin,
      };

    case ACTIONS.COLLECTION_ADD:
      return { ...state, collections: [...state.collections, action.payload] };

    case ACTIONS.COLLECTION_UPDATE:
      return {
        ...state,
        collections: state.collections.map(c =>
          c.id === action.payload.id
            ? { ...c, ...action.payload, updatedAt: Date.now() }
            : c
        ),
      };

    // === FIX4: save cards, fields, inventory to bin on collection delete ===
    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload;
      const collection = state.collections.find(c => c.id === collectionId);
      if (!collection) return state;
      const affectedCardDefs      = state.cardDefinitions.filter(cd => cd.collectionId === collectionId);
      const affectedCardDefIds    = new Set(affectedCardDefs.map(cd => cd.id));
      const affectedTemplateFields = state.templateFields.filter(f => f.collectionId === collectionId);
      const affectedInventoryItems = state.inventory.filter(inv => affectedCardDefIds.has(inv.cardDefId));
      return {
        ...state,
        collections:     state.collections.filter(c => c.id !== collectionId),
        templateFields:  state.templateFields.filter(f => f.collectionId !== collectionId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.collectionId !== collectionId),
        inventory:       state.inventory.filter(inv => !affectedCardDefIds.has(inv.cardDefId)),
        binderSlots:     state.binderSlots.filter(s => s.collectionId !== collectionId),
        binderPanels:    state.binderPanels.filter(p => !affectedCardDefIds.has(p.cardDefId)),
        bin: [...state.bin, {
          ...collection,
          _type:           'collection',
          deletedAt:       Date.now(),
          _cardDefs:        affectedCardDefs,
          _templateFields:  affectedTemplateFields,
          _inventoryItems:  affectedInventoryItems,
        }],
        nav: state.nav.currentView === 'collection' && state.nav.currentCollectionId === collectionId
          ? { ...state.nav, currentView: 'collections', currentCollectionId: null }
          : state.nav,
      };
    }

    case ACTIONS.TEMPLATE_FIELD_ADD:
      return { ...state, templateFields: [...state.templateFields, action.payload] };

    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      const collectionId = action.payload[0]?.collectionId;
      if (!collectionId) { console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD: missing collectionId'); return state; }
      const { valid, error } = validateOneTemplatePerCollection(collectionId, state.templateFields);
      if (!valid) { console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD rejected:', error); return state; }
      return { ...state, templateFields: [...state.templateFields, ...action.payload] };
    }

    case ACTIONS.TEMPLATE_FIELD_UPDATE:
      return {
        ...state,
        templateFields: state.templateFields.map(f =>
          f.id === action.payload.id ? { ...f, ...action.payload } : f
        ),
      };

    case ACTIONS.TEMPLATE_FIELD_REORDER: {
      const { collectionId, fieldId, direction } = action.payload;
      const collectionFields = state.templateFields
        .filter(f => f.collectionId === collectionId)
        .sort((a, b) => a.order - b.order);
      const idx = collectionFields.findIndex(f => f.id === fieldId);
      if (idx === -1) return state;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= collectionFields.length) return state;
      const fieldA = collectionFields[idx];
      const fieldB = collectionFields[swapIdx];
      return {
        ...state,
        templateFields: state.templateFields.map(f => {
          if (f.id === fieldA.id) return { ...f, order: fieldB.order };
          if (f.id === fieldB.id) return { ...f, order: fieldA.order };
          return f;
        }),
      };
    }

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

    // === FIX3: save inventory item to bin alongside card def ===
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload;
      const cardDef = state.cardDefinitions.find(cd => cd.id === cardDefId);
      if (!cardDef) return state;
      const inventoryItem = state.inventory.find(inv => inv.cardDefId === cardDefId) ?? null;
      return {
        ...state,
        inventory:       state.inventory.filter(inv => inv.cardDefId !== cardDefId),
        binderSlots:     state.binderSlots.filter(s => s.cardDefId !== cardDefId),
        binderPanels:    state.binderPanels.filter(p => p.cardDefId !== cardDefId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== cardDefId),
        bin: [...state.bin, {
          ...cardDef,
          _type:          'cardDef',
          deletedAt:      Date.now(),
          _inventoryItem: inventoryItem,
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
    case ACTIONS.INVENTORY_ADD:
      return { ...state, inventory: [...state.inventory, action.payload] };

    case ACTIONS.INVENTORY_UPDATE:
      return {
        ...state,
        inventory: state.inventory.map(inv =>
          inv.id === action.payload.id
            ? { ...inv, ...action.payload, updatedAt: Date.now() }
            : inv
        ),
      };

    // === CHANGED (quantity tracking): this used to hard-remove the
    // row immediately and permanently — the only entity in the whole
    // app that worked that way, everything else (binders,
    // collections, cards) soft-deletes to the Trash Bin first. Now
    // matches that same pattern: moves to state.bin instead, fully
    // restorable, with a real permanent-delete step later via
    // BIN_DELETE_ITEM (whose existing generic fallback already
    // handles this type correctly with no extra work needed there).
    //
    // Also fixes a real, separate bug: binder_slots only tracks
    // WHICH CARD is placed (cardDefId), not which specific physical
    // copy — so removing a copy that happened to be placed somewhere
    // left its slot behind untouched, with no copy left to justify
    // it. Since there's no way to know exactly which slot
    // corresponds to the copy just removed (all placements of the
    // same card are functionally identical), the fix is: if the
    // remaining owned count is now less than the placed count,
    // remove exactly one placement for this card — preferring a
    // normal slot over a card-type panel — to bring the two back
    // into balance.
    case ACTIONS.INVENTORY_DELETE: {
      const item = state.inventory.find(inv => inv.id === action.payload.inventoryId);
      if (!item) return state;

      const cardDef = state.cardDefinitions.find(cd => cd.id === item.cardDefId);
      const remainingInventory = state.inventory.filter(inv => inv.id !== item.id);

      // === Real fix (was: count-only, "any slot for this card"):
      // finds the EXACT slot/panel linked to this specific copy via
      // inventoryItemId, rather than an arbitrary one. Falls back to
      // the old count-based approach only for pre-migration slots
      // that were never linked to any specific copy at all — in that
      // case there's genuinely no way to know which one corresponds
      // to this copy, so the same "any slot, if placed count exceeds
      // owned count" logic as before is the only option.
      let removedSlot = null, removedPanel = null;
      const linkedSlot = state.binderSlots.find(s => s.inventoryItemId === item.id);
      if (linkedSlot) {
        removedSlot = linkedSlot;
      } else {
        const linkedPanel = state.binderPanels.find(p => p.panelType === 'card' && p.inventoryItemId === item.id);
        if (linkedPanel) {
          removedPanel = linkedPanel;
        } else {
          // Backward-compat fallback for unlinked, pre-migration slots
          const quantityOwned = remainingInventory.filter(inv => inv.cardDefId === item.cardDefId).length;
          const totalPlaced =
            state.binderSlots.filter(s => s.cardDefId === item.cardDefId).length +
            state.binderPanels.filter(p => p.panelType === 'card' && p.cardDefId === item.cardDefId).length;
          if (totalPlaced > quantityOwned) {
            const excessSlot = state.binderSlots.find(s => s.cardDefId === item.cardDefId);
            if (excessSlot) {
              removedSlot = excessSlot;
            } else {
              removedPanel = state.binderPanels.find(p => p.panelType === 'card' && p.cardDefId === item.cardDefId) ?? null;
            }
          }
        }
      }

      const binderSlots  = removedSlot  ? state.binderSlots.filter(s => s.id !== removedSlot.id)   : state.binderSlots;
      const binderPanels = removedPanel ? state.binderPanels.filter(p => p.id !== removedPanel.id) : state.binderPanels;

      return {
        ...state,
        inventory: remainingInventory,
        binderSlots,
        binderPanels,
        bin: [...state.bin, {
          ...item,
          _type: 'inventoryItem',
          cardName: cardDef?.name ?? 'Unknown card', // no name field on inventory rows themselves - captured here for the Trash Bin display
          hadPlacementRemoved: !!(removedSlot || removedPanel),
          // Snapshot of the exact slot/panel removed (if any), so
          // restoring this copy can try to put it back in the same
          // position — see BIN_RESTORE_INVENTORY_ITEM below for what
          // happens if that position has since been taken by
          // something else.
          _removedSlot:  removedSlot,
          _removedPanel: removedPanel,
          deletedAt: Date.now(),
        }],
      };
    }

    case ACTIONS.BINDER_SLOT_ADD: {
      const { slot } = action.payload;
      // === FIX (real bug: slots that render blank but still say
      // "already occupied"): the old check only asked "does ANY slot
      // record exist at this position" — it never verified that
      // record's card still actually exists. If a card gets deleted
      // while a binder_slots row still references it (a genuine
      // possibility given sync-timing edge cases elsewhere in this
      // app), that row becomes an orphan: it renders blank (no card
      // data to show) but still counted as "occupied" here, blocking
      // any new card from ever being placed there again — the only
      // previous workaround was deleting the whole binder. Now,
      // finding an existing slot whose card no longer exists doesn't
      // block the new placement — it gets replaced instead.
      const existingAtPosition = state.binderSlots.find(
        s => s.binderId === slot.binderId && s.pageNumber === slot.pageNumber && s.slotIndex === slot.slotIndex
      );
      if (existingAtPosition) {
        const cardStillExists = state.cardDefinitions.some(cd => cd.id === existingAtPosition.cardDefId);
        if (cardStillExists) {
          console.warn('[BinderVault] BINDER_SLOT_ADD: slot already occupied', slot);
          return state;
        }
        console.warn('[BinderVault] BINDER_SLOT_ADD: replacing orphaned slot (card no longer exists)', existingAtPosition.id);
      }
      // === CHANGED (quantity tracking): this used to block placing
      // the same card twice in the same binder at all, treating
      // ownership as purely boolean. Now that owning multiple copies
      // of a card is real (see inventorySelectors.js's
      // buildInventoryGroupMap), the same card CAN be placed more
      // than once — even within the same binder — as long as enough
      // physical copies are actually owned. The real limit isn't
      // "already in this binder", it's "already placed everywhere
      // you own a copy of it" — counted globally, across every
      // binder, plus card-type combined-slot panels (a card sitting
      // in a Michi Method panel is still physically placed
      // somewhere, same as a normal slot).
      // === CHANGED (quantity tracking, now with a real per-copy link):
      // this used to only compare total owned vs total placed as
      // numbers, with no link from a slot to which specific copy it
      // held — meaning removing or restoring one particular copy
      // could only act on "any slot for this card", not the exact
      // right one. Now finds the actual unplaced inventory row and
      // links the new slot to it directly (inventoryItemId).
      //
      // Backward compatibility: slots created before this field
      // existed have inventoryItemId === null/undefined, not a
      // missing placement — they still occupy a copy, just not a
      // specifically identified one. The safety check below counts
      // ALL slots for this card (linked or not) so it can't
      // under-count and allow over-placing; only the second step
      // (picking which copy to link the NEW slot to) cares about
      // which ones are already linked.
      const totalPlacedCount =
        state.binderSlots.filter(s => s.cardDefId === slot.cardDefId && s.id !== existingAtPosition?.id).length +
        state.binderPanels.filter(p => p.panelType === 'card' && p.cardDefId === slot.cardDefId).length;
      const quantityOwned = state.inventory.filter(inv => inv.cardDefId === slot.cardDefId).length;
      if (totalPlacedCount >= quantityOwned) {
        console.warn(`[BinderVault] BINDER_SLOT_ADD: no unplaced copies left (own ${quantityOwned}, ${totalPlacedCount} already placed)`, slot.cardDefId);
        return state;
      }

      const placedInventoryIds = new Set([
        ...state.binderSlots.filter(s => s.id !== existingAtPosition?.id && s.inventoryItemId).map(s => s.inventoryItemId),
        ...state.binderPanels.filter(p => p.panelType === 'card' && p.inventoryItemId).map(p => p.inventoryItemId),
      ]);
      // Falls back to null (old, less-precise behavior) only in the
      // rare edge case where the count check above passed but every
      // copy happens to already be referenced by a linked
      // slot/panel — meaning the "extra room" is coming from
      // pre-migration unlinked slots, which have no specific copy to
      // exclude in the first place.
      const unplacedCopy = state.inventory.find(
        inv => inv.cardDefId === slot.cardDefId && !placedInventoryIds.has(inv.id)
      );

      return {
        ...state,
        binderSlots: [
          ...state.binderSlots.filter(s => s.id !== existingAtPosition?.id),
          { ...slot, inventoryItemId: unplacedCopy?.id ?? null },
        ],
      };
    }

    case ACTIONS.BINDER_SLOT_REMOVE:
      return { ...state, binderSlots: state.binderSlots.filter(s => s.id !== action.payload.slotId) };

    // === FIX: swap-aware move. The old version silently rejected any
    // move to an occupied destination ("target slot occupied"), which
    // meant Save Layout — dispatching one BINDER_SLOT_MOVE per changed
    // slot, one at a time — would fail for any slot whose destination was
    // still occupied by the OLD (pre-preview) position of another card
    // that hadn't been moved yet in this same dispatch sequence. The
    // failed move silently returned unchanged state, so that card
    // appeared to "snap back" to its original position after saving —
    // it never actually got its new position applied to the real store.
    //
    // Now: if the destination is occupied, swap both slots' positions in
    // one atomic state update instead of rejecting. This matches how
    // preview-mode swapping already works (see useBinderView.js
    // previewMoveSlot), so save-time behavior is consistent with what the
    // user saw and did during preview — no dispatch-order dependency.
    case ACTIONS.BINDER_SLOT_MOVE: {
      const { slotId, pageNumber, slotIndex } = action.payload;
      const movingSlot = state.binderSlots.find(s => s.id === slotId);
      if (!movingSlot) return state;

      const targetSlot = state.binderSlots.find(
        s => s.binderId === movingSlot.binderId &&
             s.pageNumber === pageNumber &&
             s.slotIndex === slotIndex &&
             s.id !== slotId
      );

      if (targetSlot) {
        return {
          ...state,
          binderSlots: state.binderSlots.map(s => {
            if (s.id === slotId) return { ...s, pageNumber, slotIndex };
            if (s.id === targetSlot.id) return { ...s, pageNumber: movingSlot.pageNumber, slotIndex: movingSlot.slotIndex };
            return s;
          }),
        };
      }

      return {
        ...state,
        binderSlots: state.binderSlots.map(s =>
          s.id === slotId ? { ...s, pageNumber, slotIndex } : s
        ),
      };
    }

    // === Michi Method support: combined slots ===

    case ACTIONS.BINDER_INSERT_ADD:
      return { ...state, binderInserts: [...state.binderInserts, action.payload] };

    case ACTIONS.BINDER_INSERT_DELETE:
      return {
        ...state,
        binderInserts: state.binderInserts.filter(i => i.id !== action.payload.insertId),
        // Any panel using this insert loses its image source — remove
        // those panels too rather than leaving a broken reference.
        // Removing the panel just returns those slot positions to
        // normal, empty, individually-placeable slots.
        binderPanels: state.binderPanels.filter(p => p.insertId !== action.payload.insertId),
      };

    case ACTIONS.BINDER_PANEL_ADD: {
      const panel = action.payload;
      const binder = state.binders.find(b => b.id === panel.binderId);
      if (!binder) { console.warn('[BinderVault] BINDER_PANEL_ADD: binder not found', panel.binderId); return state; }

      const newIndices = getSlotIndicesForPanel(panel.startSlotIndex, panel.spanCols, panel.spanRows, binder.cols);

      // Reject if any covered position already has an individual card
      // placed there — combining should never silently discard an
      // existing card; the person needs to remove it first.
      const conflictingSlot = state.binderSlots.find(
        s => s.binderId === panel.binderId && s.pageNumber === panel.pageNumber && newIndices.includes(s.slotIndex)
      );
      if (conflictingSlot) {
        console.warn('[BinderVault] BINDER_PANEL_ADD: a slot in this range already has a card placed — remove it first', conflictingSlot);
        return state;
      }

      // Reject if any covered position already belongs to another
      // panel — panels can't overlap.
      const overlappingPanel = state.binderPanels.find(p => {
        if (p.binderId !== panel.binderId || p.pageNumber !== panel.pageNumber) return false;
        const existingIndices = getSlotIndicesForPanel(p.startSlotIndex, p.spanCols, p.spanRows, binder.cols);
        return existingIndices.some(i => newIndices.includes(i));
      });
      if (overlappingPanel) {
        console.warn('[BinderVault] BINDER_PANEL_ADD: overlaps an existing panel', overlappingPanel.id);
        return state;
      }

      // === Quantity tracking: same per-copy link as BINDER_SLOT_ADD —
      // a card-type panel is still a specific physical copy placed
      // somewhere, just occupying a combined space instead of one
      // slot. Insert-type panels aren't a real card at all, so this
      // doesn't apply to them. ===
      let finalPanel = panel;
      if (panel.panelType === 'card') {
        const placedInventoryIds = new Set([
          ...state.binderSlots.filter(s => s.inventoryItemId).map(s => s.inventoryItemId),
          ...state.binderPanels.filter(p => p.panelType === 'card' && p.inventoryItemId).map(p => p.inventoryItemId),
        ]);
        const unplacedCopy = state.inventory.find(
          inv => inv.cardDefId === panel.cardDefId && !placedInventoryIds.has(inv.id)
        );
        if (!unplacedCopy) {
          console.warn('[BinderVault] BINDER_PANEL_ADD: no unplaced copies left for this card', panel.cardDefId);
          return state;
        }
        finalPanel = { ...panel, inventoryItemId: unplacedCopy.id };
      }

      return { ...state, binderPanels: [...state.binderPanels, finalPanel] };
    }

    case ACTIONS.BINDER_PANEL_UPDATE:
      return {
        ...state,
        binderPanels: state.binderPanels.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case ACTIONS.BINDER_PANEL_REMOVE:
      // Removing a panel just returns its slot positions to normal,
      // empty, individually-placeable slots — nothing else to clean
      // up, since binder_slots was never touched by combining in the
      // first place.
      return {
        ...state,
        binderPanels: state.binderPanels.filter(p => p.id !== action.payload.panelId),
      };

    default:
      console.warn('[BinderVault] Unknown action type:', action.type);
      return state;
  }
}

// === Michi Method support: computes every absolute slot index a
// panel covers, given the binder's own column count — needed because
// a panel spanning multiple ROWS doesn't cover a contiguous range of
// indices (e.g. a 2-wide, 2-tall panel starting at index 1 in a
// 3-column grid covers 1, 2, 4, 5 — not 1, 2, 3, 4). ===
function getSlotIndicesForPanel(startSlotIndex, spanCols, spanRows, gridCols) {
  const indices = [];
  const startRow = Math.floor(startSlotIndex / gridCols);
  const startCol = startSlotIndex % gridCols;
  for (let r = 0; r < spanRows; r++) {
    for (let c = 0; c < spanCols; c++) {
      indices.push((startRow + r) * gridCols + (startCol + c));
    }
  }
  return indices;
}