/**
 * @fileoverview useBinderData — split out of BinderDataContext.jsx so
 * that file exports only components. React's Fast Refresh only
 * hot-reloads reliably when a file's exports are exclusively
 * components; mixing in a plain hook (a non-component export) made
 * every edit to that file trigger a full page reload during
 * development instead of a targeted update.
 *
 * The context object itself lives here too, not in
 * BinderDataContext.jsx — a plain value export is fine in a file with
 * no component exports at all, but BinderDataContext.jsx does export
 * a component (BinderDataProvider), so it's held to the "only
 * components" rule and can't export anything else, context object
 * included.
 */

import { createContext, useContext } from 'react';

export const BinderDataContext = createContext(null);

export function useBinderData() {
  const ctx = useContext(BinderDataContext);
  if (!ctx) {
    throw new Error('useBinderData must be used within a BinderDataProvider (BinderView mounts this — check the component tree if you see this error).');
  }
  return ctx;
}
