/**
 * @fileoverview Modals barrel — re-exports all modal components.
 *
 * To add a new modal:
 *   1. Create its file in this folder
 *   2. Add one export line here
 *   Done.
 */

export { CreateBinderModal } from './BinderModals.jsx';
export { AddCardModal, EditCardModal, CardDetailModal as LegacyCardDetailModal } from './CardModals.jsx';
export { CreateCollectionModal, EditCollectionModal } from './CollectionModals.jsx';

// === REFACTOR5d START: CardDetailModal moved to modals folder ===
export { CardDetailModal } from './CardDetailModal.jsx';
// === REFACTOR5d END ===