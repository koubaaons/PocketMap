/**
 * @fileoverview CollectionDataContext.
 *
 * Same audit finding as BinderDataContext.jsx, on the Collection side:
 * inventory, allBinderSlots, and allBinderPanels were being threaded
 * through OwnedTab/MissingTab/UnorganisedTab as props, but those tabs
 * never touch them directly — pure pass-through to
 * CardDefinitionList.jsx (which genuinely uses all three, computing
 * per-card quantity/placement data for the badge).
 *
 * Still computed once, at CollectionDetailView — this is about which
 * components need to know these values exist at all, not about
 * recomputing them per-tab or per-card.
 */

import { createContext, useContext } from 'react';

const CollectionDataContext = createContext(null);

export function CollectionDataProvider({ value, children }) {
  return (
    <CollectionDataContext.Provider value={value}>
      {children}
    </CollectionDataContext.Provider>
  );
}

export function useCollectionData() {
  const ctx = useContext(CollectionDataContext);
  if (!ctx) {
    throw new Error('useCollectionData must be used within a CollectionDataProvider (CollectionDetailView mounts this — check the component tree if you see this error).');
  }
  return ctx;
}