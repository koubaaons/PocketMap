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

import { BinderDataContext } from './useBinderData.js';

export function BinderDataProvider({ value, children }) {
  return (
    <BinderDataContext.Provider value={value}>
      {children}
    </BinderDataContext.Provider>
  );
}