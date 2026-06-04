/**
 * @fileoverview Modals barrel — re-exports all modal components.
 *
 * Every file in the app imports from '../modals/index.jsx' (or similar).
 * This barrel means NOTHING else needs to change when we split modals.
 *
 * To add a new modal:
 *   1. Create its file in this folder
 *   2. Add one export line here
 *   Done.
 */

export { CreateBinderModal } from './BinderModals.jsx';
export { AddCardModal, EditCardModal, CardDetailModal } from './CardModals.jsx';
export { CreateCollectionModal, EditCollectionModal } from './CollectionModals.jsx';