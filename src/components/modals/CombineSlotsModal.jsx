/**
 * @fileoverview CombineSlotsModal — confirms what goes in a newly
 * combined-slot group (Michi Method): either a real card that just
 * needs more space, or a decorative art insert.
 */

import { useState, useRef } from 'react';
import { Modal, ModalActions, Button, Input } from '../ui/index.jsx';
import { createBinderPanel, createBinderInsert } from '../../types/index.js';
import { compressImage } from '../../utils/imageCompression.js';
import { uploadImageToStorage } from '../../utils/supabaseImageUpload.js';
import { useAuth } from '../../hooks/useAuth.js';

export function CombineSlotsModal({
  rectangle, // { pageNumber, startSlotIndex, spanCols, spanRows }
  binderId,
  cardDefinitions,
  binderSlots,
  binderPanels,
  binderInserts,
  onConfirm,
  onClose,
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState('card'); // 'card' | 'insert'
  const [cardQuery, setCardQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedInsertId, setSelectedInsertId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // A card already placed in THIS binder (a slot or another panel)
  // can't be placed again — same scope as the existing "card already
  // in binder" check for individual slots.
  const alreadyPlacedCardIds = new Set([
    ...binderSlots.filter(s => s.binderId === binderId).map(s => s.cardDefId),
    ...binderPanels.filter(p => p.binderId === binderId && p.cardDefId).map(p => p.cardDefId),
  ]);

  const availableCards = cardDefinitions
    .filter(cd => !alreadyPlacedCardIds.has(cd.id))
    .filter(cd => cd.name.toLowerCase().includes(cardQuery.trim().toLowerCase()));

  const handleUploadInsert = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const compressed = await compressImage(file);
      const path = `${user.id}/inserts/${crypto.randomUUID()}.jpg`;
      const image_url = await uploadImageToStorage(compressed, path);
      const { insert, errors } = createBinderInsert({
        name: file.name.replace(/\.[^.]+$/, '') || 'Insert',
        image_url,
        userId: user.id,
      });
      if (!insert) { setUploadError(errors.join(', ')); return; }
      onConfirm({ newInsert: insert, panelType: 'insert', insertId: insert.id });
    } catch (err) {
      console.error('Insert upload failed:', err);
      setUploadError('Could not upload that image. Try a different file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmCard = () => {
    if (!selectedCardId) return;
    onConfirm({ panelType: 'card', cardDefId: selectedCardId });
  };

  const handleConfirmExistingInsert = () => {
    if (!selectedInsertId) return;
    onConfirm({ panelType: 'insert', insertId: selectedInsertId });
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
        <>
          <p className="modal-step-note">
            A decorative image — art, a themed background, a placeholder. Not a card: no rarity, no ownership, doesn't affect collection stats.
          </p>

          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading…' : '+ Upload New Image'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleUploadInsert}
          />
          {uploadError && <p className="modal-step-error">{uploadError}</p>}

          {binderInserts.length > 0 && (
            <>
              <p className="modal-step-note">Or reuse one already in your library:</p>
              <div className="combine-card-grid">
                {binderInserts.map(ins => (
                  <button
                    key={ins.id}
                    className={`combine-card-option ${selectedInsertId === ins.id ? 'combine-card-option-selected' : ''}`}
                    onClick={() => setSelectedInsertId(ins.id)}
                  >
                    <img src={ins.image_url} alt={ins.name} />
                    <span>{ins.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {tab === 'card' && (
          <Button variant="primary" onClick={handleConfirmCard} disabled={!selectedCardId}>
            Combine
          </Button>
        )}
        {tab === 'insert' && selectedInsertId && (
          <Button variant="primary" onClick={handleConfirmExistingInsert}>
            Combine
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}