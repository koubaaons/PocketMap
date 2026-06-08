/**
 * @fileoverview useCardEditor hook.
 *
 * Encapsulates all card management state for CollectionDetailView:
 * - Search query
 * - Sort preference
 * - Modal visibility (create, edit, delete confirm)
 * - Active card for edit/delete
 *
 * No dispatch here — callers handle actions via useCardDefinitionActions.
 *
 * Usage:
 *   const editor = useCardEditor();
 *   editor.query, editor.sortBy, editor.showCreate...
 */

// === REFACTOR4a START: Extract useCardEditor hook ===

import { useState } from 'react';

export function useCardEditor() {
  const [query, setQuery]               = useState('');
  const [sortBy, setSortBy]             = useState('newest');
  const [showCreate, setShowCreate]     = useState(false);
  const [editingCard, setEditingCard]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const openCreate  = ()     => setShowCreate(true);
  const closeCreate = ()     => setShowCreate(false);
  const openEdit    = (card) => setEditingCard(card);
  const closeEdit   = ()     => setEditingCard(null);
  const openDelete  = (card) => setConfirmDelete(card);
  const closeDelete = ()     => setConfirmDelete(null);
  const clearQuery  = ()     => setQuery('');

  return {
    // Search & sort
    query,
    setQuery,
    clearQuery,
    sortBy,
    setSortBy,

    // Modal state
    showCreate,
    editingCard,
    confirmDelete,

    // Actions
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    openDelete,
    closeDelete,
  };
}

// === REFACTOR4a END: Extract useCardEditor hook ===