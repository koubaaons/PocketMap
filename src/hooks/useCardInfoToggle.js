/**
 * @fileoverview useCardInfoToggle hook.
 *
 * Global show/hide preference for the language/condition info badge
 * shown on card tiles (Collection grid, binder slots) — same
 * localStorage-backed pattern as useTheme.js.
 *
 * === Zero prop-drilling === Rather than passing showCardInfo down
 * through every intermediate component between here and the badge
 * (BinderView -> BinderBookFlip -> BinderPage -> BinderSlot, and
 * separately CollectionDetailView -> each Tab -> CardDefinitionList
 * -> CardGridItem — none of which actually use the value, just pass
 * it along), this sets a data-show-card-info attribute on the
 * document root, exactly like useTheme.js already does for
 * data-theme. The badge components themselves always render their
 * content; CSS alone controls visibility (see card-grid.css). Only
 * the toggle BUTTON itself (BinderTopbar/TabToolbar) needs
 * showCardInfo/toggle at all, and each gets it from a single local
 * call to this hook in its own immediate parent — not threaded
 * through anything else.
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pinder-show-card-info';

function getInitialValue() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true'; // shown by default
}

export function useCardInfoToggle() {
  const [showCardInfo, setShowCardInfo] = useState(getInitialValue);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showCardInfo));
    document.documentElement.setAttribute('data-show-card-info', String(showCardInfo));
  }, [showCardInfo]);

  const toggle = () => setShowCardInfo(prev => !prev);

  return { showCardInfo, toggle };
}