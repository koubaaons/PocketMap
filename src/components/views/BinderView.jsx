/**
 * @fileoverview BinderView — slot-based binder view.
 */

// === ISSUE #55 START: Binder Page View ===
// === ISSUE #56 START: Binder Slot Actions ===

import { useMemo, useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { BinderPage } from '../collections/BinderPage.jsx';
import { AddCardToBinderModal } from '../modals/AddCardToBinderModal.jsx';
import { SlotActionModal } from '../modals/SlotActionModal.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { buildPageSlotMap, getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { useBinderSlotActions } from '../../hooks/useBinderSlotActions.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { useBinderView } from '../../hooks/useBinderView.js';
import { useDispatch } from '../../hooks/useStore.js';
import { ACTIONS } from '../../store/index.js';

export function BinderView({ binder, binderSlots, cardDefinitions, collections, templateFields, inventory, toast }) {
  const dispatch = useDispatch();
  const view = useBinderView(binder);

  // === FIX2: delete binder confirm state ===
  const [confirmDelete, setConfirmDelete] = useState(false);

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  const cardDefMap = useMemo(() => {
    const map = {};
    cardDefinitions.forEach(cd => { map[cd.id] = cd; });
    return map;
  }, [cardDefinitions]);

  const pageSlotMap = useMemo(
    () => buildPageSlotMap(binderSlots, binder.id, view.page),
    [binderSlots, binder.id, view.page]
  );

  const filled   = getFilledSlotCount(binderSlots, binder.id);
  const capacity = binder.rows * binder.cols * binder.pages;

  const { handleAddToSlot, handleRemoveFromSlot, handleAddPage } =
    useBinderSlotActions(toast, {
      onAddSuccess:    view.closeAddToSlot,
      onRemoveSuccess: view.closeSlotAction,
    });

  const { handleOwn, handleUnown, handleUpdateAcquisition, handleToggleFavorite } =
    useInventoryActions(toast, {
      onOwnSuccess:   view.closeSlotAction,
      onUnownSuccess: view.closeCardDetail,
    });

  const handlePlaceCard = (cardDef, collectionId) => {
    handleAddToSlot({
      binderId: binder.id,
      cardDefId: cardDef.id,
      collectionId,
      pageNumber: view.page,
      slotIndex: view.addingToSlot.slotIndex,
    });
  };

  const handleOwnFromSlot = () => {
    if (!view.activeSlot) return;
    handleOwn({
      cardDefId: view.activeSlot.cardDef.id,
      collectionId: view.activeSlot.slot.collectionId,
    });
  };

  // === FIX2: delete binder handler ===
  const handleDeleteBinder = () => {
    dispatch({ type: ACTIONS.BINDER_DELETE, payload: { binderId: binder.id } });
    toast(`"${binder.name}" moved to trash`);
    setConfirmDelete(false);
  };

  // Template fields for the card detail modal
  const cardTemplateFields = view.viewingCardDef
    ? templateFields.filter(f => f.collectionId === view.viewingCardDef.collectionId)
    : [];

  return (
    <div className="view">

      {/* Page navigation */}
      <div className="page-nav-bar">
        <div className="page-nav-controls">
          <Button variant="icon" size="sm"
            onClick={view.goToPrevPage} disabled={view.page <= 1}>←</Button>
          <span className="page-label">Page {view.page} of {binder.pages}</span>
          <Button variant="icon" size="sm"
            onClick={view.goToNextPage} disabled={view.page >= binder.pages}>→</Button>
        </div>

        <div className="page-jumper">
          {Array.from({ length: Math.min(binder.pages, 30) }, (_, i) => (
            <button key={i + 1}
              className={`page-pip ${view.page === i + 1 ? 'active' : ''}`}
              onClick={() => view.goToPage(i + 1)}>
              {i + 1}
            </button>
          ))}
          {binder.pages > 30 && <span className="page-more">+{binder.pages - 30} more</span>}
        </div>

        <div className="page-nav-right">
          <span className="page-fill-count">{filled}/{capacity}</span>
          <Button variant="ghost" size="sm" onClick={() => handleAddPage(binder.id)}>
            + Add Page
          </Button>
          {/* === FIX2: delete binder button === */}
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete Binder
          </Button>
        </div>
      </div>

      {/* Binder page grid */}
      <BinderPage
        binder={binder}
        pageNumber={view.page}
        pageSlotMap={pageSlotMap}
        cardDefMap={cardDefMap}
        ownershipMap={ownershipMap}
        onClickEmpty={view.openAddToSlot}
        onClickSlot={view.openSlotAction}
      />

      {/* Add card to slot modal */}
      {view.addingToSlot && (
        <AddCardToBinderModal
          binder={binder}
          pageNumber={view.page}
          slotIndex={view.addingToSlot.slotIndex}
          cardDefinitions={cardDefinitions}
          collections={collections}
          templateFields={templateFields}
          inventory={inventory}
          binderSlots={binderSlots}
          onSubmit={handlePlaceCard}
          onClose={view.closeAddToSlot}
        />
      )}

      {/* Slot action modal */}
      {view.activeSlot && (
        <SlotActionModal
          slot={view.activeSlot.slot}
          cardDef={view.activeSlot.cardDef}
          inventoryItem={ownershipMap[view.activeSlot.cardDef.id] ?? null}
          onOwn={handleOwnFromSlot}
          onRemove={() => handleRemoveFromSlot(view.activeSlot.slot.id)}
          onViewDetail={() => view.openCardDetail(view.activeSlot.cardDef)}
          onClose={view.closeSlotAction}
        />
      )}

      {/* === FIX1: CardDetailModal wired to viewingCardDef === */}
      {view.viewingCardDef && (
        <CardDetailModal
          card={view.viewingCardDef}
          inventoryItem={ownershipMap[view.viewingCardDef.id] ?? null}
          templateFields={cardTemplateFields}
          onOwn={() => handleOwn({
            cardDefId: view.viewingCardDef.id,
            collectionId: view.viewingCardDef.collectionId,
          })}
          onUnown={(inventoryId) => handleUnown(inventoryId)}
          onUpdateAcquisition={handleUpdateAcquisition}
          onToggleFavorite={handleToggleFavorite}
          onEdit={() => view.closeCardDetail()}
          onDelete={() => view.closeCardDetail()}
          onClose={view.closeCardDetail}
        />
      )}

      {/* === FIX2: delete binder confirm === */}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete "${binder.name}"?`}
          message="This binder will be moved to the trash bin. All slot placements will be removed."
          confirmLabel="Delete Binder"
          onConfirm={handleDeleteBinder}
          onClose={() => setConfirmDelete(false)}
        />
      )}

    </div>
  );
}

// === ISSUE #55 END: Binder Page View ===
// === ISSUE #56 END: Binder Slot Actions ===