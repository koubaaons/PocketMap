/**
 * @fileoverview BinderView — slot-based binder view.
 *
 * Milestone 7: Replaced legacy card system with binder slots.
 * Slots reference CARD_DEFINITIONS directly.
 * Grey card logic: unowned = placeholder, owned = colored.
 */

// === ISSUE #55 START: Binder Page View ===
// === ISSUE #56 START: Binder Slot Actions ===

import { useState, useMemo } from 'react';
import { Button } from '../ui/index.jsx';
import { BinderPage } from '../collections/BinderPage.jsx';
import { AddCardToBinderModal } from '../modals/AddCardToBinderModal.jsx';
import { SlotActionModal } from '../modals/SlotActionModal.jsx';
import { buildPageSlotMap, getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useStore } from '../../hooks/useStore.js';

export function BinderView({ binder, binderSlots, cardDefinitions, collections, templateFields, inventory, toast }) {
  const [page, setPage]               = useState(1);
  const [addingToSlot, setAddingToSlot] = useState(null); // { slotIndex }
  const [activeSlot, setActiveSlot]   = useState(null);   // { slot, cardDef }
  const [viewingCardDef, setViewingCardDef] = useState(null);

  const safePage = Math.min(page, binder.pages);

  // Build lookup maps
  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const cardDefMap = useMemo(() => {
    const map = {};
    cardDefinitions.forEach(cd => { map[cd.id] = cd; });
    return map;
  }, [cardDefinitions]);

  const pageSlotMap = useMemo(
    () => buildPageSlotMap(binderSlots, binder.id, safePage),
    [binderSlots, binder.id, safePage]
  );

  const filled   = getFilledSlotCount(binderSlots, binder.id);
  const capacity = binder.rows * binder.cols * binder.pages;

  const { handleAddToSlot, handleRemoveFromSlot, handleAddPage } =
    useBinderSlotActions(toast, {
      onAddSuccess:    () => setAddingToSlot(null),
      onRemoveSuccess: () => setActiveSlot(null),
    });

  const { handleOwn } = useInventoryActions(toast, {
    onOwnSuccess: () => setActiveSlot(null),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSlotClick = (slot, cardDef) => {
    setActiveSlot({ slot, cardDef });
  };

  const handleEmptySlotClick = (slotIndex) => {
    setAddingToSlot({ slotIndex });
  };

  const handlePlaceCard = (cardDef, collectionId) => {
    handleAddToSlot({
      binderId: binder.id,
      cardDefId: cardDef.id,
      collectionId,
      pageNumber: safePage,
      slotIndex: addingToSlot.slotIndex,
    });
  };

  const handleOwnFromSlot = () => {
    if (!activeSlot) return;
    handleOwn({
      cardDefId: activeSlot.cardDef.id,
      collectionId: activeSlot.slot.collectionId,
    });
  };

  return (
    <div className="view">

      {/* Page navigation */}
      <div className="page-nav-bar">
        <div className="page-nav-controls">
          <Button variant="icon" size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}>←</Button>
          <span className="page-label">Page {safePage} of {binder.pages}</span>
          <Button variant="icon" size="sm"
            onClick={() => setPage(p => Math.min(binder.pages, p + 1))}
            disabled={safePage >= binder.pages}>→</Button>
        </div>

        {/* Page thumbnails */}
        <div className="page-jumper">
          {Array.from({ length: Math.min(binder.pages, 30) }, (_, i) => (
            <button key={i + 1}
              className={`page-pip ${safePage === i + 1 ? 'active' : ''}`}
              onClick={() => setPage(i + 1)}>
              {i + 1}
            </button>
          ))}
          {binder.pages > 30 && <span className="page-more">+{binder.pages - 30} more</span>}
        </div>

        <div className="page-nav-right">
          <span className="page-fill-count">{filled}/{capacity}</span>
          {/* === ISSUE #53: Add page button === */}
          <Button variant="ghost" size="sm" onClick={() => handleAddPage(binder.id)}>
            + Add Page
          </Button>
        </div>
      </div>

      {/* Binder page grid */}
      <BinderPage
        binder={binder}
        pageNumber={safePage}
        pageSlotMap={pageSlotMap}
        cardDefMap={cardDefMap}
        ownershipMap={ownershipMap}
        onClickEmpty={handleEmptySlotClick}
        onClickSlot={handleSlotClick}
      />

      {/* Add card to slot modal */}
      {addingToSlot && (
        <AddCardToBinderModal
          binder={binder}
          pageNumber={safePage}
          slotIndex={addingToSlot.slotIndex}
          cardDefinitions={cardDefinitions}
          collections={collections}
          templateFields={templateFields}
          inventory={inventory}
          binderSlots={binderSlots}
          onSubmit={handlePlaceCard}
          onClose={() => setAddingToSlot(null)}
        />
      )}

      {/* Slot action modal */}
      {activeSlot && (
        <SlotActionModal
          slot={activeSlot.slot}
          cardDef={activeSlot.cardDef}
          inventoryItem={ownershipMap[activeSlot.cardDef.id] ?? null}
          onOwn={handleOwnFromSlot}
          onRemove={() => handleRemoveFromSlot(activeSlot.slot.id)}
          onViewDetail={() => {
            setViewingCardDef(activeSlot.cardDef);
            setActiveSlot(null);
          }}
          onClose={() => setActiveSlot(null)}
        />
      )}

    </div>
  );
}

// === ISSUE #55 END: Binder Page View ===
// === ISSUE #56 END: Binder Slot Actions ===