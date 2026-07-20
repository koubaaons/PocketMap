/**
 * @fileoverview useMultiSelect — generic selection-mode state for a
 * grid of cards. Used by every card tab (Owned/Missing/Unorganised/
 * Cards/Decluttered) to support bulk own/unown/favorite/declutter.
 *
 * Deliberately just plain id bookkeeping — no knowledge of what the
 * ids belong to or what actions are available. Each tab wires its own
 * bulk action buttons against `selectedIds`.
 */

import { useState, useCallback } from 'react';

export function useMultiSelect() {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(v => !v);
    setSelectedIds(new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    isSelectMode,
    toggleSelectMode,
    exitSelectMode,
    selectedIds,
    toggle,
    selectAll,
    clearSelection,
  };
}