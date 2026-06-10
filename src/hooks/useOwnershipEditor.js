/**
 * @fileoverview useOwnershipEditor hook.
 *
 * Encapsulates ownership-specific state from CollectionDetailView:
 * - Which card is currently being viewed in CardDetailModal
 * - Open/close the detail modal
 *
 * Keeps CollectionDetailView as pure orchestration.
 * Works alongside useCardEditor — one handles CRUD, one handles ownership view.
 */

// === REFACTOR5a START: Extract useOwnershipEditor hook ===

import { useState } from 'react';

export function useOwnershipEditor() {
  const [viewingCard, setViewingCard] = useState(null);

  const openDetail  = (card) => setViewingCard(card);
  const closeDetail = ()     => setViewingCard(null);

  return {
    viewingCard,
    openDetail,
    closeDetail,
  };
}

// === REFACTOR5a END ===