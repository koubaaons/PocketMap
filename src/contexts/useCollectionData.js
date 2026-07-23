/**
 * @fileoverview useCollectionData — split out of
 * CollectionDataContext.jsx so that file exports only components. See
 * useBinderData.js's own comment for why (React Fast Refresh needs a
 * file's exports to be exclusively components to hot-reload reliably)
 * — the context object lives here too for the same reason.
 */

import { createContext, useContext } from 'react';

export const CollectionDataContext = createContext(null);

export function useCollectionData() {
  const ctx = useContext(CollectionDataContext);
  if (!ctx) {
    throw new Error('useCollectionData must be used within a CollectionDataProvider (CollectionDetailView mounts this — check the component tree if you see this error).');
  }
  return ctx;
}
