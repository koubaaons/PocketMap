/**
 * @fileoverview CombineSlotsModal — confirms what goes in a newly
 * combined-slot group (Michi Method): either a real card that just
 * needs more space, or a blank spot for a decorative art insert.
 *
 * === CHANGED: the "Decorative Image" tab used to have its own
 * embedded upload button + library grid, picking an image right here
 * as part of confirming the combine. That's now handled by a
 * dedicated, persistent library — InsertLibraryPanel.jsx (a floating,
 * draggable/resizable panel, shown only in Combine Mode) plus
 * LibraryView.jsx (the sidebar's full "Library" page for managing it,
 * batch uploads included). Confirming here just creates the panel
 * blank; BinderView.jsx opens the library panel immediately after,
 * so dragging an image onto it is the very next thing the user does. ===
 */

import { useState } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';

export function CombineSlotsModal({
  rectangle, // { pageNumber, startSlotIndex, spanCols, spanRows }
  binderId,
  cardDefinitions,
  binderSlots,
  binderPanels,
  onConfirm,
  onClose,
}) {
  const [tab, setTab] = useState('card'); // 'card' | 'insert'
  const [cardQuery, setCardQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(null);

  // A card already placed in THIS binder (a slot or another panel)
  // can't be placed again — same scope as the existing "card already
  // in binder" check for individual slots.
  const alreadyPlacedCardIds = new Set([
    ...binderSlots.filter(s => s.binderId === binderId).map(s => s.cardDefId),
    ...binderPanels.filter(p => p.binderId === binderId && p.cardDefId).map(p => p.cardDefId),
  ]);

  const availableCards = cardDefinitions
    .filter(cd => !cd.isDecluttered)
    .filter(cd => !alreadyPlacedCardIds.has(cd.id))
    .filter(cd => cd.name.toLowerCase().includes(cardQuery.trim().toLowerCase()));

  const handleConfirmCard = () => {
    if (!selectedCardId) return;
    onConfirm({ panelType: 'card', cardDefId: selectedCardId });
  };

  const handleConfirmBlankInsert = () => {
    onConfirm({ panelType: 'insert', insertId: null, openLibrary: true });
  };

  return (
    <Modal title={`Combine ${rectangle.spanCols}×${rectangle.spanRows} Slots`} onClose={onClose}>
      <p className="modal-step-intro">
        What goes in this combined space?
      </p>

      <div className="combine-tabs">
        <button className={`combine-tab ${tab === 'card' ? 'combine-tab-active' : ''}`} onClick={() => setTab('card')}>
          Real Card
        </button>
        <button className={`combine-tab ${tab === 'insert' ? 'combine-tab-active' : ''}`} onClick={() => setTab('insert')}>
          Decorative Image
        </button>
      </div>

      {tab === 'card' && (
        <>
          <p className="modal-step-note">
            For a real, ownable card that needs more space (e.g. a Jumbo/oversized promo) — still counts toward your collection stats.
          </p>
          <Input
            id="combine-card-search"
            placeholder="Search your cards…"
            value={cardQuery}
            onChange={e => setCardQuery(e.target.value)}
          />
          <div className="combine-card-grid">
            {availableCards.slice(0, 30).map(cd => (
              <button
                key={cd.id}
                className={`combine-card-option ${selectedCardId === cd.id ? 'combine-card-option-selected' : ''}`}
                onClick={() => setSelectedCardId(cd.id)}
              >
                {cd.image_url && <img src={cd.image_url} alt={cd.name} />}
                <span>{cd.name}</span>
              </button>
            ))}
            {availableCards.length === 0 && (
              <p className="modal-step-note">No available cards match — cards already placed in this binder aren't shown twice.</p>
            )}
          </div>
        </>
      )}

      {tab === 'insert' && (
        <p className="modal-step-note">
          A decorative image — art, a themed background, a placeholder. Not a card: no rarity, no ownership,
          doesn't affect collection stats. Confirming creates the combined space blank — the image library
          opens right after so you can drag one onto it (or upload new ones, including several at once).
        </p>
      )}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {tab === 'card' && (
          <Button variant="primary" onClick={handleConfirmCard} disabled={!selectedCardId}>
            Combine
          </Button>
        )}
        {tab === 'insert' && (
          <Button variant="primary" onClick={handleConfirmBlankInsert}>
            Combine
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}