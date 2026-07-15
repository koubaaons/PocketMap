/**
 * @fileoverview BinderDataContext.
 *
 * Found during a prop-drilling audit: cardDefMap, ownershipMap,
 * inventoryGroupMap, allBinderSlots, allBinderPanels, and
 * binderInsertMap were all being threaded through BinderBookFlip.jsx
 * as props — but BinderBookFlip never touches any of them itself,
 * it's pure pass-through to BinderPage.jsx (which genuinely does use
 * all six, computing per-slot quantity/ownership/placement data).
 *
 * These are still computed ONCE, at BinderView — this isn't about
 * recomputing them per-leaf (that would be a real performance
 * regression, iterating all inventory/slots/panels once per tile
 * instead of once for the whole page). It's about which components
 * actually need to know these values exist at all. BinderPage reads
 * them directly via useBinderData() instead of receiving them as
 * props that BinderBookFlip has to know about and forward without
 * using.
 */

import { createContext, useContext } from 'react';

const BinderDataContext = createContext(null);

export function BinderDataProvider({ value, children }) {
  return (
    <BinderDataContext.Provider value={value}>
      {children}
    </BinderDataContext.Provider>
  );
}

export function useBinderData() {
  const ctx = useContext(BinderDataContext);
  if (!ctx) {
    throw new Error('useBinderData must be used within a BinderDataProvider (BinderView mounts this — check the component tree if you see this error).');
  }
  return ctx;
}